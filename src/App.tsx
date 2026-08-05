import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { useVision } from './cores/useVision';
import { useAudio } from './cores/useAudio';
import { useCommandParser } from './cores/useCommandParser';
import { UIOverlay } from './components/UIOverlay';
import { StatusScreen } from './components/StatusScreen';

const App = () => {
  const camera = useCameraDevice('back');
  
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  
  const { targetToFind, isScanningGeneral, searchFeedback, onSearchComplete, onGeneralScanComplete, processCommand } = useCommandParser();
  const { frameOutput, fps, objectList, detectedObj, isModelsLoaded } = useVision(targetToFind, onSearchComplete, isScanningGeneral, onGeneralScanComplete);
  const { appState, transcript, manualWakeUp, manualStop } = useAudio(hasMicPermission); 

  useEffect(() => {
    if (!hasCameraPermission) requestCameraPermission();
    if (!hasMicPermission) requestMicPermission();
  }, [hasCameraPermission, hasMicPermission]);

  useEffect(() => {
    if (appState === 'PROCESSING') {
      processCommand(transcript);
    }
  }, [appState, transcript, processCommand]);

  if (!hasCameraPermission || !hasMicPermission) {
    return <StatusScreen message="Vui lòng cấp quyền Camera & Microphone." />;
  }
  if (camera == null) {
    return <StatusScreen message="Đang khởi động Camera..." isLoading={true} />;
  }
  if (!isModelsLoaded) {
    return <StatusScreen message="Đang khởi động mô hình AI (YOLO & MiDaS)..." isLoading={true} />;
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={1} 
      onLongPress={() => {
        if (appState === 'SLEEP') {
          Vibration.vibrate(100);
          manualWakeUp();         
        }
      }}
      onPress={() => { 
        if (appState === 'LISTENING') {
          manualStop();
        }
      }}
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
        transcript={searchFeedback || transcript} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});

export default App;