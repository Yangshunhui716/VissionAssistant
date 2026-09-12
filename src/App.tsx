import { useEffect, useCallback, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-reanimated';
import RNFS from 'react-native-fs';

import {
  RuntimeConfigProvider,
  useRuntimeConfig,
} from './context/RuntimeConfigContext';

import { useFeedbackController } from './cores/useFeedbackController';
import { useVoiceCommand } from './cores/useVoiceCommand';
import { useVision } from './cores/useVision';

import { StatusScreen } from './components/StatusScreen';
import { UIOverlay } from './components/UIOverlay';
import { DebugOverlay } from './components/DebugOverlay';
import { DebugPanel } from './components/DebugPanel';

import {
  startMotionGuard,
  stopMotionGuard,
} from './utils/sensorProcessor/motionDetector';
import { PROMPTS } from './utils/languageProcessor/feedbackPrompts';

const AppContent: React.FC = () => {
  const camera = useCameraDevice('back');
  const photoOutput = usePhotoOutput();

  const {
    hasPermission: hasCameraPermission,
    requestPermission: requestCameraPermission,
  } = useCameraPermission();

  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  const isShaking = useSharedValue<boolean>(false);
  const captureTrigger = useSharedValue<boolean>(false);

  const [appState, setAppState] = useState('SLEEP');
  const [isObstacleActive, setIsObstacleActive] = useState(true);
  const [targetToFind, setTargetToFind] = useState(null);
  const [isScanningGeneral, setIsScanningGeneral] = useState(false);
  const [isScanningCurrency, setIsScanningCurrency] = useState(false);
  const [isScanningText, setIsScanningText] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const obstacleWasActiveRef = useRef(false);

  const { config, isLoaded } = useRuntimeConfig();

  const { uiTranscript, playFeedback, haptics } = useFeedbackController();

  const { manualWakeUp, manualStop } = useVoiceCommand(
    hasMicPermission,
    playFeedback,
    haptics,
    setAppState,
    setIsObstacleActive,
    setTargetToFind,
    setIsScanningGeneral,
    setIsScanningCurrency,
    setIsScanningText,
  );

  const handleSearchComplete = useCallback(
    (isFound: boolean, spatialMessage: string) => {
      setTargetToFind(null);

      if (isFound) {
        playFeedback(PROMPTS.find.found(spatialMessage));
      } else {
        playFeedback(PROMPTS.find.notFound(spatialMessage));
      }
    },
    [playFeedback],
  );

  const handleGeneralScanComplete = useCallback(
    (foundItems: string[]) => {
      setIsScanningGeneral(false);

      if (foundItems && foundItems.length > 0) {
        playFeedback(PROMPTS.scan.result(foundItems[0]));
      } else {
        playFeedback(PROMPTS.scan.empty);
      }
    },
    [playFeedback, isObstacleActive],
  );

  const handleCurrencyScanComplete = useCallback(
    (currency: string) => {
      setIsScanningCurrency(false);

      if (currency) {
        playFeedback(PROMPTS.currency.result(currency));
      } else {
        playFeedback(PROMPTS.currency.empty);
      }
    },
    [playFeedback],
  );

  const handleTextScanComplete = useCallback(
    (text: string) => {
      setIsScanningText(false);

      if (text) {
        playFeedback(PROMPTS.text.result(text));
      } else {
        playFeedback(PROMPTS.text.empty);
      }
    },
    [playFeedback],
  );

  const handleThreatDetected = useCallback(
    (threatMessage: string) => {
      haptics.error();
      playFeedback(PROMPTS.obstacle.threat(threatMessage));
    },
    [playFeedback, haptics],
  );

  const handleFrameQuality = useCallback(
    (frameQualityReason: string) => {
      haptics.error();
      playFeedback(PROMPTS.alert.frameQuality(frameQualityReason));
    },
    [playFeedback, haptics],
  );

  const handleCaptureReportComplete = useCallback(
    async (
      original: string,
      rotated: string,
      scaled: string,
      padding: string,
      yoloBmp: string,
      depthBmp: string,
    ) => {
      try {
        const dir =
          Platform.OS === 'android'
            ? RNFS.ExternalDirectoryPath
            : RNFS.DocumentDirectoryPath;

        const ts = Date.now();

        await RNFS.writeFile(
          `${dir}/${ts}_1_ORI.bmp`,
          original.replace('data:image/bmp;base64,', ''),
          'base64',
        );

        await RNFS.writeFile(
          `${dir}/${ts}_2_ROTATE.bmp`,
          rotated.replace('data:image/bmp;base64,', ''),
          'base64',
        );

        await RNFS.writeFile(
          `${dir}/${ts}_3_SCALE.bmp`,
          scaled.replace('data:image/bmp;base64,', ''),
          'base64',
        );

        await RNFS.writeFile(
          `${dir}/${ts}_4_PADDING.bmp`,
          padding.replace('data:image/bmp;base64,', ''),
          'base64',
        );

        await RNFS.writeFile(
          `${dir}/${ts}_5_YOLO.bmp`,
          yoloBmp.replace('data:image/bmp;base64,', ''),
          'base64',
        );

        await RNFS.writeFile(
          `${dir}/${ts}_6_MIDAS.bmp`,
          depthBmp.replace('data:image/bmp;base64,', ''),
          'base64',
        );

        console.log(`Đã lưu 6 ảnh vào:\n${dir}`);

        playFeedback({
          ui: `Đã lưu 6 ảnh vào:\n${dir}`,
          tts: null,
          priority: 1,
        });
      } catch (e) {
        console.error('Lỗi lưu ảnh:', e);
      }
    },
    [playFeedback],
  );

  const {
    frameOutput,
    fps,
    objectList,
    detectedObj,
    isModelsLoaded,
    debugImage,
  } = useVision(
    photoOutput,
    isObstacleActive,
    targetToFind,
    handleSearchComplete,
    isScanningGeneral,
    handleGeneralScanComplete,
    isScanningCurrency,
    handleCurrencyScanComplete,
    isScanningText,
    handleTextScanComplete,
    handleThreatDetected,
    handleFrameQuality,
    isShaking,
    captureTrigger,
    handleCaptureReportComplete,
  );

  const activeFunction = targetToFind
    ? 'Tìm kiếm'
    : isScanningText
    ? 'Văn bản'
    : isScanningCurrency
    ? 'Tiền tệ'
    : isScanningGeneral
    ? 'Đồ vật'
    : null;

  useEffect(() => {
    if (!hasCameraPermission) {
      requestCameraPermission();
    }

    if (!hasMicPermission) {
      requestMicPermission();
    }

    startMotionGuard(
      (isFast: boolean) => {
        isShaking.value = isFast;
      },
      () => {
        haptics.error();
        playFeedback(PROMPTS.alert.shaking);
      },
      config.motion,
    );

    return () => stopMotionGuard();
  }, [
    hasCameraPermission,
    hasMicPermission,
    requestCameraPermission,
    requestMicPermission,
    config.motion,
    haptics,
    playFeedback,
    isShaking,
  ]);

  useEffect(() => {
    if (activeFunction) {
      if (isObstacleActive) {
        obstacleWasActiveRef.current = true;
        setIsObstacleActive(false);
        playFeedback(PROMPTS.obstacle.tmpOff);
      }
      if (targetToFind) {
        playFeedback(PROMPTS.find.start(targetToFind));
      }
      if(isScanningGeneral) {
        playFeedback(PROMPTS.scan.start);
      }
      if(isScanningCurrency) {
        playFeedback(PROMPTS.currency.start);
      }
      if(isScanningText) {
        playFeedback(PROMPTS.text.start);
      }
    } else {
      if (obstacleWasActiveRef.current) {
        obstacleWasActiveRef.current = false;
        setIsObstacleActive(true);
        playFeedback(PROMPTS.obstacle.on);
      }
    }
  }, [activeFunction, isObstacleActive, playFeedback]);

  if (!hasCameraPermission || !hasMicPermission) {
    return <StatusScreen message="Vui lòng cấp quyền Camera & Microphone." />;
  }

  if (camera == null) {
    return <StatusScreen message="Đang khởi động Camera..." isLoading={true} />;
  }

  if (!isModelsLoaded || !isLoaded) {
    return <StatusScreen message="Đang khởi động Trợ lý..." isLoading={true} />;
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={camera}
        isActive={true}
        outputs={[frameOutput, photoOutput]}
        resizeMode="contain"
      />

      <DebugOverlay
        fps={fps}
        objectList={objectList}
        showFps={config.debug.showFps}
        showObjects={config.debug.showObjects}
        debugImage={config.debug.showImage ? debugImage : null}
        onCapturePress={() => {
          captureTrigger.value = true;
        }}
        debug={config.debug.enabled}
      />

      <DebugPanel
        visible={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />

      <UIOverlay
        detectedObj={detectedObj}
        appState={appState}
        transcript={uiTranscript}
        activeFunction={activeFunction}
        isObstacleActive={isObstacleActive}
        onObstaclePress={() => {
          if (!isObstacleActive) {
            setTargetToFind(null);
            setIsScanningGeneral(false);
            setIsScanningText(false);
            setIsScanningCurrency(false);
            setIsObstacleActive(true);
            playFeedback(PROMPTS.obstacle.on);
          } else {
            setIsObstacleActive(false);
            playFeedback(PROMPTS.obstacle.off);
          }
        }}
        onCurrencyPress={() => {
          if (!isScanningCurrency) {
            setIsScanningCurrency(true);
            setIsScanningGeneral(false);
            setIsScanningText(false);
            setTargetToFind(null);
          } else {
            setIsScanningCurrency(false);
          }
        }}
        onObjectPress={() => {
          if (!isScanningGeneral) {
            setIsScanningGeneral(true);
            setIsScanningCurrency(false);
            setIsScanningText(false);
            setTargetToFind(null);
          } else {
            setIsScanningGeneral(false);
          }
        }}
        onTextPress={() => {
          if (!isScanningText) {
            setIsScanningText(true);
            setIsScanningGeneral(false);
            setIsScanningCurrency(false);
            setTargetToFind(null);
          } else {
            setIsScanningText(false);
          }
        }}
        onMicPress={() => {
          if (appState === 'LISTENING') {
            manualStop();
          } else {
            manualWakeUp();
          }
        }}
        onSettingsPress={() => setShowDebugPanel(true)}
      />
    </View>
  );
};

const App: React.FC = () => {
  return (
    <RuntimeConfigProvider>
      <AppContent />
    </RuntimeConfigProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});

export default App;
