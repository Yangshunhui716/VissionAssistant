const ROI_X_OFFSET = 0.25;
const ROI_Y_OFFSET = 0.40;
const ROI_WIDTH = 0.50;
const ROI_HEIGHT = 0.50;

const MAX_DEPTH_WEIGHT = 0.7;
const AVG_DEPTH_WEIGHT = 0.3;

const DEPTH_LVL_0_5M = 200;
const DEPTH_LVL_1M = 150;
const DEPTH_LVL_2M = 100;
const DEPTH_LVL_3M = 60;
const DEPTH_LVL_5M = 30;

export const getDepthFromMidas = (yoloBox, depthMap, yoloSize, midasSize) => {
  'worklet';
  const midasX = Math.max(0, Math.floor((yoloBox.x / yoloSize) * midasSize));
  const midasY = Math.max(0, Math.floor((yoloBox.y / yoloSize) * midasSize));
  const midasW = Math.min(midasSize - midasX, Math.floor((yoloBox.width / yoloSize) * midasSize));
  const midasH = Math.min(midasSize - midasY, Math.floor((yoloBox.height / yoloSize) * midasSize));

  const coreX = midasX + Math.floor(midasW * ROI_X_OFFSET);
  const coreY = midasY + Math.floor(midasH * ROI_Y_OFFSET);
  const coreW = Math.floor(midasW * ROI_WIDTH);
  const coreH = Math.floor(midasH * ROI_HEIGHT);

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
  return maxRawDepth * MAX_DEPTH_WEIGHT + avgDepth * AVG_DEPTH_WEIGHT;
};

export const translateDepthToText = rawVal => {
  'worklet';
  if (rawVal <= 0) return 'Không rõ';
  if (rawVal > DEPTH_LVL_0_5M) return 'Dưới nửa mét';
  if (rawVal > DEPTH_LVL_1M) return 'Khoảng 1 mét';
  if (rawVal > DEPTH_LVL_2M) return 'Khoảng 2 mét';
  if (rawVal > DEPTH_LVL_3M) return 'Khoảng 3 mét';
  if (rawVal > DEPTH_LVL_5M) return 'Khoảng 5 mét';
  return 'Khá xa';
};