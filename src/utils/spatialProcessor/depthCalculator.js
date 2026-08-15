export const getDepthFromMidas = (yoloBox, depthMap) => {
  'worklet';

  const midasX = Math.max(0, Math.floor((yoloBox.x / 640) * 256));
  const midasY = Math.max(0, Math.floor((yoloBox.y / 640) * 256));
  const midasW = Math.min(256 - midasX, Math.floor((yoloBox.width / 640) * 256));
  const midasH = Math.min(256 - midasY, Math.floor((yoloBox.height / 640) * 256));

  const coreX = midasX + Math.floor(midasW * 0.25);
  const coreY = midasY + Math.floor(midasH * 0.4);
  const coreW = Math.floor(midasW * 0.5);
  const coreH = Math.floor(midasH * 0.5);

  let maxRawDepth = 0;
  let sumDepth = 0;
  let count = 0;

  for (let y = coreY; y < coreY + coreH; y++) {
    for (let x = coreX; x < coreX + coreW; x++) {
      if (x >= 0 && x < 256 && y >= 0 && y < 256) {
        const index = (y * 256) + x;
        const d = depthMap[index];
        
        if (d > maxRawDepth) maxRawDepth = d;
        sumDepth += d;
        count++;
      }
    }
  }

  const avgDepth = count > 0 ? (sumDepth / count) : 0;
  const finalRaw = (maxRawDepth * 0.7) + (avgDepth * 0.3);

  return finalRaw;
};

export const translateDepthToText = (rawVal) => {
  'worklet';
  
  if (rawVal <= 0) return "không rõ";
  if (rawVal > 200) return "dưới nửa mét";
  if (rawVal > 150) return "khoảng 1 mét";
  if (rawVal > 100) return "khoảng 2 mét";
  if (rawVal > 60)  return "khoảng 3 mét";
  if (rawVal > 30)  return "khoảng 5 mét";
  
  return "khá xa";
};