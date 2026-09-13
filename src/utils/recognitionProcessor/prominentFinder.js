import { getBoxCenters } from '../spatialProcessor/geometryUtils';

const getProminentObject = (
  parsedDetections,
  labelsVi,
  yoloBounds,
  distanceSmoothingFactor,
) => {
  'worklet';

  let prominentName = null;
  let maxWeight = 0;

  const frameCenterX = yoloBounds.padX + yoloBounds.newW / 2;
  const frameCenterY = yoloBounds.padY + yoloBounds.newH / 2;

  for (let i = 0; i < parsedDetections.length; i++) {
    const obj = parsedDetections[i];
    const area = obj.width * obj.height;
    const { cx, cy } = getBoxCenters(obj);

    const distToCenter = Math.sqrt(
      Math.pow(cx - frameCenterX, 2) +
      Math.pow(cy - frameCenterY, 2),
    );

    const weight = area / (distToCenter + distanceSmoothingFactor);

    if (weight > maxWeight) {
      maxWeight = weight;
      prominentName = labelsVi[obj.labelIdx];
    }
  }

  return prominentName;
};

export const processGeneralScan = (
  parsedDetections,
  labelsVi,
  yoloBounds,
  generalScanConfig,
) => {
  'worklet';

  const { DIST_SMOOTHING_FACTOR, MAX_FRAMES} = generalScanConfig;

  globalThis.__scanFrameCount = (globalThis.__scanFrameCount || 0) + 1;
  globalThis.__scanResults = globalThis.__scanResults || [];

  const prominentName = getProminentObject(
    parsedDetections,
    labelsVi,
    yoloBounds,
    DIST_SMOOTHING_FACTOR,
  );

  if (prominentName) {
    globalThis.__scanResults.push(prominentName);
  }

  if (globalThis.__scanFrameCount < MAX_FRAMES) {
    return {
      status: 'SCANNING',
      result: null,
    };
  }

  let bestMatch = null;

  if (globalThis.__scanResults.length > 0) {
    const counts = {};
    let maxCount = 0;

    for (let i = 0; i < globalThis.__scanResults.length; i++) {
      const name = globalThis.__scanResults[i];
      counts[name] = (counts[name] || 0) + 1;

      if (counts[name] > maxCount) {
        maxCount = counts[name];
        bestMatch = name;
      }
    }
  }

  globalThis.__scanFrameCount = 0;
  globalThis.__scanResults = [];

  return {
    status: 'DONE',
    result: bestMatch ? [bestMatch] : [],
  };
};

export const resetGeneralScan = () => {
  'worklet';

  globalThis.__scanFrameCount = 0;
  globalThis.__scanResults = [];
};
