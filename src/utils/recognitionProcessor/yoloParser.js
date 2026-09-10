import { IS_DEBUG } from '../debug/debug';

const CONFIDENCE_THRESHOLD = 0.4;

export const parseYoloOutput = (rawOutputs, yoloSize) => {
  'worklet';

  const output = new Float32Array(rawOutputs[0]);
  const detections = [];
  const step = 6;
  const numBoxes = output.length / step;

  let isNormalized = true;
  if (numBoxes > 0) {
    const firstX2 = output[2];
    const firstY2 = output[3];
    if (firstX2 > 1 || firstY2 > 1) isNormalized = false;
  }

  for (let i = 0; i < numBoxes; i++) {
    const offset = i * step;
    const x1 = output[offset + 0];
    const y1 = output[offset + 1];
    const x2 = output[offset + 2];
    const y2 = output[offset + 3];
    const score = output[offset + 4];
    const classId = Math.round(output[offset + 5]);

    if (score <= CONFIDENCE_THRESHOLD) continue;

    let left = x1,
      top = y1,
      right = x2,
      bottom = y2;
      
    if (isNormalized) {
      left *= yoloSize;
      top *= yoloSize;
      right *= yoloSize;
      bottom *= yoloSize;
    }

    detections.push({
      labelIdx: classId,
      score: score,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }

  if (IS_DEBUG && detections.length > 0) {
    const logMessage = detections
      .map(
        obj =>
          `- Lớp ID: ${obj.labelIdx} | Độ tự tin: ${(obj.score * 100).toFixed(
            1,
          )}% | Tọa độ: [x: ${obj.x.toFixed(0)}, y: ${obj.y.toFixed(
            0,
          )}, w: ${obj.width.toFixed(0)}, h: ${obj.height.toFixed(0)}]`,
      )
      .join('\n');

    console.log(
      `\n=== YOLO PHÁT HIỆN ${detections.length} VẬT THỂ ===\n${logMessage}`,
    );
  }

  return detections;
};