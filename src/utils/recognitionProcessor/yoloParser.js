const calculateIoU = (a, b) => {
  'worklet';
  const interX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = interX * interY;
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return intersection / (areaA + areaB - intersection);
};

export const parseYoloOutput = (rawOutputs) => {
  'worklet';
  
  const output = new Float32Array(rawOutputs[0]);
  const numAnchors = 8400; 
  const numClasses = 80; 
  const confidenceThreshold = 0.5;
  const iouThreshold = 0.7; 

  const detections = [];

  for (let i = 0; i < numAnchors; i++) {
    let maxScore = 0;
    let classIdx = -1;
    
    for (let c = 0; c < numClasses; c++) {
      const score = output[(4 + c) * numAnchors + i];
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }

    if (maxScore > confidenceThreshold) {
      const cx = output[0 * numAnchors + i] * 640;
      const cy = output[1 * numAnchors + i] * 640;
      const w = output[2 * numAnchors + i] * 640;
      const h = output[3 * numAnchors + i] * 640;

      detections.push({
        labelIdx: classIdx,
        score: maxScore,
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h
      });
    }
  }

  detections.sort((a, b) => b.score - a.score);

  const result = [];
  while (detections.length > 0) {
    const best = detections.shift();
    if (!best) continue;
    result.push(best);

    for (let i = 0; i < detections.length; i++) {
      const other = detections[i];
      if (best.labelIdx === other.labelIdx && calculateIoU(best, other) > iouThreshold) {
        detections.splice(i, 1);
        i--;
      }
    }
  }

  // 🔥 THÊM ĐOẠN CODE NÀY ĐỂ IN LOG RA CONSOLE
  if (result.length > 0) {
    // Gom tất cả kết quả lại thành một chuỗi dễ đọc
    const logMessage = result.map(obj => 
      `- Lớp (Class ID): ${obj.labelIdx} | Độ tự tin: ${(obj.score * 100).toFixed(1)}% | Tọa độ: [x: ${obj.x.toFixed(0)}, y: ${obj.y.toFixed(0)}, w: ${obj.width.toFixed(0)}, h: ${obj.height.toFixed(0)}]`
    ).join('\n');
    
    console.log(`\n=== Yolo đã phát hiện ${result.length} vật thể ===\n${logMessage}`);
  }

  return result;
};