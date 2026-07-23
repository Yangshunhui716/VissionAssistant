import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { useVision } from './cores/useVision';
import { useAudio } from './cores/useAudio';
import { UIOverlay } from './components/UIOverlay';
import { StatusScreen } from './components/StatusScreen';

const App = () => {
  const camera = useCameraDevice('back');
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  
  const { frameOutput, fps, objectList, detectedObj, isModelsLoaded } = useVision();
  const { appState, transcript, manualStop } = useAudio(hasMicPermission);

  useEffect(() => {
    if (!hasCameraPermission) requestCameraPermission();
    if (!hasMicPermission) requestMicPermission();
  }, [hasCameraPermission, hasMicPermission]);

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
        transcript={transcript}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});

export default App;