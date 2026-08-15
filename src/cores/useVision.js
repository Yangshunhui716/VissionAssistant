import { useState, useRef } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { resize } from '../utils/frameProcessor/frameResizer';
import { parseYoloOutput } from '../utils/recognitionProcessor/yoloParser';
import { COCO_LABELS_VI, OBSTACLE_WHITELIST } from '../utils/recognitionProcessor/labels';
import { processGeneralScan, resetGeneralScan } from '../utils/recognitionProcessor/prominentFinder';
import { processSearch, resetSearch } from '../utils/recognitionProcessor/targetFinder';
import { getDepthFromMidas, translateDepthToText } from '../utils/spatialProcessor/depthCalculator';
import { analyzeSpatialObject } from '../utils/spatialProcessor/spatialAnalyzer'; 
import { gridWeighting } from '../utils/obstacleAnalyzer/gridWeighting';
import { updateTracks } from '../utils/obstacleAnalyzer/objectTracker';
import { analyzeThreat } from '../utils/obstacleAnalyzer/threatAnalyzer';
import { isCameraBlocked } from '../utils/frameProcessor/focusAnalyzer';


const aiDelegates = (Platform.OS === 'ios') ? ['core-ml', 'metal'] : ['android-gpu'];
const yoloBuffer = new Float32Array(640 * 640 * 3);
const midasBuffer = new Float32Array(256 * 256 * 3);
let lastRealDepth = 0;
let lastRealArea = 0;
let lastTargetName = '';

