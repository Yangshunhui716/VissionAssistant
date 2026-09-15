import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { useSharedValue } from 'react-native-reanimated';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { useRuntimeConfig } from '../context/RuntimeConfigContext';
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
import { FIXED_CONFIG, createBmpBase64 } from '../utils/config/defaultConfig';

const { YOLO_SIZE, MIDAS_SIZE } = FIXED_CONFIG;

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
  const { config } = useRuntimeConfig();
  const visionConfig = config.vision;
  const debugConfig = config.debug;
  const frameQualityConfig = config.frameQuality;
  const yoloConfig = config.yolo;
  const searchConfig = config.search;
  const generalScanConfig = config.generalScan;
  const currencyConfig = config.currency;
  const obstacleConfig = config.obstacle;
  const spatialConfig = config.spatial;

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
      if (
        prev.length === names.length &&
        prev.every((v, i) => v === names[i])
      ) {
        return prev;
      }
      return names;
    });
  };

  const clearAlert = () => {
    setDetectedObj(prev => {
      if (prev.name === '') {
        return prev;
      }
      return {
        name: '',
        depth: '',
        motion: '',
      };
    });
  };

  const getDepthLevel = text => {
    if (text === 'Dưới nửa mét') {
      return 4;
    }
    if (text === 'Khoảng 1 mét') {
      return 3;
    }
    if (text === 'Khoảng 2 mét') {
      return 2;
    }
    if (text === 'Khoảng 3 mét') {
      return 1;
    }
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
      depthText = translateDepthToText(realDepth, spatialConfig);
    } else {
      if (
        baseName === lastTargetName &&
        lastRealDepth > 0 &&
        lastRealArea > 0 &&
        currentArea > 0
      ) {
        const areaRatio = currentArea / lastRealArea;
        const estimatedRawDepth = lastRealDepth * Math.sqrt(areaRatio);
        depthText = translateDepthToText(estimatedRawDepth, spatialConfig);
      } else {
        depthText = 'Đang đo';
      }
    }
    setDetectedObj(prev => {
      if (
        prev.name === displayAlertName &&
        prev.depth === depthText &&
        prev.motion === motion
      ) {
        return prev;
      }
      return {
        name: displayAlertName,
        depth: depthText,
        motion,
      };
    });

    const currentDepthLevel = getDepthLevel(depthText);

    if (currentDepthLevel > 0) {
      const now = Date.now();
      const isDifferentTarget = baseName !== lastSpokenBaseName;
      const isCloser = currentDepthLevel > lastSpokenDepthLevel;
      const isTimeUp = now - lastSpokenTime > visionConfig.THREAT_COOLDOWN_MS;
      if (isDifferentTarget || isCloser || isTimeUp) {
        lastSpokenBaseName = baseName;
        lastSpokenDepthLevel = currentDepthLevel;
        lastSpokenTime = now;
        onThreatDetected(`${displayAlertName}, cách ${depthText}, ${motion}`);
      }
    } else {
      if (Date.now() - lastSpokenTime > visionConfig.THREAT_RESET_MS) {
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
      if (debugConfig.enabled) {
        setDebugImage(imageUri);
      }
      const text = result?.text?.trim() || '';
      onTextScanComplete(text);
    } catch (e) {
      if (debugConfig.logging) {
        console.error('Error OCR: ', e);
      }
      onTextScanComplete('');
    } finally {
      isProcessingText.value = false;
    }
  }, [photoOutput, onTextScanComplete, debugConfig.enabled, debugConfig.logging]);

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
            if (
              now - globalThis.__lastFpsTime >=
              visionConfig.FPS_UPDATE_INTERVAL_MS
            ) {
              if (debugConfig.enabled) {
                scheduleOnRN(updateFps, globalThis.__frameCount);
              }
              globalThis.__frameCount = 0;
              globalThis.__lastFpsTime = now;
            }

            if (isShaking.value) {
              globalThis.__lastMidasTime = 0;
              globalThis.__lastThreatTarget = '';
              globalThis.__lastMidasTarget = '';
              globalThis.__pendingMidasTask = null;
              scheduleOnRN(clearAlert);
              return;
            }

            let forceCapture = false;
            if (debugConfig.enabled && captureTrigger && captureTrigger.value) {
              forceCapture = true;
              captureTrigger.value = false;
            }

            const frameData = new Uint8Array(frame.getPixelBuffer());

            const frameQuality = analyzeFrameQuality(
              frameData,
              frame.width,
              frame.height,
              frameQualityConfig,
              debugConfig.qualityFrame,
            );

            if (frameQuality.isBad) {
              if (
                now - (globalThis.__lastBlockedWarnTime || 0) >
                visionConfig.BLOCKED_WARN_MS
              ) {
                globalThis.__lastBlockedWarnTime = now;
                scheduleOnRN(onFrameQuality, frameQuality.reason);
              }
              globalThis.__lastMidasTime = 0;
              globalThis.__lastThreatTarget = '';
              globalThis.__lastMidasTarget = '';
              globalThis.__pendingMidasTask = null;
              return;
            }

            if (isProcessingText.value) {
              isProcessingText.value = false;
              globalThis.__pendingMidasTask = null;
              if (globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }
              scheduleOnRN(runTextRecognition);
              return;
            }

            if (isScanningCurrency) {
              globalThis.__pendingMidasTask = null;
              if (globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }

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
                null,
              );

              const currencyOutputs = yoloCurrencyModel.model.runSync([
                yoloResized.buffer,
              ]);

              const parsedCurrency = parseYoloOutput(
                currencyOutputs,
                YOLO_SIZE,
                currencyConfig.SCORE_THRESHOLD,
                debugConfig.logging,
              );

              const resultCurrencyScan = processCurrencyScan(
                parsedCurrency,
                CURRENCY_LABELS_VI,
                currencyConfig,
              );

              if (resultCurrencyScan.done) {
                scheduleOnRN(
                  onCurrencyScanComplete,
                  resultCurrencyScan.result,
                );
              }

              return;
            } else {
              resetCurrencyScan();
            }

            if (globalThis.__pendingMidasTask) {
              const task = globalThis.__pendingMidasTask;
              globalThis.__pendingMidasTask = null;
              const midasBounds = {
                padX: 0,
                padY: 0,
                newW: MIDAS_SIZE,
                newH: MIDAS_SIZE,
                dstW: MIDAS_SIZE,
                dstH: MIDAS_SIZE,
              };
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
                null,
                midasBounds,
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
                    task.yoloBounds,
                    midasBounds,
                    spatialConfig,
                    debugConfig.logging,
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
                    task.yoloBounds,
                    midasBounds,
                    spatialConfig,
                  );
                  scheduleOnRN(onSearchComplete, true, spatialMessage);
                }
              }
              return;
            }

            if (!searchTarget) {
              resetSearch();
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

              if (debugConfig.enabled) {
                scheduleOnRN(updateList, []);
                scheduleOnRN(updateDebugImage, null);
              }
              return;
            }

            if (
              !globalThis.__lastProcessTime ||
              now - globalThis.__lastProcessTime > visionConfig.PROCESS_DELAY_MS
            ) {
              globalThis.__lastProcessTime = now;

              const reportData = forceCapture ? {} : null;

              const yoloBounds = {
                padX: 0,
                padY: 0,
                newW: YOLO_SIZE,
                newH: YOLO_SIZE,
                dstW: YOLO_SIZE,
                dstH: YOLO_SIZE,
              };

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
                yoloBounds,
              );

              const objectOutputs = yoloObjModel.model.runSync([
                yoloResized.buffer,
              ]);

              const parsedObject = parseYoloOutput(
                objectOutputs,
                YOLO_SIZE,
                yoloConfig.CONFIDENCE_THRESHOLD,
                debugConfig.logging,
              );

              if (debugConfig.enabled) {
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
                  now - globalThis.__lastDumpTime >
                    visionConfig.DEBUG_DUMP_INTERVAL_MS
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

                  const midasBounds = {
                    padX: 0,
                    padY: 0,
                    newW: MIDAS_SIZE,
                    newH: MIDAS_SIZE,
                    dstW: MIDAS_SIZE,
                    dstH: MIDAS_SIZE,
                  };

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
                    null,
                    midasBounds,
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
                    if (rawDepth[i] < minDepth) {
                      minDepth = rawDepth[i];
                    }
                    if (rawDepth[i] > maxDepth) {
                      maxDepth = rawDepth[i];
                    }
                  }

                  const depthRange = maxDepth - minDepth || 1;

                  for (let i = 0; i < rawDepth.length; i++) {
                    const v = Math.max(
                      0,
                      Math.min(1, (rawDepth[i] - minDepth) / depthRange),
                    );

                    let r;
                    let g;
                    let b;

                    if (v < 0.25) {
                      const t = v / 0.25;
                      r = Math.round(13 + (126 - 13) * t);
                      g = Math.round(8 + (3 - 8) * t);
                      b = Math.round(135 + (167 - 135) * t);
                    } else if (v < 0.5) {
                      const t = (v - 0.25) / 0.25;
                      r = Math.round(126 + (204 - 126) * t);
                      g = Math.round(3 + (71 - 3) * t);
                      b = Math.round(167 + (120 - 167) * t);
                    } else if (v < 0.75) {
                      const t = (v - 0.5) / 0.25;
                      r = Math.round(204 + (248 - 204) * t);
                      g = Math.round(71 + (149 - 71) * t);
                      b = Math.round(120 + (64 - 120) * t);
                    } else {
                      const t = (v - 0.75) / 0.25;
                      r = Math.round(248 + (240 - 248) * t);
                      g = Math.round(149 + (249 - 149) * t);
                      b = Math.round(64 + (33 - 64) * t);
                    }

                    depthPixels[i * 3] = r;
                    depthPixels[i * 3 + 1] = g;
                    depthPixels[i * 3 + 2] = b;
                  }

                  const scaledBoxes = parsedObject.map(box => {
                    const normalizedX =
                      (box.x - yoloBounds.padX) / yoloBounds.newW;
                    const normalizedY =
                      (box.y - yoloBounds.padY) / yoloBounds.newH;
                    const normalizedW = box.width / yoloBounds.newW;
                    const normalizedH = box.height / yoloBounds.newH;

                    return {
                      x: midasBounds.padX + normalizedX * midasBounds.newW,
                      y: midasBounds.padY + normalizedY * midasBounds.newH,
                      width: normalizedW * midasBounds.newW,
                      height: normalizedH * midasBounds.newH,
                      labelIdx: box.labelIdx,
                      score: box.score,
                    };
                  });

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
                    searchConfig,
                  );

                  if (searchResult.status === 'FOUND') {
                    globalThis.__searchLocked = true;
                    const timeSinceLastMidas =
                      now - (globalThis.__lastMidasTime || 0);

                    if (
                      (!globalThis.__lastDepthMap ||
                        timeSinceLastMidas > visionConfig.MIDAS_SEARCH_INTERVAL_MS) &&
                      midasModel.model
                    ) {
                      if (!globalThis.__pendingMidasTask) {
                        globalThis.__pendingMidasTask = {
                          type: 'SEARCH',
                          obj: searchResult.item,
                          targetName: searchTarget,
                          yoloBounds: {
                            padX: yoloBounds.padX,
                            padY: yoloBounds.padY,
                            newW: yoloBounds.newW,
                            newH: yoloBounds.newH,
                            dstW: yoloBounds.dstW,
                            dstH: yoloBounds.dstH,
                          },
                        };
                      }
                    } else {
                      const spatialMessage = analyzeSpatialObject(
                        searchResult.item,
                        searchTarget,
                        globalThis.__lastDepthMap,
                        yoloBounds,
                        {
                          padX: 0,
                          padY: 0,
                          newW: MIDAS_SIZE,
                          newH: MIDAS_SIZE,
                          dstW: MIDAS_SIZE,
                          dstH: MIDAS_SIZE,
                        },
                        spatialConfig,
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
                  yoloBounds,
                  generalScanConfig,
                );
                if (scanProcess.status === 'DONE') {
                  scheduleOnRN(onGeneralScanComplete, scanProcess.result);
                }
              } else if (isObstacleActive) {
                const trackedObstacles = updateTracks(
                  parsedObject,
                  now,
                  OBSTACLE_WHITELIST,
                  yoloBounds,
                  obstacleConfig,
                );

                const { mostDangerousTarget, targetName } = gridWeighting(
                  trackedObstacles,
                  OBJECT365_LABELS_VI,
                  globalThis.__lastThreatTarget,
                  obstacleConfig,
                  yoloBounds
                );

                const motionState = mostDangerousTarget
                  ? mostDangerousTarget.motion
                  : 'Tĩnh';

                if (mostDangerousTarget) {
                  globalThis.__lastThreatSeenTime = now;
                  globalThis.__lastThreatTarget = targetName;

                  const displayAlertName = analyzeThreat(
                    mostDangerousTarget,
                    targetName,
                    trackedObstacles,
                    obstacleConfig,
                    yoloBounds,
                    spatialConfig,
                  );

                  const currentArea =
                    mostDangerousTarget.width * mostDangerousTarget.height;

                  const timeSinceLastMidas =
                    now - (globalThis.__lastMidasTime || 0);
                  const isNewTarget =
                    targetName !== globalThis.__lastMidasTarget;

                  if (
                    timeSinceLastMidas > visionConfig.MIDAS_DELAY_MS ||
                    (isNewTarget &&
                      timeSinceLastMidas > visionConfig.MIDAS_NEW_TARGET_DELAY_MS)
                  ) {
                    globalThis.__pendingMidasTask = {
                      type: 'THREAT',
                      obj: mostDangerousTarget,
                      targetName: targetName,
                      displayAlertName: displayAlertName,
                      motionState: motionState,
                      currentArea: currentArea,
                      yoloBounds: {
                        padX: yoloBounds.padX,
                        padY: yoloBounds.padY,
                        newW: yoloBounds.newW,
                        newH: yoloBounds.newH,
                        dstW: yoloBounds.dstW,
                        dstH: yoloBounds.dstH,
                      },
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
                  const timeSinceLastSeen =
                    now - (globalThis.__lastThreatSeenTime || 0);

                  if (
                    globalThis.__lastThreatTarget !== '' &&
                    timeSinceLastSeen > visionConfig.ALERT_CLEAR_DELAY_MS
                  ) {
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
          if (debugConfig.logging) {
            console.error('Error Worklet:', String(e));
          }
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
      visionConfig,
      debugConfig,
      frameQualityConfig,
      yoloConfig,
      searchConfig,
      generalScanConfig,
      currencyConfig,
      obstacleConfig,
      spatialConfig,
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
