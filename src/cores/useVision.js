import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { useSharedValue } from 'react-native-reanimated';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { preprocessFrame } from '../utils/frameProcessor/framePreprocessor';
import { parseYoloOutput } from '../utils/recognitionProcessor/yoloParser';
import {
  OBJECT365_LABELS_VI,
  OBSTACLE_WHITELIST,
  CURRENCY_LABELS_VI,
} from '../utils/recognitionProcessor/labels';
import {
  processGeneralScan,
  resetGeneralScan,
} from '../utils/recognitionProcessor/prominentFinder';
import {
  processSearch,
  resetSearch,
} from '../utils/recognitionProcessor/targetFinder';
import {
  processCurrencyScan,
  resetCurrencyScan,
} from '../utils/recognitionProcessor/currencyScan';
import {
  getDepthFromMidas,
  translateDepthToText,
} from '../utils/spatialProcessor/depthCalculator';
import { analyzeSpatialObject } from '../utils/spatialProcessor/spatialAnalyzer';
import { gridWeighting } from '../utils/obstacleAnalyzer/gridWeighting';
import { updateTracks } from '../utils/obstacleAnalyzer/objectTracker';
import { analyzeThreat } from '../utils/obstacleAnalyzer/threatAnalyzer';
import { analyzeFrameQuality } from '../utils/frameProcessor/frameQuality';
import { IS_DEBUG, createBmpBase64 } from '../utils/debug/debug';

const YOLO_SIZE = 320;
const MIDAS_SIZE = 256;

const PROCESS_DELAY_MS = 250;
const MIDAS_DELAY_MS = 2000;
const MIDAS_NEW_TARGET_DELAY_MS = 500;
const MIDAS_SEARCH_INTERVAL_MS = 1000;
const BLOCKED_WARN_MS = 4000;
const THREAT_COOLDOWN_MS = 4000;
const THREAT_RESET_MS = 2000;
const ALERT_CLEAR_DELAY_MS = 1000;
const CURRENCY_COOLDOWN_MS = 4000;
const CURRENCY_TIMEOUT_MS = 6000;
const DEBUG_DUMP_INTERVAL_MS = 3000;
const FPS_UPDATE_INTERVAL_MS = 1000;

const SEARCH_MAX_FRAMES = 5;
const SCAN_GENERAL_MAX_FRAMES = 10;

const aiDelegates =
  Platform.OS === 'ios' ? ['core-ml', 'metal'] : ['android-gpu'];
const yoloBuffer = new Float32Array(YOLO_SIZE * YOLO_SIZE * 3);
const midasBuffer = new Float32Array(MIDAS_SIZE * MIDAS_SIZE * 3);

let lastRealDepth = 0;
let lastRealArea = 0;
let lastTargetName = '';
let lastSpokenBaseName = '';
let lastSpokenDepthLevel = 0;
let lastSpokenTime = 0;

