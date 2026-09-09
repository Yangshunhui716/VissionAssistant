import { getDepthFromMidas, translateDepthToText } from './depthCalculator';
import { getBoxCenters } from './geometryUtils';

const LEFT_ZONE_RATIO = 1 / 3;
const RIGHT_ZONE_RATIO = 2 / 3;

export const getDirection = (box, bounds) => {
  'worklet';
  const { cx } = getBoxCenters(box);
  const leftBorder = bounds.padX + bounds.newW * LEFT_ZONE_RATIO;
  const rightBorder = bounds.padX + bounds.newW * RIGHT_ZONE_RATIO;

  if (cx < leftBorder) return 'bên trái';
  if (cx > rightBorder) return 'bên phải';
  return 'trực diện';
};

export const analyzeSpatialObject = (
  obj,
  name,
  depthMap,
  yoloSize,
  midasSize,
) => {
  'worklet';

  const yoloBounds = { padX: 0, newW: yoloSize };
  const baseDir = getDirection(obj, yoloBounds);
  const positionText =
    baseDir === 'trực diện' ? 'ngay phía trước' : `nằm ${baseDir}`;

  if (!depthMap) {
    return `${name} ${positionText}`;
  }

  const rawDepth = getDepthFromMidas(obj, depthMap, yoloSize, midasSize);
  const distanceText = translateDepthToText(rawDepth).toLowerCase();

  return `${name} ${positionText}, cách ${distanceText}`;
};