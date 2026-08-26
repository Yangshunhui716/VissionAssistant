const DIST_SMOOTHING_FACTOR = 10;

const getProminentObject = (parsedDetections, labelsVi, yoloSize) => {
  'worklet';

  let prominentName = null;
  let maxWeight = 0;
  const frameCenter = yoloSize / 2;

  for (let i = 0; i < parsedDetections.length; i++) {
    const obj = parsedDetections[i];
    const area = obj.width * obj.height;
    const objCenterX = obj.x + obj.width / 2;
    const objCenterY = obj.y + obj.height / 2;

    const distToCenter = Math.sqrt(
      Math.pow(objCenterX - frameCenter, 2) +
        Math.pow(objCenterY - frameCenter, 2),
    );

    const weight = area / (distToCenter + DIST_SMOOTHING_FACTOR);

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
  yoloSize,
  maxFrames = 3,
) => {
  'worklet';
  globalThis.__scanFrameCount = (globalThis.__scanFrameCount || 0) + 1;
  globalThis.__scanResults = globalThis.__scanResults || [];

  const prominentName = getProminentObject(
    parsedDetections,
    labelsVi,
    yoloSize,
  );
  if (prominentName) globalThis.__scanResults.push(prominentName);

  if (globalThis.__scanFrameCount < maxFrames)
    return { status: 'SCANNING', result: null };

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