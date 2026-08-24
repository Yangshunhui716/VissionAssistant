import { calculateIoU } from "../spatialProcessor/geometryUtils"

const NUM_CLASSES = 80;
const CONFIDENCE_THRESHOLD = 0.5;
const IOU_THRESHOLD = 0.7;

export const parseYoloOutput = (rawOutputs, yoloSize, numAnchors, isDebug = false) => {
  'worklet';
  
  const output = new Float32Array(rawOutputs[0]);
  const maxScores = new Float32Array(numAnchors);
  const bestClasses = new Int32Array(numAnchors);

  for (let c = 0; c < NUM_CLASSES; c++) {
    const rowOffset = (4 + c) * numAnchors;
    for (let i = 0; i < numAnchors; i++) {
      const score = output[rowOffset + i];
      if (score > maxScores[i]) {
        maxScores[i] = score;
        bestClasses[i] = c;
      }
    }
  }

  const detections = [];

  for (let i = 0; i < numAnchors; i++) {
    const score = maxScores[i];
    if (score > CONFIDENCE_THRESHOLD) {
      const cx = output[0 * numAnchors + i] * yoloSize;
      const cy = output[1 * numAnchors + i] * yoloSize;
      const w = output[2 * numAnchors + i] * yoloSize;
      const h = output[3 * numAnchors + i] * yoloSize;

      detections.push({
        labelIdx: bestClasses[i],
        score: score,
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h
      });
    }
  }

  detections.sort((a, b) => b.score - a.score);
  const result = [];
  const suppressed = new Array(detections.length).fill(false);

  for (let i = 0; i < detections.length; i++) {
    if (suppressed[i]) continue;
    
    const best = detections[i];
    result.push(best);

    for (let j = i + 1; j < detections.length; j++) {
      if (!suppressed[j] && best.labelIdx === detections[j].labelIdx) {
        if (calculateIoU(best, detections[j]) > IOU_THRESHOLD) {
          suppressed[j] = true;
        }
      }
    }
  }

  if (isDebug && result.length > 0) {
    const logMessage = result.map(obj => 
      `- Lớp (Class ID): ${obj.labelIdx} | Độ tự tin: ${(obj.score * 100).toFixed(1)}% | Tọa độ: [x: ${obj.x.toFixed(0)}, y: ${obj.y.toFixed(0)}, w: ${obj.width.toFixed(0)}, h: ${obj.height.toFixed(0)}]`
    ).join('\n');
    
    console.log(`\n=== Yolo đã phát hiện ${result.length} vật thể ===\n${logMessage}`);
  }

  return result;
};