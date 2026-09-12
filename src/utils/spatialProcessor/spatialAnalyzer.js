import { getDepthFromMidas, translateDepthToText } from './depthCalculator';
import { getBoxCenters } from './geometryUtils';

export const getDirection = (box, bounds, spatialConfig) => {
  'worklet';

  const { cx } = getBoxCenters(box);
  const leftBorder = bounds.padX + bounds.newW * spatialConfig.LEFT_ZONE_RATIO;
  const rightBorder =
    bounds.padX + bounds.newW * spatialConfig.RIGHT_ZONE_RATIO;

  if (cx < leftBorder) {
    return 'bên trái';
  }
  if (cx > rightBorder) {
    return 'bên phải';
  }
  return 'trực diện';
};

export const analyzeSpatialObject = (
  obj,
  name,
  depthMap,
  yoloBounds,
  midasBounds,
  spatialConfig,
) => {
  'worklet';

  const baseDir = getDirection(obj, yoloBounds, spatialConfig);
  const positionText =
    baseDir === 'trực diện' ? 'ngay phía trước' : `nằm ${baseDir}`;

  if (!depthMap) {
    return `${name} ${positionText}`;
  }

  const rawDepth = getDepthFromMidas(
    obj,
    depthMap,
    yoloBounds,
    midasBounds,
    spatialConfig,
  );

  const distanceText = translateDepthToText(
    rawDepth,
    spatialConfig,
  ).toLowerCase();

  return `${name} ${positionText}, cách ${distanceText}`;
};
