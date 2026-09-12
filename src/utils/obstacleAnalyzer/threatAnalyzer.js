import { getBoxCenters } from '../spatialProcessor/geometryUtils';
import { getDirection } from '../spatialProcessor/spatialAnalyzer';

export const analyzeThreat = (
  mostDangerousTarget,
  targetName,
  trackedObstacles,
  obstacleConfig,
  yoloBounds,
  spatialConfig,
) => {
  'worklet';

  if (!mostDangerousTarget) {
    return '';
  }

  const mainArea = mostDangerousTarget.width * mostDangerousTarget.height;
  const { bottomY: mainBottomY } = getBoxCenters(mostDangerousTarget);
  const uniqueClasses = [];
  let relevantCount = 0;
  let hasLeft = false;
  let hasRight = false;
  let hasFront = false;

  for (let i = 0; i < trackedObstacles.length; i++) {
    const obj = trackedObstacles[i];
    const objArea = obj.width * obj.height;
    const { bottomY: objBottomY } = getBoxCenters(obj);
    const areaRatio = objArea / mainArea;

    const isSameDistance =
      areaRatio > obstacleConfig.MIN_AREA_RATIO &&
      areaRatio < obstacleConfig.MAX_AREA_RATIO &&
      Math.abs(objBottomY - mainBottomY) <
        yoloBounds.newH * obstacleConfig.MAX_Y_DIFF_RATIO;

    if (isSameDistance) {
      relevantCount++;
      const cls = obj.labelIdx;

      if (uniqueClasses.indexOf(cls) === -1) {
        uniqueClasses.push(cls);
      }

      const dir = getDirection(obj, yoloBounds, spatialConfig);
      if (dir === 'bên trái') {
        hasLeft = true;
      } else if (dir === 'bên phải') {
        hasRight = true;
      } else if (dir === 'trực diện') {
        hasFront = true;
      }
    }
  }

  let dirText = '';
  if (hasLeft && hasRight && hasFront) {
    dirText = 'nhiều hướng';
  } else if (hasLeft && hasFront) {
    dirText = 'trái trực diện';
  } else if (hasRight && hasFront) {
    dirText = 'phải trực diện';
  } else if (hasLeft && hasRight) {
    dirText = 'trái phải';
  } else if (hasLeft) {
    dirText = 'bên trái';
  } else if (hasRight) {
    dirText = 'bên phải';
  } else if (hasFront) {
    dirText = 'trực diện';
  }

  let displayAlertName = '';
  if (uniqueClasses.length > 1) {
    displayAlertName = `Nhiều vật cản ở ${dirText}`;
  } else {
    const count = relevantCount;
    const quantityText = count > 1 ? `${count} ` : '';
    displayAlertName = `${quantityText} ${targetName} ${dirText}`;
  }

  return displayAlertName.charAt(0).toUpperCase() + displayAlertName.slice(1);
};
