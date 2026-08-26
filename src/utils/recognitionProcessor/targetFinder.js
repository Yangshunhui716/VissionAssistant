const SEARCH_SCORE_THRESHOLD = 0.45;

export const processSearch = (
  parsedDetections,
  searchTarget,
  labelsVi,
  maxFrames = 3,
) => {
  'worklet';
  globalThis.__searchFrameCount = (globalThis.__searchFrameCount || 0) + 1;

  const foundItem = parsedDetections.find(
    item =>
      labelsVi[item.labelIdx] === searchTarget &&
      item.score > SEARCH_SCORE_THRESHOLD,
  );

  if (foundItem) {
    globalThis.__searchFrameCount = 0;
    return { status: 'FOUND', item: foundItem };
  } else if (globalThis.__searchFrameCount >= maxFrames) {
    globalThis.__searchFrameCount = 0;
    return { status: 'NOT_FOUND', item: null };
  } else {
    return { status: 'SEARCHING', item: null };
  }
};

export const resetSearch = () => {
  'worklet';
  globalThis.__searchFrameCount = 0;
};