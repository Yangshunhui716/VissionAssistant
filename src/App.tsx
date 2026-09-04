import { useEffect, useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-reanimated';

import { useFeedbackController } from './cores/useFeedbackController';
import { useVoiceCommand } from './cores/useVoiceCommand';
import { useVision, IS_DEBUG } from './cores/useVision';

import { UIOverlay } from './components/UIOverlay';
import { StatusScreen } from './components/StatusScreen';

import {
  startMotionGuard,
  stopMotionGuard,
} from './utils/sensorProcessor/motionDetector';
import { PROMPTS } from './utils/languageProcessor/feedbackPrompts';

const App: React.FC = () => {
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
  const [isObstacleActive, setIsObstacleActive] = useState(false);
  const [appState, setAppState] = useState('SLEEP');
  const [targetToFind, setTargetToFind] = useState(null);
  const [isScanningGeneral, setIsScanningGeneral] = useState(false);
  const [isScanningCurrency, setIsScanningCurrency] = useState(false);
  const [isScanningText, setIsScanningText] = useState(false);
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
    setIsScanningText
  );

  const handleSearchComplete = useCallback(
    (isFound: boolean, spatialMessage: string) => {
      setTargetToFind(null);
      if (isFound) playFeedback(PROMPTS.search.found(spatialMessage));
      else playFeedback(PROMPTS.search.notFound(spatialMessage));
    },
    [playFeedback, setTargetToFind],
  );

  const handleGeneralScanComplete = useCallback(
    (foundItems: string[]) => {
      setIsScanningGeneral(false);
      if (foundItems && foundItems.length > 0)
        playFeedback(PROMPTS.scan.result(foundItems[0]));
      else playFeedback(PROMPTS.scan.empty);
    },
    [playFeedback, setIsScanningGeneral],
  );

  const handleCurrencyScanComplete = useCallback(
    (currency: string) => {
      setIsScanningCurrency(false);
      if (currency) playFeedback(PROMPTS.currency.result(currency));
      else playFeedback(PROMPTS.currency.empty);
    },
    [playFeedback],
  );

  const handleTextScanComplete = useCallback(
    (text: string) => {
      setIsScanningText(false);
      if (text) playFeedback(PROMPTS.text.result(text));
      else playFeedback(PROMPTS.text.empty);
    },
    [playFeedback],
  );

  const handleThreatDetected = useCallback(
    (threatMessage: string) => {
      haptics.error();
      playFeedback(PROMPTS.alert.threat(threatMessage));
    },
    [playFeedback, haptics],
  );

  const handleFrameQuality = useCallback(
    (frameQualityReason: string) => {
      haptics.error();
      playFeedback(PROMPTS.alert.frameQuality(frameQualityReason));
    }, 
    [playFeedback, haptics]
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
    setIsScanningText
  );

  const activeFunction =
  isScanningText
    ? 'Văn bản'
    : isScanningCurrency
      ? 'Tiền tệ'
      : isScanningGeneral
        ? 'Đồ vật'
        : null;

  useEffect(() => {
    if (!hasCameraPermission) requestCameraPermission();
    if (!hasMicPermission) requestMicPermission();

    startMotionGuard(
      (isFast: boolean) => {
        isShaking.value = isFast;
      },
      () => {
        haptics.error();
        playFeedback(PROMPTS.alert.shaking);
      },
    );
    return () => stopMotionGuard();
  }, [
    hasCameraPermission,
    hasMicPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  if (!hasCameraPermission || !hasMicPermission)
    return <StatusScreen message="Vui lòng cấp quyền Camera & Microphone." />;
  if (camera == null)
    return <StatusScreen message="Đang khởi động Camera..." isLoading={true} />;
  if (!isModelsLoaded)
    return <StatusScreen message="Đang khởi động AI..." isLoading={true} />;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={camera}
        isActive={true}
        outputs={[frameOutput, photoOutput]}
        resizeMode="contain"
      />

      {IS_DEBUG && debugImage && (
      <View style={styles.debugContainer}>
        <Image
          source={{ uri: debugImage }}
          style={styles.debugImg}
          resizeMode="contain"
        />
      </View>
    )}

      <UIOverlay
        fps={IS_DEBUG ? fps : null}
        objectList={IS_DEBUG ? objectList : []}
        detectedObj={detectedObj}
        appState={appState}
        transcript={uiTranscript}
        activeFunction={activeFunction}
        isObstacleActive={isObstacleActive}
        onObstaclePress={() => {
          if (isObstacleActive) {
            setIsObstacleActive(false);
          } else {
            setIsObstacleActive(true);
          }
        }}

        onCurrencyPress={() => {
          setIsScanningCurrency(true);
        }}

        onObjectPress={() => {
          setIsScanningGeneral(true);
        }}

        onTextPress={() => {
          setIsScanningText(true);
        }}

        onMicPress={() => {
          if (appState === 'LISTENING') {
            manualStop();
          } else {
            manualWakeUp();
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },

  debugContainer: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    zIndex: 100,
    elevation: 100,
  },

  debugImg: {
    width: 150,
    height: 150,
    borderWidth: 3,
    borderColor: 'lime',
  },
});

export default App;
