export const getDepthFromMidas = (yoloBox, depthMap, yoloSize, midasSize) => {
  'worklet';

  const midasX = Math.max(0, Math.floor((yoloBox.x / yoloSize) * midasSize));
  const midasY = Math.max(0, Math.floor((yoloBox.y / yoloSize) * midasSize));
  const midasW = Math.min(
    midasSize - midasX,
    Math.floor((yoloBox.width / yoloSize) * midasSize),
  );
  const midasH = Math.min(
    midasSize - midasY,
    Math.floor((yoloBox.height / yoloSize) * midasSize),
  );

  const coreX = midasX + Math.floor(midasW * 0.25);
  const coreY = midasY + Math.floor(midasH * 0.4);
  const coreW = Math.floor(midasW * 0.5);
  const coreH = Math.floor(midasH * 0.5);

  let maxRawDepth = 0;
  let sumDepth = 0;
  let count = 0;

  for (let y = coreY; y < coreY + coreH; y++) {
    for (let x = coreX; x < coreX + coreW; x++) {
      if (x >= 0 && x < midasSize && y >= 0 && y < midasSize) {
        const index = y * midasSize + x;
        const d = depthMap[index];

        if (d > maxRawDepth) maxRawDepth = d;
        sumDepth += d;
        count++;
      }
    }
  }

  const avgDepth = count > 0 ? sumDepth / count : 0;
  return maxRawDepth * 0.7 + avgDepth * 0.3;
};

export const translateDepthToText = rawVal => {
  'worklet';

  if (rawVal <= 0) return 'Không rõ';
  if (rawVal > 200) return 'Dưới nửa mét';
  if (rawVal > 150) return 'Khoảng 1 mét';
  if (rawVal > 100) return 'Khoảng 2 mét';
  if (rawVal > 60) return 'Khoảng 3 mét';
  if (rawVal > 30) return 'Khoảng 5 mét';

  return 'Khá xa';
};