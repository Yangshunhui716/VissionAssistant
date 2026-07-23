import { useState } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { resize } from '../utils/frameProcessor/frameResizer';
import { parseYoloOutput } from '../utils/recognitionProcessor/yoloParser';
import { COCO_LABELS_VI, OBSTACLE_WHITELIST } from '../utils/recognitionProcessor/cocoLabels';
import { getDepthFromMidas } from '../utils/depthProcessor/depthCalculator';
import { timeVoting } from '../utils/obstacleAnalyzer/timeVoting';
import { whitelistFilter } from '../utils/obstacleAnalyzer/whitelistFilter';
import { gridWeighting } from '../utils/obstacleAnalyzer/gridWeighting';
import { analyzeMotion } from '../utils/obstacleAnalyzer/motionTracker';

const aiDelegates = (Platform.OS === 'ios') ? ['core-ml', 'metal'] : ['android-gpu', 'nnapi'];
let lastRealDepth = 0;
let lastRealArea = 0;
let lastTargetName = '';

export const useVision = () => {
  const yoloModel = useTensorflowModel(require('../assets/models/yolo11n.tflite'), aiDelegates);
  const midasModel = useTensorflowModel(require('../assets/models/midas.tflite'), aiDelegates);

  const yoloBuffer = new Float32Array(320 * 320 * 3);
  const midasBuffer = new Float32Array(256 * 256 * 3);

  const [fps, setFps] = useState(0);
  const [objectList, setObjectList] = useState([]);
  const [detectedObj, setDetectedObj] = useState({ name: 'Không phát hiện', depth: '', motion: '' });

  const updateFps = (newFps) => setFps(newFps);
  const updateList = (names) => setObjectList(names);
  const clearAlert = () => setDetectedObj({ name: 'Không phát hiện', depth: '', motion: '' });
  const updateAlert = (baseName, displayAlertName, realDepth, motion, currentArea) => {
    const translateDepthToText = (rawVal) => {
      if (rawVal <= 0) return "Không rõ";
      if (rawVal > 150) return "Rất gần!";
      if (rawVal > 100) return "Gần";
      return "Xa";
    };
    
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

  const runMidasInBackground = (copiedMidasArray, targetObj, motion, baseName, displayAlertName) => {
    setTimeout(() => {
      try {
        if (midasModel.model) {
          const midasOutputs = midasModel.model.runSync([copiedMidasArray.buffer]);
          const depthMap = new Float32Array(midasOutputs[0]); 
          const rawDepth = getDepthFromMidas(targetObj, depthMap);
          const area = targetObj.width * targetObj.height;
          updateAlert(baseName, displayAlertName, rawDepth, motion, area);
        }
      } catch (error) {
        console.error("Lỗi khi chạy MiDaS ngầm:", error);
      }
    }, 0);
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame(frame) {
      'worklet';
      try {
        if (yoloModel.state === 'loaded' && midasModel.state === 'loaded') {
          const global = globalThis;
          const now = Date.now();
          
          if (!global.lastProcessTime || now - global.lastProcessTime > 200) {
            global.lastProcessTime = now;
            const frameData = new Uint8Array(frame.getPixelBuffer());
            const yoloResized = resize(frameData, frame.width, frame.height, 320, 320, frame.bytesPerRow, yoloBuffer, 'CHW');
            const yoloOutputs = yoloModel.model.runSync([yoloResized.buffer]);
            const parsed = parseYoloOutput(yoloOutputs);

            global.frameHistory = global.frameHistory || [];
            const stableLabels = timeVoting(parsed, global.frameHistory, COCO_LABELS_VI);
            const validObstacles = whitelistFilter(parsed, stableLabels, OBSTACLE_WHITELIST, COCO_LABELS_VI);
            const { mostDangerousTarget, targetName } = gridWeighting(validObstacles, COCO_LABELS_VI);
            const motionState = analyzeMotion(validObstacles, targetName, COCO_LABELS_VI);

            if (mostDangerousTarget) {
              const currentArea = mostDangerousTarget.width * mostDangerousTarget.height;
              
              const centerX = mostDangerousTarget.x + (mostDangerousTarget.width / 2);
              let direction = "Trực diện";
              if (centerX < 106) direction = "Bên trái";
              else if (centerX > 213) direction = "Bên phải";

              const countInSameDirection = validObstacles.filter(obj => {
                const isSameName = COCO_LABELS_VI[obj.labelIdx] === targetName;
                const objCX = obj.x + (obj.width / 2);
                let objDir = "Trực diện";
                if (objCX < 106) objDir = "Bên trái";
                else if (objCX > 213) objDir = "Bên phải";
                
                return isSameName && (objDir === direction);
              }).length;
              
              const quantityText = countInSameDirection > 1 ? `${countInSameDirection} ` : '';
              const displayAlertName = `${quantityText}${targetName} ${direction}`;
              const allValidNames = validObstacles.map(obj => COCO_LABELS_VI[obj.labelIdx]);
              scheduleOnRN(updateList, allValidNames); 

              scheduleOnRN(updateAlert, targetName, displayAlertName, null, motionState, currentArea);

              const timeSinceLastMidas = now - (global.lastMidasTime || 0);
              const isNewTarget = targetName !== global.lastTargetName;

              if (timeSinceLastMidas > 2000 || (isNewTarget && timeSinceLastMidas > 500)) {
                
                global.lastMidasTime = now;
                global.lastTargetName = targetName;

                const midasResized = resize(frameData, frame.width, frame.height, 256, 256, frame.bytesPerRow, midasBuffer, 'HWC');
                const copiedMidasInput = new Float32Array(midasResized);

                scheduleOnRN(runMidasInBackground, copiedMidasInput, mostDangerousTarget, motionState, targetName, displayAlertName);              }
            } else {
              scheduleOnRN(clearAlert);
              scheduleOnRN(updateList, []);
            }
          }

          global.frameCount = (global.frameCount || 0) + 1;
          global.lastFpsTime = global.lastFpsTime || Date.now();
          if (now - global.lastFpsTime >= 1000) {
            scheduleOnRN(updateFps, global.frameCount);
            global.frameCount = 0;
            global.lastFpsTime = now;
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