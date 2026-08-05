import { useState } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { resize } from '../utils/frameProcessor/frameResizer';
import { parseYoloOutput } from '../utils/recognitionProcessor/yoloParser';
import { COCO_LABELS_VI, OBSTACLE_WHITELIST } from '../utils/recognitionProcessor/cocoLabels';
import { getProminentObject } from '../utils/recognitionProcessor/prominentFinder';
import { checkSearchTarget } from '../utils/recognitionProcessor/targetFinder';
import { getDepthFromMidas, translateDepthToText } from '../utils/depthProcessor/depthCalculator';
import { gridWeighting } from '../utils/obstacleAnalyzer/gridWeighting';
import { updateTracks } from '../utils/obstacleAnalyzer/objectTracker';
import { analyzeThreat } from '../utils/obstacleAnalyzer/threatAnalyzer';


const aiDelegates = (Platform.OS === 'ios') ? ['core-ml', 'metal'] : ['android-gpu', 'nnapi'];
const yoloBuffer = new Float32Array(320 * 320 * 3);
const midasBuffer = new Float32Array(256 * 256 * 3);
let lastRealDepth = 0;
let lastRealArea = 0;
let lastTargetName = '';

export const useVision = (searchTarget = null, onSearchComplete = () => {},
    isScanningGeneral = false, onGeneralScanComplete = () => {}) => {
  const yoloModel = useTensorflowModel(require('../assets/models/yolo11n.tflite'), aiDelegates);
  const midasModel = useTensorflowModel(require('../assets/models/midas.tflite'), aiDelegates);

  const [fps, setFps] = useState(0);
  const [objectList, setObjectList] = useState([]);
  const [detectedObj, setDetectedObj] = useState({ name: 'Không phát hiện', depth: '', motion: '' });

  const updateFps = (newFps) => setFps(newFps);
  const updateList = (names) => setObjectList(names);
  const clearAlert = () => setDetectedObj({ name: 'Không phát hiện', depth: '', motion: '' });
  
  const updateAlert = (baseName, displayAlertName, realDepth, motion, currentArea) => {
    if (realDepth !== null) {
      lastRealDepth = realDepth;
      lastRealArea = currentArea;
      lastTargetName = baseName;
      
      setDetectedObj({ name: displayAlertName, depth: translateDepthToText(realDepth), motion });
    } else {
      if (baseName === lastTargetName && lastRealDepth > 0 && lastRealArea > 0 && currentArea > 0) {
        const areaRatio = currentArea / lastRealArea;
        const estimatedRawDepth = lastRealDepth * Math.sqrt(areaRatio); 
        setDetectedObj({ name: displayAlertName, depth: translateDepthToText(estimatedRawDepth), motion });
      } else {
        setDetectedObj(prev => ({ ...prev, name: displayAlertName, motion, depth: 'Đang đo...' }));
      }
    }
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame(frame) {
      'worklet';
      try {
        if (yoloModel.state === 'loaded' && midasModel.state === 'loaded') {
          const g = globalThis;
          const now = Date.now();
          
          if (!g.__lastProcessTime || now - g.__lastProcessTime > 200) {
            g.__lastProcessTime = now;
            const frameData = new Uint8Array(frame.getPixelBuffer());
            const yoloResized = resize(frameData, frame.width, frame.height, 320, 320, frame.bytesPerRow, yoloBuffer, 'CHW');
            const yoloOutputs = yoloModel.model.runSync([yoloResized.buffer]);
            
            const parsed = parseYoloOutput(yoloOutputs);

            if (searchTarget) {
              g.__searchFrameCount = (g.__searchFrameCount || 0) + 1;
              const searchResult = checkSearchTarget(parsed, searchTarget, COCO_LABELS_VI, g.__searchFrameCount);
              if (searchResult.status === 'FOUND') {
                scheduleOnRN(onSearchComplete, true, searchResult.item);
                g.__searchFrameCount = 0;
              } else if (searchResult.status === 'NOT_FOUND') {
                scheduleOnRN(onSearchComplete, false, null);
                g.__searchFrameCount = 0;
              }
            }

            if (isScanningGeneral) {
              const prominentName = getProminentObject(parsed, COCO_LABELS_VI);
              const displayList = prominentName ? [prominentName] : [];
              scheduleOnRN(onGeneralScanComplete, displayList);
            }

            const trackedObstacles = updateTracks(parsed, now, COCO_LABELS_VI, OBSTACLE_WHITELIST);
            if (trackedObstacles.length > 0) {
              const currentNames = trackedObstacles.map(obj => COCO_LABELS_VI[obj.labelIdx]);
              const uniqueNames = [...new Set(currentNames)];
              scheduleOnRN(updateList, uniqueNames);
            } else {
              scheduleOnRN(updateList, []);
            }
            const { mostDangerousTarget, targetName } = gridWeighting(trackedObstacles, COCO_LABELS_VI);
            const motionState = mostDangerousTarget ? mostDangerousTarget.motion : "Tĩnh";

            if (mostDangerousTarget) {
              const currentArea = mostDangerousTarget.width * mostDangerousTarget.height;
              
              const displayAlertName = analyzeThreat(mostDangerousTarget, targetName, trackedObstacles, COCO_LABELS_VI);

              scheduleOnRN(updateAlert, targetName, displayAlertName, null, motionState, currentArea);

              const timeSinceLastMidas = now - (g.__lastMidasTime || 0);
              const isNewTarget = targetName !== g.__lastTargetName;

              if (timeSinceLastMidas > 2000 || (isNewTarget && timeSinceLastMidas > 500)) {
                g.__lastMidasTime = now;
                g.__lastTargetName = targetName;

                const midasResized = resize(frameData, frame.width, frame.height, 256, 256, frame.bytesPerRow, midasBuffer, 'HWC');

                if (midasModel.model) {
                   const midasOutputs = midasModel.model.runSync([midasResized.buffer]);
                   const depthMap = new Float32Array(midasOutputs[0]); 
                   const rawDepth = getDepthFromMidas(mostDangerousTarget, depthMap);
                   scheduleOnRN(updateAlert, targetName, displayAlertName, rawDepth, motionState, currentArea);
                }
              }
            } else {
              scheduleOnRN(clearAlert);
            }
          }

          g.__frameCount = (g.__frameCount || 0) + 1;
          g.__lastFpsTime = g.__lastFpsTime || Date.now();
          if (now - g.__lastFpsTime >= 1000) {
            scheduleOnRN(updateFps, g.__frameCount);
            g.__frameCount = 0;
            g.__lastFpsTime = now;
          }
        }
      } catch (e) {
        console.error("Lỗi Worklet:", String(e));
      } finally {
        frame.dispose();
      }
    },
  });

  return {
    frameOutput,
    fps,
    objectList,
    detectedObj,
    isModelsLoaded: yoloModel.state === 'loaded' && midasModel.state === 'loaded'
  };
};