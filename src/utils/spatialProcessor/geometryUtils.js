export const calculateIoU = (a, b) => {
  'worklet';
  const interX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = interX * interY;
  const union = (a.width * a.height) + (b.width * b.height) - intersection;
  return union > 0 ? intersection / union : 0;
};

export const getBoxCenters = (box) => {
  'worklet';
  return {
    cx: box.x + (box.width / 2),
    cy: box.y + (box.height / 2),
    bottomY: box.y + box.height
  };
};

