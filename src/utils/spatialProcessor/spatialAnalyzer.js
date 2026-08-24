import { getDepthFromMidas, translateDepthToText } from './depthCalculator';
import { getBoxCenters } from './geometryUtils';

export const getDirection = (box, bounds) => {
  'worklet';
  const { cx } = getBoxCenters(box);
  const leftBorder = bounds.padX + (bounds.newW / 3);
  const rightBorder = bounds.padX + ((bounds.newW * 2) / 3);

  if (cx < leftBorder) return "bên trái";
  if (cx > rightBorder) return "bên phải";
  return "trực diện";
};

export const analyzeSpatialObject = (obj, name, depthMap, yoloSize, midasSize) => {
  'worklet';

  const yoloBounds = { padX: 0, newW: yoloSize };
  const baseDir = getDirection(obj, yoloBounds);
  const positionText = baseDir === "trực diện" ? "ngay phía trước" : `nằm ${baseDir}`;

  if (!depthMap) {
    return `${name} ${positionText}`;
  }

  const rawDepth = getDepthFromMidas(obj, depthMap, yoloSize, midasSize);
  const distanceText = translateDepthToText(rawDepth).toLowerCase();

  return `${name} ${positionText}, cách ${distanceText}`;
};