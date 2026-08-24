import { useState, useRef } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { resize, createBmpBase64 } from '../utils/frameProcessor/frameResizer';
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

export const IS_DEBUG = false; 

const YOLO_SIZE = 320;
const YOLO_ANCHORS = (Math.pow(YOLO_SIZE/8,2) + Math.pow(YOLO_SIZE/16,2) + Math.pow(YOLO_SIZE/32,2));
const MIDAS_SIZE = 256;

const PROCESS_DELAY_MS = 250;
const MIDAS_DELAY_MS = 2000;
const BLOCKED_WARN_MS = 6000;

const aiDelegates = (Platform.OS === 'ios') ? ['core-ml', 'metal'] : ['android-gpu'];
const yoloBuffer = new Float32Array(YOLO_SIZE * YOLO_SIZE * 3);
const midasBuffer = new Float32Array(MIDAS_SIZE * MIDAS_SIZE * 3);
let lastRealDepth = 0;
let lastRealArea = 0;
let lastTargetName = '';

export const useVision = (searchTarget, onSearchComplete, isScanningGeneral, onGeneralScanComplete, 
    onThreatDetected, onOutFocusDetected, isShaking) => {
  const yoloModel = useTensorflowModel(require('../assets/models/yolo11n.tflite'), aiDelegates);
  const midasModel = useTensorflowModel(require('../assets/models/midas.tflite'), aiDelegates);

  const [fps, setFps] = useState(0);
  const [objectList, setObjectList] = useState([]);
  const [detectedObj, setDetectedObj] = useState({ name: 'Không phát hiện', depth: '', motion: '' });

  const [debugImage, setDebugImage] = useState(null);
  const updateDebugImage = (b64) => {
    setDebugImage(b64);
  };

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
            globalThis.__lastThreatTarget = ''; 
            globalThis.__lastMidasTarget = '';  
            scheduleOnRN(clearAlert);
            return;
          }

          const bufferStart = Date.now();
          const frameData = new Uint8Array(frame.getPixelBuffer());
          const bufferTime = Date.now() - bufferStart;

          const isBlocked = isCameraBlocked(frameData, frame.width, frame.height, frame.bytesPerRow);
          if (isBlocked) {
            if (now - (globalThis.__lastBlockedWarnTime || 0) > BLOCKED_WARN_MS) {
              globalThis.__lastBlockedWarnTime = now;
              scheduleOnRN(onOutFocusDetected);
            }
            globalThis.__lastMidasTime = 0;
            globalThis.__lastThreatTarget = '';
            globalThis.__lastMidasTarget = '';
            return; 
          }
          globalThis.__lastBlockedWarnTime = 0;
          
          if (!globalThis.__lastProcessTime || now - globalThis.__lastProcessTime > PROCESS_DELAY_MS) {
            globalThis.__lastProcessTime = now;
            const resizeStart = Date.now();
            const yoloResized = resize(frameData, frame.width, frame.height, YOLO_SIZE, YOLO_SIZE, yoloBuffer, 'CHW', frame.orientation, frame.isMirrored);
            const resizeTime = Date.now() - resizeStart;

            const yoloStart = Date.now();
            const yoloOutputs = yoloModel.model.runSync([yoloResized.buffer]);
            const yoloTime = Date.now() - yoloStart;

            const parseStart = Date.now();
            const parsed = parseYoloOutput(yoloOutputs, YOLO_SIZE, YOLO_ANCHORS, IS_DEBUG);
            const parseTime = Date.now() - parseStart;

            if (IS_DEBUG) {
              if (!globalThis.__lastDumpTime || now - globalThis.__lastDumpTime > 3000) {
                globalThis.__lastDumpTime = now;
                const b64 = createBmpBase64(yoloBuffer, YOLO_SIZE, YOLO_SIZE, 'CHW', parsed);
                scheduleOnRN(updateDebugImage, b64);
              }
              console.log(`[BENCHMARK] Buffer: ${bufferTime}ms | Resize: ${resizeTime}ms | YOLO: ${yoloTime}ms | Parse: ${parseTime}ms | Tổng: ${resizeTime + yoloTime + parseTime}ms`);
            }

            if (isScanningGeneral) {
              const scanProcess = processGeneralScan(parsed, COCO_LABELS_VI, YOLO_SIZE, 10);
              if (scanProcess.status === 'DONE') {
                 scheduleOnRN(onGeneralScanComplete, scanProcess.result);
              }
            } else {
              resetGeneralScan(); 
            }

            const trackedObstacles = updateTracks(parsed, now, COCO_LABELS_VI, OBSTACLE_WHITELIST, YOLO_SIZE);
            
            if (IS_DEBUG) {
              if (trackedObstacles.length > 0) {
                const currentNames = trackedObstacles.map(obj => COCO_LABELS_VI[obj.labelIdx]);
                scheduleOnRN(updateList, [...new Set(currentNames)]);
              } else {
                scheduleOnRN(updateList, []);
              }
            }

            const { mostDangerousTarget, targetName } = gridWeighting(trackedObstacles, COCO_LABELS_VI, YOLO_SIZE, globalThis.__lastThreatTarget || "");
            const motionState = mostDangerousTarget ? mostDangerousTarget.motion : "Tĩnh";

            let currentDepthMap = globalThis.__lastDepthMap; 
            if (mostDangerousTarget) {
              const currentArea = mostDangerousTarget.width * mostDangerousTarget.height;
              const displayAlertName = analyzeThreat(mostDangerousTarget, targetName, trackedObstacles, COCO_LABELS_VI, YOLO_SIZE);
              
              globalThis.__lastThreatTarget = targetName;

              const timeSinceLastMidas = now - (globalThis.__lastMidasTime || 0);
              const isNewTarget = targetName !== globalThis.__lastMidasTarget;
              let rawDepth = null;
              
              if (timeSinceLastMidas > MIDAS_DELAY_MS || (isNewTarget && timeSinceLastMidas > 500)) {
                globalThis.__lastMidasTime = now;
                globalThis.__lastMidasTarget = targetName;

                const midasResized = resize(frameData, frame.width, frame.height, MIDAS_SIZE, MIDAS_SIZE, midasBuffer, 'HWC', frame.orientation, frame.isMirrored);
                if (midasModel.model) {
                  const midasOutputs = midasModel.model.runSync([midasResized.buffer]);
                  currentDepthMap = new Float32Array(midasOutputs[0]); 
                  globalThis.__lastDepthMap = currentDepthMap;
                   
                  if (currentDepthMap) {
                    rawDepth = getDepthFromMidas(mostDangerousTarget, currentDepthMap, YOLO_SIZE, MIDAS_SIZE);
                  }
                  scheduleOnRN(updateAlert, targetName, displayAlertName, rawDepth, motionState, currentArea);
                }
              }
            } else {
              globalThis.__lastThreatTarget = ""; 
              scheduleOnRN(clearAlert);
            }

            if (searchTarget) {
              if (globalThis.__lastSearchTarget !== searchTarget) {
                globalThis.__lastSearchTarget = searchTarget;
                globalThis.__searchLocked = false;
              }

              if (!globalThis.__searchLocked) {
                const searchResult = processSearch(parsed, searchTarget, COCO_LABELS_VI, 5);
                
                if (searchResult.status === 'FOUND') {
                  globalThis.__searchLocked = true; 

                  const timeSinceLastMidas = now - (globalThis.__lastMidasTime || 0);
                  if ((!currentDepthMap || timeSinceLastMidas > 1000) && midasModel.model) {
                    const midasResized = resize(frameData, frame.width, frame.height, MIDAS_SIZE, MIDAS_SIZE, midasBuffer, 'HWC', frame.orientation, frame.isMirrored);
                    const midasOutputs = midasModel.model.runSync([midasResized.buffer]);
                    currentDepthMap = new Float32Array(midasOutputs[0]); 
                    globalThis.__lastDepthMap = currentDepthMap;
                    globalThis.__lastMidasTime = now;
                  }

                  const spatialMessage = analyzeSpatialObject(searchResult.item, searchTarget, currentDepthMap, YOLO_SIZE, MIDAS_SIZE);
                  scheduleOnRN(onSearchComplete, true, spatialMessage);
                }
                else if (searchResult.status === 'NOT_FOUND') {
                  globalThis.__searchLocked = true;
                  scheduleOnRN(onSearchComplete, false, searchTarget);
                }
              }
            } else {
              resetSearch(); 
              globalThis.__lastSearchTarget = null;
              globalThis.__searchLocked = false;
            }
          }

          globalThis.__frameCount = (globalThis.__frameCount || 0) + 1;
          globalThis.__lastFpsTime = globalThis.__lastFpsTime || Date.now();
          if (now - globalThis.__lastFpsTime >= 1000) {
            if (IS_DEBUG) {
              scheduleOnRN(updateFps, globalThis.__frameCount);
            }
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

  return { frameOutput, fps, objectList, detectedObj, isModelsLoaded: yoloModel.state === 'loaded' && midasModel.state === 'loaded', debugImage };
};