import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { resize, createBmpBase64 } from '../utils/frameProcessor/frameResizer';
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
import { processCurrencyScan, resetCurrencyScan } from '../utils/recognitionProcessor/currencyScan';
import {
  getDepthFromMidas,
  translateDepthToText,
} from '../utils/spatialProcessor/depthCalculator';
import { analyzeSpatialObject } from '../utils/spatialProcessor/spatialAnalyzer';
import { gridWeighting } from '../utils/obstacleAnalyzer/gridWeighting';
import { updateTracks } from '../utils/obstacleAnalyzer/objectTracker';
import { analyzeThreat } from '../utils/obstacleAnalyzer/threatAnalyzer';
import { analyzeCameraQuality } from '../utils/frameProcessor/frameAnalyzer';

export const IS_DEBUG = false;

const YOLO_SIZE = 320;
const MIDAS_SIZE = 256;

const PROCESS_DELAY_MS = 250;
const MIDAS_DELAY_MS = 2000;
const BLOCKED_WARN_MS = 6000;

const aiDelegates =
  Platform.OS === 'ios' ? ['core-ml', 'metal'] : ['android-gpu'];
const yoloBuffer = new Float32Array(YOLO_SIZE * YOLO_SIZE * 3);
const midasBuffer = new Float32Array(MIDAS_SIZE * MIDAS_SIZE * 3);
let lastRealDepth = 0;
let lastRealArea = 0;
let lastTargetName = '';

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
  setIsScanningText,
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

  const [fps, setFps] = useState(0);
  const [objectList, setObjectList] = useState([]);
  const [detectedObj, setDetectedObj] = useState({
    name: '',
    depth: '',
    motion: '',
  });

  const isProcessingTextRef = useRef(false);

  const [debugImage, setDebugImage] = useState(null);
  const updateDebugImage = b64 => {
    setDebugImage(b64);
  };

  const updateFps = newFps => {
    setFps(prev => (prev === newFps ? prev : newFps));
  };
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

  const lastSpokenThreatRef = useRef('');
  const lastSpokenTimeRef = useRef(0);

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
        depthText = 'Đang đo...';
      }
    }

    setDetectedObj(prev => {
      if (
        prev.name === displayAlertName &&
        prev.depth === depthText &&
        prev.motion === motion
      )
        return prev;
      return { name: displayAlertName, depth: depthText, motion };
    });

    if (
      depthText === 'dưới nửa mét' ||
      depthText === 'khoảng 1 mét' ||
      depthText === 'khoảng 2 mét'
    ) {
      const now = Date.now();
      if (
        displayAlertName !== lastSpokenThreatRef.current ||
        now - lastSpokenTimeRef.current > 4000
      ) {
        lastSpokenThreatRef.current = displayAlertName;
        lastSpokenTimeRef.current = now;
        onThreatDetected(`${displayAlertName}, cách ${depthText}`);
      }
    }
  };

  const runTextRecognition = useCallback(async () => {
    setIsScanningText(false);

    if (isProcessingTextRef.current) {
      return;
    }

    if (!photoOutput) {
      onTextScanComplete('');
      return;
    }

    try {
      isProcessingTextRef.current = true;
      const captureStart = Date.now();
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

      setDebugImage(imageUri);

      const text = result?.text?.trim() || '';

      if (text) {
        onTextScanComplete(text);
      } else {
        onTextScanComplete('');
      }

    } catch (error) {
      console.error('[OCR] ERROR =', error);
      console.error(
        '[OCR] ERROR STRING =',
        error instanceof Error ? error.message : String(error),
      );

      onTextScanComplete('');

    } finally {
      setIsScanningText(false);
      isProcessingTextRef.current = false;
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

            if (isShaking.value) {
              globalThis.__lastMidasTime = 0;
              globalThis.__lastThreatTarget = '';
              globalThis.__lastMidasTarget = '';
              scheduleOnRN(clearAlert);
              return;
            }

            const frameData = new Uint8Array(frame.getPixelBuffer());

            const frameQuality = analyzeCameraQuality(
              frameData,
              frame.width,
              frame.height,
              frame.bytesPerRow,
            );

            if (frameQuality.isBad) {
              if (
                now - (globalThis.__lastBlockedWarnTime || 0) >
                BLOCKED_WARN_MS
              ) {
                globalThis.__lastBlockedWarnTime = now;
                scheduleOnRN(onFrameQuality, frameQuality.reason);
              }
              globalThis.__lastMidasTime = 0;
              globalThis.__lastThreatTarget = '';
              globalThis.__lastMidasTarget = '';
              return;
            }

            if (isScanningText) {
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

              const midasResized = resize(
                frameData,
                frame.width,
                frame.height,
                MIDAS_SIZE,
                MIDAS_SIZE,
                midasBuffer,
                'HWC',
                frame.orientation,
                frame.isMirrored,
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

                const yoloResized = resize(
                  frameData,
                  frame.width,
                  frame.height,
                  YOLO_SIZE,
                  YOLO_SIZE,
                  yoloBuffer,
                  'CHW',
                  frame.orientation,
                  frame.isMirrored,
                );

                const currencyOutputs = yoloCurrencyModel.model.runSync([
                  yoloResized.buffer,
                ]);
                const parsedCurrency = parseYoloOutput(
                  currencyOutputs,
                  YOLO_SIZE,
                  IS_DEBUG,
                );
                const resultCurrencyScan = processCurrencyScan(
                  parsedCurrency,
                  CURRENCY_LABELS_VI,
                );

                if (resultCurrencyScan) {
                  globalThis.__currencyStartTime = now;

                  if (
                    !globalThis.__lastMoneySpeakTime ||
                    now - globalThis.__lastMoneySpeakTime > 4000
                  ) {
                    globalThis.__lastMoneySpeakTime = now;
                    scheduleOnRN(onCurrencyScanComplete, resultCurrencyScan);
                  }
                } else {
                  if (now - globalThis.__currencyStartTime > 6000) {
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

            if (!hasOnDemandObjectTask && !isObstacleActive) {
              if (globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }
              return;
            }

            if (
              !globalThis.__lastProcessTime ||
              now - globalThis.__lastProcessTime > PROCESS_DELAY_MS
            ) {
              globalThis.__lastProcessTime = now;

              const yoloResized = resize(
                frameData,
                frame.width,
                frame.height,
                YOLO_SIZE,
                YOLO_SIZE,
                yoloBuffer,
                'CHW',
                frame.orientation,
                frame.isMirrored,
              );

              const objectOutputs = yoloObjModel.model.runSync([
                yoloResized.buffer,
              ]);
              const parsed = parseYoloOutput(
                objectOutputs,
                YOLO_SIZE,
                IS_DEBUG,
              );

              if (IS_DEBUG) {
                if (
                  !globalThis.__lastDumpTime ||
                  now - globalThis.__lastDumpTime > 3000
                ) {
                  globalThis.__lastDumpTime = now;
                  const b64 = createBmpBase64(
                    yoloBuffer,
                    YOLO_SIZE,
                    YOLO_SIZE,
                    'CHW',
                    parsed,
                  );
                  scheduleOnRN(updateDebugImage, b64);
                }
              }

              if (searchTarget) {
                if (globalThis.__lastSearchTarget !== searchTarget) {
                  globalThis.__lastSearchTarget = searchTarget;
                  globalThis.__searchLocked = false;
                }

                if (!globalThis.__searchLocked) {
                  const searchResult = processSearch(
                    parsed,
                    searchTarget,
                    OBJECT365_LABELS_VI,
                    5,
                  );
                  if (searchResult.status === 'FOUND') {
                    globalThis.__searchLocked = true;
                    const timeSinceLastMidas =
                      now - (globalThis.__lastMidasTime || 0);

                    if (
                      (!globalThis.__lastDepthMap ||
                        timeSinceLastMidas > 1000) &&
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
                  parsed,
                  OBJECT365_LABELS_VI,
                  YOLO_SIZE,
                  10,
                );
                if (scanProcess.status === 'DONE') {
                  scheduleOnRN(onGeneralScanComplete, scanProcess.result);
                }
              } else if (isObstacleActive) {
                const trackedObstacles = updateTracks(
                  parsed,
                  now,
                  OBJECT365_LABELS_VI,
                  OBSTACLE_WHITELIST,
                  YOLO_SIZE,
                );

                if (IS_DEBUG) {
                  if (trackedObstacles.length > 0) {
                    const currentNames = trackedObstacles.map(
                      obj => OBJECT365_LABELS_VI[obj.labelIdx],
                    );
                    scheduleOnRN(updateList, [...new Set(currentNames)]);
                  } else {
                    scheduleOnRN(updateList, []);
                  }
                }

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
                  const currentArea =
                    mostDangerousTarget.width * mostDangerousTarget.height;
                  const displayAlertName = analyzeThreat(
                    mostDangerousTarget,
                    targetName,
                    trackedObstacles,
                    OBJECT365_LABELS_VI,
                    YOLO_SIZE,
                  );
                  globalThis.__lastThreatTarget = targetName;

                  const timeSinceLastMidas =
                    now - (globalThis.__lastMidasTime || 0);
                  const isNewTarget =
                    targetName !== globalThis.__lastMidasTarget;

                  if (
                    timeSinceLastMidas > MIDAS_DELAY_MS ||
                    (isNewTarget && timeSinceLastMidas > 500)
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
                  globalThis.__lastThreatTarget = '';
                  scheduleOnRN(clearAlert);
                }
              }

              if (!isObstacleActive && globalThis.__lastThreatTarget !== '') {
                globalThis.__lastThreatTarget = '';
                scheduleOnRN(clearAlert);
              }
            }

            globalThis.__frameCount = (globalThis.__frameCount || 0) + 1;
            globalThis.__lastFpsTime = globalThis.__lastFpsTime || Date.now();
            if (now - globalThis.__lastFpsTime >= 1000) {
              if (IS_DEBUG) scheduleOnRN(updateFps, globalThis.__frameCount);
              globalThis.__frameCount = 0;
              globalThis.__lastFpsTime = now;
            }
          }
        } catch (e) {
          console.error('Lỗi Worklet:', String(e));
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