export const useVision = (searchTarget, onSearchComplete, isScanningGeneral, onGeneralScanComplete, 
    onThreatDetected, onOutFocusDetected, isShaking) => {
  const yoloModel = useTensorflowModel(require('../assets/models/yolo11n-640.tflite'), aiDelegates);
  const midasModel = useTensorflowModel(require('../assets/models/midas.tflite'), aiDelegates);

  const [fps, setFps] = useState(0);
  const [objectList, setObjectList] = useState([]);
  const [detectedObj, setDetectedObj] = useState({ name: 'Không phát hiện', depth: '', motion: '' });

  const updateFps = (newFps) => {
    setFps(prev => (prev === newFps ? prev : newFps));
  };
  const updateList = (names) => {
    setObjectList(prev => {
      if (prev.length === names.length && prev.every((v, i) => v === names[i])) return prev;
      return names;
    });
  };
  const clearAlert = () => {
    setDetectedObj(prev => {
      if (prev.name === 'Không phát hiện') return prev;
      return { name: 'Không phát hiện', depth: '', motion: '' };
    });
  };

  const lastSpokenThreatRef = useRef("");
  const lastSpokenTimeRef = useRef(0);
  
  const updateAlert = (baseName, displayAlertName, realDepth, motion, currentArea) => {
    let depthText = '';
    if (realDepth !== null) {
      lastRealDepth = realDepth;
      lastRealArea = currentArea;
      lastTargetName = baseName;
      depthText = translateDepthToText(realDepth);
    } else {
      if (baseName === lastTargetName && lastRealDepth > 0 && lastRealArea > 0 && currentArea > 0) {
        const areaRatio = currentArea / lastRealArea;
        const estimatedRawDepth = lastRealDepth * Math.sqrt(areaRatio); 
        depthText = translateDepthToText(estimatedRawDepth);
      } else {
        depthText = 'Đang đo...';
      }
    }
    
    setDetectedObj(prev => {
      if (prev.name === displayAlertName && prev.depth === depthText && prev.motion === motion) return prev;
      return { name: displayAlertName, depth: depthText, motion };
    });

    if (depthText === "dưới nửa mét" || depthText === "khoảng 1 mét") {
      const now = Date.now();
      if (displayAlertName !== lastSpokenThreatRef.current || now - lastSpokenTimeRef.current > 4000) {
         lastSpokenThreatRef.current = displayAlertName;
         lastSpokenTimeRef.current = now;
         onThreatDetected(`${displayAlertName}, cách ${depthText}`);
      }
    }
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame(frame) {
      'worklet';
      try {
        if (yoloModel.state === 'loaded' && midasModel.state === 'loaded') {
          const now = Date.now();

          if (isShaking.value) {
            globalThis.__lastMidasTime = 0; 
            globalThis.__lastTargetName = '';
            scheduleOnRN(clearAlert);
            return;
          }
          
          if (!globalThis.__lastProcessTime || now - globalThis.__lastProcessTime > 200) {
            globalThis.__lastProcessTime = now;
            const frameData = new Uint8Array(frame.getPixelBuffer());
            const yoloResized = resize(frameData, frame.width, frame.height, 640, 640, frame.bytesPerRow, yoloBuffer, 'CHW');
            
            const isBlocked = isCameraBlocked(yoloBuffer, 640, 640);
            if (isBlocked) {
              if (now - (globalThis.__lastBlockedWarnTime || 0) > 6000) {
                globalThis.__lastBlockedWarnTime = now;
                scheduleOnRN(onOutFocusDetected);
              }
              globalThis.__lastMidasTime = 0;
              globalThis.__lastTargetName = '';
              return; 
            }
            globalThis.__lastBlockedWarnTime = 0;

            const yoloOutputs = yoloModel.model.runSync([yoloResized.buffer]);
            const parsed = parseYoloOutput(yoloOutputs);

            if (isScanningGeneral) {
              const scanProcess = processGeneralScan(parsed, COCO_LABELS_VI, 5);
              if (scanProcess.status === 'DONE') {
                 scheduleOnRN(onGeneralScanComplete, scanProcess.result);
              }
            } else {
              resetGeneralScan(); 
            }

            const trackedObstacles = updateTracks(parsed, now, COCO_LABELS_VI, OBSTACLE_WHITELIST);
            if (trackedObstacles.length > 0) {
              const currentNames = trackedObstacles.map(obj => COCO_LABELS_VI[obj.labelIdx]);
              scheduleOnRN(updateList, [...new Set(currentNames)]);
            } else {
              scheduleOnRN(updateList, []);
            }

            const { mostDangerousTarget, targetName } = gridWeighting(trackedObstacles, COCO_LABELS_VI);
            const motionState = mostDangerousTarget ? mostDangerousTarget.motion : "Tĩnh";

            let currentDepthMap = globalThis.__lastDepthMap; 
            if (mostDangerousTarget) {
              const currentArea = mostDangerousTarget.width * mostDangerousTarget.height;
              const displayAlertName = analyzeThreat(mostDangerousTarget, targetName, trackedObstacles, COCO_LABELS_VI);
              const timeSinceLastMidas = now - (globalThis.__lastMidasTime || 0);
              const isNewTarget = targetName !== globalThis.__lastTargetName;
              let rawDepth = null;
              if (timeSinceLastMidas > 2000 || (isNewTarget && timeSinceLastMidas > 500)) {
                globalThis.__lastMidasTime = now;
                globalThis.__lastTargetName = targetName;

                const midasResized = resize(frameData, frame.width, frame.height, 256, 256, frame.bytesPerRow, midasBuffer, 'HWC');
                if (midasModel.model) {
                  const midasOutputs = midasModel.model.runSync([midasResized.buffer]);
                  currentDepthMap = new Float32Array(midasOutputs[0]); 
                  globalThis.__lastDepthMap = currentDepthMap;
                   
                  if (currentDepthMap) {
                    rawDepth = getDepthFromMidas(mostDangerousTarget, currentDepthMap);
                  }
                  scheduleOnRN(updateAlert, targetName, displayAlertName, rawDepth, motionState, currentArea);
                }
              }
            } else {
              scheduleOnRN(clearAlert);
            }

            if (searchTarget) {
              const searchResult = processSearch(parsed, searchTarget, COCO_LABELS_VI, 5);
              if (searchResult.status === 'FOUND') {
                const spatialMessage = analyzeSpatialObject(searchResult.item, searchTarget, currentDepthMap);
                scheduleOnRN(onSearchComplete, true, spatialMessage);
              }
              else if (searchResult.status === 'NOT_FOUND') {
                scheduleOnRN(onSearchComplete, false, searchTarget);
              }
            } else {
              resetSearch(); 
            }
          }

          globalThis.__frameCount = (globalThis.__frameCount || 0) + 1;
          globalThis.__lastFpsTime = globalThis.__lastFpsTime || Date.now();
          if (now - globalThis.__lastFpsTime >= 1000) {
            scheduleOnRN(updateFps, globalThis.__frameCount);
            globalThis.__frameCount = 0;
            globalThis.__lastFpsTime = now;
          }
        }
      } catch (e) {
        console.error("Lỗi Worklet:", String(e));
      } finally {
        frame.dispose();
      }
    },
  }, [searchTarget, isScanningGeneral]);

  return { frameOutput, fps, objectList, detectedObj, isModelsLoaded: yoloModel.state === 'loaded' && midasModel.state === 'loaded' };
};