export const useVision = (
  photoOutput,
  isObstacleActive,
  searchTarget,
  onSearchComplete,
  isScanningGeneral,
  onGeneralScanComplete,
  isScanningCurrency,
  onCurrencyScanComplete,
  isScanningText,
  onTextScanComplete,
  onThreatDetected,
  onFrameQuality,
  isShaking,
  captureTrigger,
  onCaptureReportComplete,
) => {
  const yoloObjModel = useTensorflowModel(
    require('../assets/models/yolo26n-objv1-150-320.tflite'),
    aiDelegates,
  );
  const yoloCurrencyModel = useTensorflowModel(
    require('../assets/models/yolo26n_vietnamese_currency_320.tflite'),
    aiDelegates,
  );
  const midasModel = useTensorflowModel(
    require('../assets/models/midas.tflite'),
    aiDelegates,
  );

  const [detectedObj, setDetectedObj] = useState({
    name: '',
    depth: '',
    motion: '',
  });

  const [fps, setFps] = useState(0);
  const updateFps = newFps => {
    setFps(prev => (prev === newFps ? prev : newFps));
  };

  const [debugImage, setDebugImage] = useState(null);
  const updateDebugImage = b64 => {
    setDebugImage(b64);
  };

  const [objectList, setObjectList] = useState([]);
  const updateList = names => {
    setObjectList(prev => {
      if (prev.length === names.length && prev.every((v, i) => v === names[i]))
        return prev;
      return names;
    });
  };

  const clearAlert = () => {
    setDetectedObj(prev => {
      if (prev.name === '') return prev;
      return { name: '', depth: '', motion: '' };
    });
  };

  const getDepthLevel = text => {
    if (text === 'Dưới nửa mét') return 3;
    if (text === 'Khoảng 1 mét') return 2;
    if (text === 'Khoảng 2 mét') return 1;
    return 0;
  };

  const updateAlert = (
    baseName,
    displayAlertName,
    realDepth,
    motion,
    currentArea,
  ) => {
    let depthText = '';
    if (realDepth !== null) {
      lastRealDepth = realDepth;
      lastRealArea = currentArea;
      lastTargetName = baseName;
      depthText = translateDepthToText(realDepth);
    } else {
      if (
        baseName === lastTargetName &&
        lastRealDepth > 0 &&
        lastRealArea > 0 &&
        currentArea > 0
      ) {
        const areaRatio = currentArea / lastRealArea;
        const estimatedRawDepth = lastRealDepth * Math.sqrt(areaRatio);
        depthText = translateDepthToText(estimatedRawDepth);
      } else {
        depthText = 'Đang đo';
      }
    }

    setDetectedObj(prev => {
      if (
        prev.name === displayAlertName &&
        prev.depth === depthText &&
        prev.motion === motion
      )
        return prev;
      return { name: displayAlertName, depth: depthText, motion: motion };
    });

    const currentDepthLevel = getDepthLevel(depthText);

    if (currentDepthLevel > 0) {
      const now = Date.now();
      const isDifferentTarget = baseName !== lastSpokenBaseName;
      const isCloser = currentDepthLevel > lastSpokenDepthLevel;
      const isTimeUp = now - lastSpokenTime > THREAT_COOLDOWN_MS;

      if (isDifferentTarget || isCloser || isTimeUp) {
        lastSpokenBaseName = baseName;
        lastSpokenDepthLevel = currentDepthLevel;
        lastSpokenTime = now;
        onThreatDetected(`${displayAlertName}, cách ${depthText}, ${motion}`);
      }
    } else {
      if (Date.now() - lastSpokenTime > THREAT_RESET_MS) {
        lastSpokenDepthLevel = 0;
      }
    }
  };

  const isProcessingText = useSharedValue(false);

  useEffect(() => {
    if (isScanningText) {
      isProcessingText.value = true;
    }
  }, [isScanningText, isProcessingText]);

  const runTextRecognition = useCallback(async () => {
    if (!photoOutput) {
      onTextScanComplete('');
      return;
    }

    try {
      const { filePath } = await photoOutput.capturePhotoToFile(
        {
          flashMode: 'off',
        },
        {},
      );

      const imageUri = filePath.startsWith('file://')
        ? filePath
        : `file://${filePath}`;

      const result = await TextRecognition.recognize(imageUri);
      if (IS_DEBUG) setDebugImage(imageUri);

      const text = result?.text?.trim() || '';
      onTextScanComplete(text);
    } catch (e) {
      console.error('Error OCR: ', e);
      onTextScanComplete('');
    } finally {
      isProcessingText.value = false;
    }
  }, [photoOutput, onTextScanComplete]);

  const frameOutput = useFrameOutput(
    {
      pixelFormat: 'rgb',
      onFrame(frame) {
        'worklet';
        try {
          if (
            yoloObjModel.state === 'loaded' &&
            midasModel.state === 'loaded' &&
            yoloCurrencyModel.state === 'loaded'
          ) {
            const now = Date.now();

            globalThis.__frameCount = (globalThis.__frameCount || 0) + 1;
            globalThis.__lastFpsTime = globalThis.__lastFpsTime || Date.now();
            if (now - globalThis.__lastFpsTime >= FPS_UPDATE_INTERVAL_MS) {
              if (IS_DEBUG) scheduleOnRN(updateFps, globalThis.__frameCount);
              globalThis.__frameCount = 0;
              globalThis.__lastFpsTime = now;
            }

            if (isShaking.value) {
              globalThis.__lastMidasTime = 0;
              globalThis.__lastThreatTarget = '';
              globalThis.__lastMidasTarget = '';
              scheduleOnRN(clearAlert);
              return;
            }

            let forceCapture = false;
            if (IS_DEBUG && captureTrigger && captureTrigger.value) {
              forceCapture = true;
              captureTrigger.value = false;
            }

            const frameData = new Uint8Array(frame.getPixelBuffer());

            const frameQuality = analyzeFrameQuality(
              frameData,
              frame.width,
              frame.height,
            );

            if (frameQuality.isBad) {
              if (
                now - (globalThis.__lastBlockedWarnTime || 0) >
                BLOCKED_WARN_MS
              ) {
                globalThis.__lastBlockedWarnTime = now;
                scheduleOnRN(onFrameQuality, frameQuality.reason);
                if (detectedObj.name) scheduleOnRN(clearAlert);
              }
              globalThis.__lastMidasTime = 0;
              globalThis.__lastThreatTarget = '';
              globalThis.__lastMidasTarget = '';
              return;
            }

            if (isProcessingText.value) {
              isProcessingText.value = false;

              if (globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }

              scheduleOnRN(runTextRecognition);
              return;
            }

            if (globalThis.__pendingMidasTask) {
              const task = globalThis.__pendingMidasTask;
              globalThis.__pendingMidasTask = null;

              const midasResized = preprocessFrame(
                frameData,
                frame.width,
                frame.height,
                MIDAS_SIZE,
                MIDAS_SIZE,
                midasBuffer,
                'HWC',
                frame.orientation,
                frame.isMirrored,
                null
              );

              if (midasModel.model) {
                const midasOutputs = midasModel.model.runSync([
                  midasResized.buffer,
                ]);
                if (!globalThis.__lastDepthMap) {
                  globalThis.__lastDepthMap = new Float32Array(midasOutputs[0]);
                } else {
                  globalThis.__lastDepthMap.set(midasOutputs[0]);
                }
                const currentDepthMap = globalThis.__lastDepthMap;
                globalThis.__lastMidasTime = now;

                if (task.type === 'THREAT') {
                  globalThis.__lastMidasTarget = task.targetName;
                  const rawDepth = getDepthFromMidas(
                    task.obj,
                    currentDepthMap,
                    YOLO_SIZE,
                    MIDAS_SIZE,
                  );
                  scheduleOnRN(
                    updateAlert,
                    task.targetName,
                    task.displayAlertName,
                    rawDepth,
                    task.motionState,
                    task.currentArea,
                  );
                } else if (task.type === 'SEARCH') {
                  const spatialMessage = analyzeSpatialObject(
                    task.obj,
                    task.targetName,
                    currentDepthMap,
                    YOLO_SIZE,
                    MIDAS_SIZE,
                  );
                  scheduleOnRN(onSearchComplete, true, spatialMessage);
                }
              }
              return;
            }

            if (isScanningCurrency) {
              if (globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }

              if (!globalThis.__currencyStartTime) {
                globalThis.__currencyStartTime = now;
              }

              if (
                !globalThis.__lastCurrencyProcessTime ||
                now - globalThis.__lastCurrencyProcessTime > PROCESS_DELAY_MS
              ) {
                globalThis.__lastCurrencyProcessTime = now;

                const yoloResized = preprocessFrame(
                  frameData,
                  frame.width,
                  frame.height,
                  YOLO_SIZE,
                  YOLO_SIZE,
                  yoloBuffer,
                  'CHW',
                  frame.orientation,
                  frame.isMirrored,
                  null
                );

                const currencyOutputs = yoloCurrencyModel.model.runSync([
                  yoloResized.buffer,
                ]);
                const parsedCurrency = parseYoloOutput(
                  currencyOutputs,
                  YOLO_SIZE,
                );
                const resultCurrencyScan = processCurrencyScan(
                  parsedCurrency,
                  CURRENCY_LABELS_VI,
                );

                if (resultCurrencyScan) {
                  globalThis.__currencyStartTime = now;

                  if (
                    !globalThis.__lastMoneySpeakTime ||
                    now - globalThis.__lastMoneySpeakTime > CURRENCY_COOLDOWN_MS
                  ) {
                    globalThis.__lastMoneySpeakTime = now;
                    scheduleOnRN(onCurrencyScanComplete, resultCurrencyScan);
                  }
                } else {
                  if (
                    now - globalThis.__currencyStartTime >
                    CURRENCY_TIMEOUT_MS
                  ) {
                    globalThis.__currencyStartTime = null;
                    scheduleOnRN(onCurrencyScanComplete, '');
                  }
                }
              }
              return;
            } else {
              globalThis.__currencyStartTime = null;
              globalThis.__lastMoneySpeakTime = 0;
              resetCurrencyScan();
            }

            if (!searchTarget) {
              resetSearch();
              globalThis.__lastSearchTarget = null;
              globalThis.__searchLocked = false;
            }

            if (!isScanningGeneral) {
              resetGeneralScan();
            }

            const hasOnDemandObjectTask = searchTarget || isScanningGeneral;

            if (!hasOnDemandObjectTask && !isObstacleActive && !forceCapture) {
              if (globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }
              if (IS_DEBUG) {
                scheduleOnRN(updateList, []);
                scheduleOnRN(updateDebugImage, null);
              }
              return;
            }

            if (
              !globalThis.__lastProcessTime ||
              now - globalThis.__lastProcessTime > PROCESS_DELAY_MS
            ) {
              globalThis.__lastProcessTime = now;

              let reportData = forceCapture ? {} : null;

              const yoloResized = preprocessFrame(
                frameData,
                frame.width,
                frame.height,
                YOLO_SIZE,
                YOLO_SIZE,
                yoloBuffer,
                'CHW',
                frame.orientation,
                frame.isMirrored,
                reportData,
              );

              const objectOutputs = yoloObjModel.model.runSync([
                yoloResized.buffer,
              ]);
              const parsedObject = parseYoloOutput(
                objectOutputs,
                YOLO_SIZE,
              );

              if (IS_DEBUG) {
                if (parsedObject.length > 0) {
                  const currentNames = parsedObject.map(
                    obj => OBJECT365_LABELS_VI[obj.labelIdx],
                  );
                  scheduleOnRN(updateList, [...new Set(currentNames)]);
                } else {
                  scheduleOnRN(updateList, []);
                }
                if (
                  !globalThis.__lastDumpTime ||
                  now - globalThis.__lastDumpTime > DEBUG_DUMP_INTERVAL_MS
                ) {
                  globalThis.__lastDumpTime = now;
                  const b64 = createBmpBase64(
                    yoloBuffer,
                    YOLO_SIZE,
                    YOLO_SIZE,
                    'CHW',
                    parsedObject,
                    OBJECT365_LABELS_VI,
                  );
                  scheduleOnRN(updateDebugImage, b64);
                }

                if (forceCapture && reportData) {
                  const yoloB64 = createBmpBase64(
                    yoloBuffer,
                    YOLO_SIZE,
                    YOLO_SIZE,
                    'CHW',
                    parsedObject,
                    OBJECT365_LABELS_VI,
                  );

                  const midasResized = preprocessFrame(
                    frameData,
                    frame.width,
                    frame.height,
                    MIDAS_SIZE,
                    MIDAS_SIZE,
                    midasBuffer,
                    'HWC',
                    frame.orientation,
                    frame.isMirrored,
                    null
                  );
                  const midasOutputs = midasModel.model.runSync([
                    midasResized.buffer,
                  ]);
                  const rawDepth = new Float32Array(midasOutputs[0]);

                  const depthPixels = new Uint8Array(
                    MIDAS_SIZE * MIDAS_SIZE * 3,
                  );
                  let minDepth = 999999;
                  let maxDepth = -999999;
                  for (let i = 0; i < rawDepth.length; i++) {
                    if (rawDepth[i] < minDepth) minDepth = rawDepth[i];
                    if (rawDepth[i] > maxDepth) maxDepth = rawDepth[i];
                  }
                  const depthRange = maxDepth - minDepth || 1;

                  for (let i = 0; i < rawDepth.length; i++) {
                    const v = (rawDepth[i] - minDepth) / depthRange;
                    const r = Math.round(
                      255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 3))),
                    );
                    const g = Math.round(
                      255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 2))),
                    );
                    const b = Math.round(
                      255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 1))),
                    );

                    depthPixels[i * 3] = r;
                    depthPixels[i * 3 + 1] = g;
                    depthPixels[i * 3 + 2] = b;
                  }

                  const scaleFactor = MIDAS_SIZE / YOLO_SIZE;
                  const scaledBoxes = parsedObject.map(box => ({
                    x: box.x * scaleFactor,
                    y: box.y * scaleFactor,
                    width: box.width * scaleFactor,
                    height: box.height * scaleFactor,
                    labelIdx: box.labelIdx,
                    score: box.score,
                  }));

                  const depthB64 = createBmpBase64(
                    depthPixels,
                    MIDAS_SIZE,
                    MIDAS_SIZE,
                    'HWC',
                    scaledBoxes,
                    null,
                  );

                  scheduleOnRN(
                    onCaptureReportComplete,
                    reportData.b1,
                    reportData.b2,
                    reportData.b3,
                    reportData.b4,
                    yoloB64,
                    depthB64,
                  );
                }
              }

              if (searchTarget) {
                if (globalThis.__lastSearchTarget !== searchTarget) {
                  globalThis.__lastSearchTarget = searchTarget;
                  globalThis.__searchLocked = false;
                }

                if (!globalThis.__searchLocked) {
                  const searchResult = processSearch(
                    parsedObject,
                    searchTarget,
                    OBJECT365_LABELS_VI,
                    SEARCH_MAX_FRAMES,
                  );
                  if (searchResult.status === 'FOUND') {
                    globalThis.__searchLocked = true;
                    const timeSinceLastMidas =
                      now - (globalThis.__lastMidasTime || 0);

                    if (
                      (!globalThis.__lastDepthMap ||
                        timeSinceLastMidas > MIDAS_SEARCH_INTERVAL_MS) &&
                      midasModel.model
                    ) {
                      if (!globalThis.__pendingMidasTask) {
                        globalThis.__pendingMidasTask = {
                          type: 'SEARCH',
                          obj: searchResult.item,
                          targetName: searchTarget,
                        };
                      }
                    } else {
                      const spatialMessage = analyzeSpatialObject(
                        searchResult.item,
                        searchTarget,
                        globalThis.__lastDepthMap,
                        YOLO_SIZE,
                        MIDAS_SIZE,
                      );
                      scheduleOnRN(onSearchComplete, true, spatialMessage);
                    }
                  } else if (searchResult.status === 'NOT_FOUND') {
                    globalThis.__searchLocked = true;
                    scheduleOnRN(onSearchComplete, false, searchTarget);
                  }
                }
              } else if (isScanningGeneral) {
                const scanProcess = processGeneralScan(
                  parsedObject,
                  OBJECT365_LABELS_VI,
                  YOLO_SIZE,
                  SCAN_GENERAL_MAX_FRAMES,
                );
                if (scanProcess.status === 'DONE') {
                  scheduleOnRN(onGeneralScanComplete, scanProcess.result);
                }
              } else if (isObstacleActive) {
                const trackedObstacles = updateTracks(
                  parsedObject,
                  now,
                  OBSTACLE_WHITELIST,
                  YOLO_SIZE,
                );

                const { mostDangerousTarget, targetName } = gridWeighting(
                  trackedObstacles,
                  OBJECT365_LABELS_VI,
                  YOLO_SIZE,
                  globalThis.__lastThreatTarget || '',
                );
                const motionState = mostDangerousTarget
                  ? mostDangerousTarget.motion
                  : 'Tĩnh';

                if (mostDangerousTarget) {
                  globalThis.__lastThreatSeenTime = now;
                  const currentArea =
                    mostDangerousTarget.width * mostDangerousTarget.height;
                  const displayAlertName = analyzeThreat(
                    mostDangerousTarget,
                    targetName,
                    trackedObstacles,
                    YOLO_SIZE,
                  );
                  globalThis.__lastThreatTarget = targetName;

                  const timeSinceLastMidas =
                    now - (globalThis.__lastMidasTime || 0);
                  const isNewTarget =
                    targetName !== globalThis.__lastMidasTarget;

                  if (
                    timeSinceLastMidas > MIDAS_DELAY_MS ||
                    (isNewTarget &&
                      timeSinceLastMidas > MIDAS_NEW_TARGET_DELAY_MS)
                  ) {
                    globalThis.__pendingMidasTask = {
                      type: 'THREAT',
                      obj: mostDangerousTarget,
                      targetName: targetName,
                      displayAlertName: displayAlertName,
                      motionState: motionState,
                      currentArea: currentArea,
                    };
                  } else {
                    scheduleOnRN(
                      updateAlert,
                      targetName,
                      displayAlertName,
                      null,
                      motionState,
                      currentArea,
                    );
                  }
                } else {
                  const timeSinceLastSeen = now - (globalThis.__lastThreatSeenTime || 0);
                  if (globalThis.__lastThreatTarget !== '' && timeSinceLastSeen > ALERT_CLEAR_DELAY_MS) {
                    globalThis.__lastThreatTarget = '';
                    scheduleOnRN(clearAlert);
                  }
                }
              }

              if (!isObstacleActive && globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }
            }
          }
        } catch (e) {
          console.error('Error Worklet:', String(e));
        } finally {
          frame.dispose();
        }
      },
    },
    [
      isObstacleActive,
      searchTarget,
      isScanningGeneral,
      isScanningCurrency,
      isScanningText,
      isProcessingText,
      runTextRecognition,
    ],
  );

  return {
    frameOutput,
    fps,
    objectList,
    detectedObj,
    isModelsLoaded:
      yoloObjModel.state === 'loaded' &&
      midasModel.state === 'loaded' &&
      yoloCurrencyModel.state === 'loaded',
    debugImage,
  };
};
