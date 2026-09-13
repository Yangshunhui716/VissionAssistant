export const processSearch = (
  parsedDetections,
  searchTarget,
  labelsVi,
  searchConfig,
) => {
  'worklet';
  const { SCORE_THRESHOLD, MAX_FRAMES } = searchConfig;

  globalThis.__searchFrameCount = (globalThis.__searchFrameCount || 0) + 1;

  const foundItem = parsedDetections.find(
    item =>
      labelsVi[item.labelIdx] === searchTarget && item.score > SCORE_THRESHOLD,
  );

  if (foundItem) {
    globalThis.__searchFrameCount = 0;

    return {
      status: 'FOUND',
      item: foundItem,
    };
  }

  if (globalThis.__searchFrameCount >= MAX_FRAMES) {
    globalThis.__searchFrameCount = 0;

    return {
      status: 'NOT_FOUND',
      item: null,
    };
  }

  return {
    status: 'SEARCHING',
    item: null,
  };
};

export const resetSearch = () => {
  'worklet';

  globalThis.__searchFrameCount = 0;
  globalThis.__lastSearchTarget = null;
  globalThis.__searchLocked = false;
};
