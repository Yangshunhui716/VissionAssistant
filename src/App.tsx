import React, { useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { useFeedbackController } from './cores/useFeedbackController';
import { useVoiceCommand } from './cores/useVoiceCommand';
import { useVision } from './cores/useVision';

import { UIOverlay } from './components/UIOverlay';
import { StatusScreen } from './components/StatusScreen';

const App = () => {
  const camera = useCameraDevice('back');
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();

  const { uiTranscript, playFeedback, haptics, AI_PROMPTS } = useFeedbackController();

  const { appState, targetToFind, isScanningGeneral, setTargetToFind, setIsScanningGeneral, 
    manualWakeUp, manualStop  } = useVoiceCommand(hasMicPermission, playFeedback, haptics, AI_PROMPTS);


  const handleSearchComplete = useCallback((isFound: boolean, spatialMessage: string) => {
    setTargetToFind(null); 
    if (isFound) {
      haptics.success();
      playFeedback(AI_PROMPTS.search.found(spatialMessage));
    } else {
      playFeedback(AI_PROMPTS.search.notFound(spatialMessage));
    }
  }, [playFeedback, haptics, AI_PROMPTS, setTargetToFind]);


  const handleGeneralScanComplete = useCallback((foundItems: string[]) => {
    setIsScanningGeneral(false); 
    if (foundItems && foundItems.length > 0) {
      playFeedback(AI_PROMPTS.scan.result(foundItems[0]));
    } else {
      playFeedback(AI_PROMPTS.scan.empty);
    }
  }, [playFeedback, AI_PROMPTS, setIsScanningGeneral]);


  const handleThreatDetected = useCallback((threatMessage: string) => {
    haptics.error();
    playFeedback(AI_PROMPTS.threat.alert(threatMessage));
  }, [playFeedback, haptics, AI_PROMPTS]);


  const { frameOutput, fps, objectList, detectedObj, isModelsLoaded } = useVision(
    targetToFind, handleSearchComplete, isScanningGeneral, handleGeneralScanComplete, handleThreatDetected
  );

  useEffect(() => {
    if (!hasCameraPermission) requestCameraPermission();
    if (!hasMicPermission) requestMicPermission();
  }, [hasCameraPermission, hasMicPermission]);

  if (!hasCameraPermission || !hasMicPermission) return <StatusScreen message="Vui lòng cấp quyền Camera & Microphone." />;
  if (camera == null) return <StatusScreen message="Đang khởi động Camera..." isLoading={true} />;
  if (!isModelsLoaded) return <StatusScreen message="Đang khởi động AI..." isLoading={true} />;

  return (
    <TouchableOpacity 
      style={styles.container} activeOpacity={1} 
      onLongPress={() => { if (appState === 'SLEEP') manualWakeUp(); }}
      onPress={() => { if (appState === 'LISTENING') manualStop(); }}
    >
      <Camera 
        style={StyleSheet.absoluteFill} 
        device={camera} 
        isActive={true} 
        outputs={[frameOutput]} 
      />
      <UIOverlay 
        fps={fps} 
        objectList={objectList} 
        detectedObj={detectedObj} 
        appState={appState} 
        transcript={uiTranscript} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: 'black' } });
export default App;