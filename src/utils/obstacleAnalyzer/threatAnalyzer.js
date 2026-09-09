import { getBoxCenters } from '../spatialProcessor/geometryUtils';
import { getDirection } from '../spatialProcessor/spatialAnalyzer';

const MIN_AREA_RATIO = 0.33;
const MAX_AREA_RATIO = 3.0;
const MAX_Y_DIFF_RATIO = 0.3;

export const analyzeThreat = (
  mostDangerousTarget,
  targetName,
  trackedObstacles,
  yoloSize,
) => {
  'worklet';

  if (!mostDangerousTarget) return '';

  const yoloBounds = { padX: 0, newW: yoloSize };
  const mainArea = mostDangerousTarget.width * mostDangerousTarget.height;
  const { bottomY: mainBottomY } = getBoxCenters(mostDangerousTarget);

  const relevantObstacles = [];
  for (let i = 0; i < trackedObstacles.length; i++) {
    const obj = trackedObstacles[i];
    const objArea = obj.width * obj.height;
    const { bottomY: objBottomY } = getBoxCenters(obj);

    const areaRatio = objArea / mainArea;
    const isSameDistance = 
      areaRatio > MIN_AREA_RATIO && 
      areaRatio < MAX_AREA_RATIO && 
      Math.abs(objBottomY - mainBottomY) < (yoloSize * MAX_Y_DIFF_RATIO);

    if (isSameDistance) {
      relevantObstacles.push(obj);
    }
  }

  const uniqueClasses = [];
  let hasLeft = false;
  let hasRight = false;
  let hasFront = false;

  for (let i = 0; i < relevantObstacles.length; i++) {
    const cls = relevantObstacles[i].labelIdx;
    if (uniqueClasses.indexOf(cls) === -1) {
      uniqueClasses.push(cls);
    }

    const dir = getDirection(relevantObstacles[i], yoloBounds);
    if (dir === 'bên trái') hasLeft = true;
    else if (dir === 'bên phải') hasRight = true;
    else if (dir === 'trực diện') hasFront = true;
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
    const count = relevantObstacles.length;
    const quantityText = count > 1 ? `${count} ` : '';
    displayAlertName = `${quantityText} ${targetName} ${dirText}`;
  }

  return displayAlertName.charAt(0).toUpperCase() + displayAlertName.slice(1);
};