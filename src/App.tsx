/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { scheduleOnRN } from 'react-native-worklets';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { resize } from './utils/imageResizer';

const App = () => {
  const camera = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const yoloModel =  useTensorflowModel(require('./assets/models/yolo11n.tflite'), []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const handleYoloModelResults = (detections: any[]) => {
    const targetObjects = detections.filter(item => item.label === 'pen');
    if (targetObjects.length > 0) {
      console.log('Đã tìm thấy cây bút! Số lượng:', targetObjects.length);
    }
  };

  function parseYoloOutput(rawOutputs: any[]) {
    'worklet';
    return []; 
  }

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame(frame){
      'worklet';

      try {
        if (yoloModel.state === 'loaded') {
          const t0 = Date.now();
          const frameData = new Uint8Array(frame.getPixelBuffer());
          const t1 = Date.now();
          const resizedData = resize(frameData, frame.width, frame.height, 640, 640);
          const t2 = Date.now();
          const outputs = yoloModel.model.runSync([resizedData.buffer]);
          const t3 = Date.now();

          console.log({
            getBuffer: t1 - t0,
            resize: t2 - t1,
            inference: t3 - t2,
            total: t3 - t0,
          });

          const floatArray = new Float32Array(outputs[0] as ArrayBuffer);
          console.log("CHIỀU DÀI MA TRẬN LÀ:", floatArray.length);

          const parsed = parseYoloOutput(outputs);
          scheduleOnRN(handleYoloModelResults, parsed);
        }
      } catch (e) {
        console.error("Error occurred:", String(e));
      }finally {
        frame.dispose();
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Vui lòng cấp quyền Camera để ứng dụng hoạt động.</Text>
      </View>
    );
  }

  if (camera == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Đang khởi động Camera...</Text>
      </View>
    );
  }

  if (yoloModel.state !== 'loaded') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Đang khởi động mô hình AI...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={camera}
        isActive={true}
        outputs={[frameOutput]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  text: {
    fontSize: 16,
    color: 'black',
    marginTop: 10,
  }
});

export default App;