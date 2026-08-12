export const processSearch = (parsedDetections, searchTarget, cocoLabelsVi, maxFrames = 3) => {
  'worklet';
  globalThis.__searchFrameCount = (globalThis.__searchFrameCount || 0) + 1;

  const foundItem = parsedDetections.find(
    item => cocoLabelsVi[item.labelIdx] === searchTarget && item.score > 0.45
  );
  
  if (foundItem) {
    globalThis.__searchFrameCount = 0; 
    return { status: 'FOUND', item: foundItem };
  } 
  else if (globalThis.__searchFrameCount >= maxFrames) {
    globalThis.__searchFrameCount = 0; 
    return { status: 'NOT_FOUND', item: null };
  } 
  else {
    return { status: 'SEARCHING', item: null };
  }
};

export const resetSearch = () => {
  'worklet';
  globalThis.__searchFrameCount = 0;
};