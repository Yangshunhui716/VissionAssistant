import { getDepthFromMidas, translateDepthToText } from './depthCalculator';


const LEFT_BORDER_RATIO = 0.35; 
const RIGHT_BORDER_RATIO = 0.65;

export const analyzeSpatialObject = (obj, name, depthMap, yoloSize, midasSize) => {
  'worklet';
  if (!depthMap) return name;

  const rawDepth = getDepthFromMidas(obj, depthMap, yoloSize, midasSize);
  const distanceText = translateDepthToText(rawDepth).toLowerCase();

  const xCenter = obj.x + (obj.width / 2);
  let positionText = "ngay phía trước";
  
  if (xCenter < yoloSize * LEFT_BORDER_RATIO) {
    positionText = "nằm bên trái";
  } else if (xCenter > yoloSize * RIGHT_BORDER_RATIO) {
    positionText = "nằm bên phải";
  }

  return `${name} ${positionText}, cách ${distanceText}`;
};