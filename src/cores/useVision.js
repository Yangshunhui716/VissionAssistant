import { useState } from 'react';
import { Platform } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { resize } from '../utils/frameProcessor/frameResizer';
import { parseYoloOutput } from '../utils/recognitionProcessor/yoloParser';
import { COCO_LABELS } from '../utils/recognitionProcessor/cocoLabels';
import { getDepthFromMidas } from '../utils/depthProcessor/depthCalculator';

const aiDelegates = (Platform.OS === 'ios') ? ['core-ml', 'metal'] : ['android-gpu', 'nnapi'];

export const useVision = () => {
  const yoloModel = useTensorflowModel(require('../assets/models/yolo11n.tflite'), aiDelegates);
  const midasModel = useTensorflowModel(require('../assets/models/midas.tflite'), aiDelegates);

  const yoloBuffer = new Float32Array(320 * 320 * 3);
  const midasBuffer = new Float32Array(256 * 256 * 3);

  const [fps, setFps] = useState(0);
  const [objectList, setObjectList] = useState([]);
  const [detectedObj, setDetectedObj] = useState({ name: 'Không phát hiện', depth: 0 });

  const updateFps = (newFps) => setFps(newFps);
  const updateList = (names) => setObjectList(names);
  const updateAlert = (name, depth) => setDetectedObj({ name, depth });
  const clearAlert = () => setDetectedObj({ name: 'Không phát hiện', depth: 0 });

  const runMidasInBackground = (copiedMidasArray, targetObj) => {
    setTimeout(() => {
      try {
        if (midasModel.model) {
          const midasOutputs = midasModel.model.runSync([copiedMidasArray.buffer]);
          const depthMap = new Float32Array(midasOutputs[0]); 
          const rawDepth = getDepthFromMidas(targetObj, depthMap);
          updateAlert('Con người', rawDepth);
        }
      } catch (error) {
        console.error("Lỗi khi chạy MiDaS ngầm:", error);
      }
    }, 0);
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame(frame) {
      'worklet';
      try {
        if (yoloModel.state === 'loaded' && midasModel.state === 'loaded') {
          const global = globalThis;
          const now = Date.now();
          
          if (!global.lastProcessTime || now - global.lastProcessTime > 200) {
            global.lastProcessTime = now;
            const frameData = new Uint8Array(frame.getPixelBuffer());
            const yoloResized = resize(frameData, frame.width, frame.height, 320, 320, frame.bytesPerRow, yoloBuffer, 'CHW');
            const yoloOutputs = yoloModel.model.runSync([yoloResized.buffer]);
            const parsed = parseYoloOutput(yoloOutputs);
            
            const names = parsed.map(o => COCO_LABELS[o.labelIdx]);
            scheduleOnRN(updateList, names);
            const targetObjects = parsed.filter(item => COCO_LABELS[item.labelIdx] === 'person');

            if (targetObjects.length > 0) {
              targetObjects.sort((a, b) => (b.width * b.height) - (a.width * a.height));
              const firstTarget = targetObjects[0];
                
              if (!global.lastMidasTime || now - global.lastMidasTime > 10000) {
                global.lastMidasTime = now;
                const midasResized = resize(frameData, frame.width, frame.height, 256, 256, frame.bytesPerRow, midasBuffer, 'HWC');
                const copiedMidasInput = new Float32Array(midasResized);
                scheduleOnRN(runMidasInBackground, copiedMidasInput, firstTarget);
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

  return {
    frameOutput,
    fps,
    objectList,
    detectedObj,
    isModelsLoaded: yoloModel.state === 'loaded' && midasModel.state === 'loaded'
  };
};