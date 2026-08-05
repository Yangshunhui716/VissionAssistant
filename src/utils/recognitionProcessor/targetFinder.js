export function checkSearchTarget(parsedDetections, searchTarget, cocoLabelsVi, currentFrameCount, maxFrames = 3) {
  'worklet';

  const foundItem = parsedDetections.find(
    item => cocoLabelsVi[item.labelIdx] === searchTarget && item.score > 0.45
  );
  
  if (foundItem) {
    return { status: 'FOUND', item: foundItem };
  } else if (currentFrameCount >= maxFrames) {
    return { status: 'NOT_FOUND', item: null };
  } else {
    return { status: 'SEARCHING', item: null };
  }
}