export const getDepthFromMidas = (
  yoloBox,
  depthMap,
  yoloBounds,
  midasBounds,
  spatialConfig,
) => {
  'worklet';

  const normalizedX = (yoloBox.x - yoloBounds.padX) / yoloBounds.newW;
  const normalizedY = (yoloBox.y - yoloBounds.padY) / yoloBounds.newH;
  const normalizedW = yoloBox.width / yoloBounds.newW;
  const normalizedH = yoloBox.height / yoloBounds.newH;

  const midasX = Math.max(
    0,
    Math.floor(midasBounds.padX + normalizedX * midasBounds.newW),
  );

  const midasY = Math.max(
    0,
    Math.floor(midasBounds.padY + normalizedY * midasBounds.newH),
  );

  const midasW = Math.min(
    midasBounds.newW,
    Math.floor(normalizedW * midasBounds.newW),
  );

  const midasH = Math.min(
    midasBounds.newH,
    Math.floor(normalizedH * midasBounds.newH),
  );

  const coreX = midasX + Math.floor(midasW * spatialConfig.ROI_X_OFFSET);
  const coreY = midasY + Math.floor(midasH * spatialConfig.ROI_Y_OFFSET);
  const coreW = Math.floor(midasW * spatialConfig.ROI_WIDTH);
  const coreH = Math.floor(midasH * spatialConfig.ROI_HEIGHT);

  let maxRawDepth = 0;
  let sumDepth = 0;
  let count = 0;

  for (let y = coreY; y < coreY + coreH; y++) {
    for (let x = coreX; x < coreX + coreW; x++) {
      if (x >= 0 && x < midasBounds.dstW && y >= 0 && y < midasBounds.dstH) {
        const index = y * midasBounds.dstW + x;
        const d = depthMap[index];

        if (d > maxRawDepth) {
          maxRawDepth = d;
        }

        sumDepth += d;
        count++;
      }
    }
  }

  const avgDepth = count > 0 ? sumDepth / count : 0;

  return (
    maxRawDepth * spatialConfig.MAX_DEPTH_WEIGHT +
    avgDepth * spatialConfig.AVG_DEPTH_WEIGHT
  );
};

export const translateDepthToText = (rawVal, spatialConfig) => {
  'worklet';

  if (rawVal <= 0) {
    return 'Không rõ';
  }

  if (rawVal > spatialConfig.DEPTH_LVL_0_5M) {
    return 'Dưới nửa mét';
  }

  if (rawVal > spatialConfig.DEPTH_LVL_1M) {
    return 'Khoảng 1 mét';
  }

  if (rawVal > spatialConfig.DEPTH_LVL_2M) {
    return 'Khoảng 2 mét';
  }

  if (rawVal > spatialConfig.DEPTH_LVL_3M) {
    return 'Khoảng 3 mét';
  }

  if (rawVal > spatialConfig.DEPTH_LVL_5M) {
    return 'Khoảng 5 mét';
  }

  return 'Khá xa';
};
