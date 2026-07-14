/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState, useRef } from 'react';
import { Platform, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTensorflowModel, TensorflowModelDelegate } from 'react-native-fast-tflite';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { resize } from './utils/frameProcessor/frameResizer';
import { parseYoloOutput } from './utils/recognitionProcessor/yoloParser';
import { COCO_LABELS } from './utils/recognitionProcessor/cocoLabels';
import { getDepthFromMidas } from './utils/depthProcessor/depthCalculator';

const App = () => {
  const aiDelegates: TensorflowModelDelegate[] = (Platform.OS === 'ios') ? ['core-ml', 'metal'] : ['android-gpu', 'nnapi'];
  const yoloModel = useTensorflowModel(require('./assets/models/yolo11n.tflite'), aiDelegates);
  const midasModel = useTensorflowModel(require('./assets/models/midas.tflite'), aiDelegates);
  
  const camera = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const yoloBuffer = new Float32Array(320 * 320 * 3);
  const midasBuffer = new Float32Array(256 * 256 * 3);

  const [fps, setFps] = useState(0);
  const updateFps = (newFps: number) => setFps(newFps);

  const [objectList, setObjectList] = useState<string[]>([]);
  const updateList = (name: string[]) => setObjectList(name);
  const [detectedObj, setDetectedObj] = useState<{name: string, depth: number} | { name: 'Không phát hiện', depth: 0 }>({ name: 'Không phát hiện', depth: 0 });
  const updateAlert = (name: string, depth: number) => setDetectedObj({ name, depth });
  const clearAlert = () => setDetectedObj({ name: 'Không phát hiện', depth: 0 });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  const runMidasInBackground = (copiedMidasArray: Float32Array, targetObj: any) => {
    setTimeout(() => {
      try {
        if (midasModel.model) {
          // const midasStart = Date.now();
          const midasOutputs = midasModel.model.runSync([copiedMidasArray.buffer as ArrayBuffer]);
          // const runMidasTime = Date.now() - midasStart;
          
          // const depthStart = Date.now();
          const depthMap = new Float32Array(midasOutputs[0]); 
          const rawDepth = getDepthFromMidas(targetObj, depthMap);
          // const depthTime = Date.now() - depthStart;
          
          updateAlert('Con người', rawDepth);

          // console.log(`\n[JS THREAD] --- BÁO CÁO MIDAS (CHẠY NGẦM) ---`);
          // console.log(`4. MiDaS Chạy mô hình: ${runMidasTime} ms`);
          // console.log(`5. Nội suy Depth: ${depthTime} ms`);
          // console.log(`>> TỔNG THỜI GIAN BACKGROUND: ${runMidasTime + depthTime} ms`);
          // console.log(`-------------------------------------------\n`);
        }
      } catch (error) {
        console.error("Lỗi khi chạy MiDaS ngầm:", error);
      }
    }, 0);
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame(frame){
      'worklet';
      try {
        if (yoloModel.state === 'loaded' && midasModel.state === 'loaded') {
          const global = globalThis as any;
          const now = Date.now();
          
          if (!global.lastProcessTime || now - global.lastProcessTime > 200) {
            global.lastProcessTime = now;

            const frameData = new Uint8Array(frame.getPixelBuffer());

            // const yoloStart = Date.now();
            const yoloResized = resize(frameData, frame.width, frame.height, 320, 320, frame.bytesPerRow, yoloBuffer, 'CHW');
            // const resizeYoloTime = Date.now() - yoloStart;

            // const runYoloStart = Date.now();
            const yoloOutputs = yoloModel.model.runSync([yoloResized.buffer]);
            const parsed = parseYoloOutput(yoloOutputs);
            // const runYoloTime = Date.now() - runYoloStart;
            
            const names = parsed.map(o => COCO_LABELS[o.labelIdx]);
            scheduleOnRN(updateList, names);
            const targetObjects = parsed.filter(item => COCO_LABELS[item.labelIdx] === 'person');

            if (targetObjects.length > 0) {
              targetObjects.sort((a, b) => (b.width * b.height) - (a.width * a.height));
              const firstTarget = targetObjects[0];
                
              if (!global.lastMidasTime || now - global.lastMidasTime > 800) {
                global.lastMidasTime = now;
                     
                // const midasResizeStart = Date.now();
                const midasResized = resize(frameData, frame.width, frame.height, 256, 256, frame.bytesPerRow, midasBuffer, 'HWC');
                const copiedMidasInput = new Float32Array(midasResized);
                // const resizeMidasTime = Date.now() - midasResizeStart;
                     
                scheduleOnRN(runMidasInBackground, copiedMidasInput, firstTarget);

                // console.log(`\n[C++ THREAD] --- BÁO CÁO YOLO & COPY ---`);
                // console.log(`1. YOLO Resize: ${resizeYoloTime} ms`);
                // console.log(`2. YOLO Chạy mô hình: ${runYoloTime} ms`);
                // console.log(`3. MiDaS Resize & Copy: ${resizeMidasTime} ms`);
                // console.log(`>> TỔNG THỜI GIAN FRAME CAMERA: ${resizeYoloTime + runYoloTime + resizeMidasTime} ms`);
                // console.log(`(Camera đã xong việc, không cần chờ ông MiDaS nữa!)`);
                // console.log(`----------------------------------------\n`);
              }
            } else {
              scheduleOnRN(clearAlert);
            }
          }

          global.frameCount = (global.frameCount || 0) + 1;
          global.lastFpsTime = global.lastFpsTime || Date.now();
          if (now - global.lastFpsTime >= 1000) {
            scheduleOnRN(updateFps, global.frameCount);
            global.frameCount = 0;
            global.lastFpsTime = now;
          }
        }
      } catch (e) {
        console.error("Lỗi Worklet:", String(e));
      } finally {
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

  if (yoloModel.state !== 'loaded' && midasModel.state !== 'loaded') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Đang khởi động mô hình AI...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} 
        device={camera} 
        isActive={true} 
        outputs={[frameOutput]} />
      <View style={styles.fpsOverlay}>
        <Text style={styles.fpsText}>FPS: {fps}</Text>
      </View>
      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>PHÁT HIỆN: {detectedObj.name.toUpperCase()}</Text>
        <Text style={styles.alertDepth}>Chỉ số (Inverse Depth): {detectedObj.depth.toFixed(2)}</Text>
      </View>
      <View style={styles.debugList}>
        {objectList.map((name, index) => (
          <Text key={index} style={styles.debugText}>{name}</Text>
        ))}
      </View>
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
  },
  fpsOverlay: { 
    position: 'absolute', 
    top: 60, 
    left: 20, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
  },
  fpsText: { 
    color: '#00FF00', 
    fontSize: 18, 
    fontWeight: 'bold',
  },
  alertBox: { 
    position: 'absolute', 
    bottom: 50, 
    alignSelf: 'center', 
    backgroundColor: 'rgba(255,0,0,0.85)', 
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center',
  },
  alertTitle: { 
    color: 'white', 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 5,
  },
  alertDepth: { 
    color: 'yellow', 
    fontSize: 24, 
    fontWeight: '900', 
  },
  debugList: { position: 'absolute', top: 100, right: 20 },
debugText: { color: 'yellow', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)' }
});

export default App;