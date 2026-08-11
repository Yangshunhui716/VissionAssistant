import { getDepthFromMidas, translateDepthToText } from './depthCalculator';

export const analyzeSpatialObject = (obj, name, depthMap) => {
  'worklet';
  if (!depthMap) return name;

  const rawDepth = getDepthFromMidas(obj, depthMap);
  const distanceText = translateDepthToText(rawDepth).toLowerCase();

  const xCenter = obj.x + (obj.width / 2);
  let positionText = "ngay phía trước";
  
  if (xCenter < 320 * 0.35) {
    positionText = "nằm bên trái";
  } else if (xCenter > 320 * 0.65) {
    positionText = "nằm bên phải";
  }

  return `${name} ${positionText}, cách ${distanceText}`;
};