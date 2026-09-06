import { getBoxCenters } from '../spatialProcessor/geometryUtils';
import { getDirection } from '../spatialProcessor/spatialAnalyzer';

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
      areaRatio > 0.33 && 
      areaRatio < 3.0 && 
      Math.abs(objBottomY - mainBottomY) < (yoloSize * 0.3);

    if (isSameDistance) {
      relevantObstacles.push(obj);
    }
  }

  const uniqueClasses = [];
  const directions = [];

  for (let i = 0; i < relevantObstacles.length; i++) {
    const cls = relevantObstacles[i].labelIdx;
    const dir = getDirection(relevantObstacles[i], yoloBounds);
    
    if (uniqueClasses.indexOf(cls) === -1) uniqueClasses.push(cls);
    if (directions.indexOf(dir) === -1) directions.push(dir);
  }

  let dirText = '';
  if (directions.length === 3) {
    dirText = 'nhiều hướng';
  } else if (directions.length === 2) {
    const hasLeft = directions.indexOf('bên trái') !== -1;
    const hasRight = directions.indexOf('bên phải') !== -1;
    const hasFront = directions.indexOf('trực diện') !== -1;

    if (hasLeft && hasFront) dirText = 'trái trực diện';
    else if (hasRight && hasFront) dirText = 'phải trực diện';
    else if (hasLeft && hasRight) dirText = 'hai bên trái phải';
  } else {
    dirText = directions[0];
  }

  let displayAlertName = '';
  
  if (uniqueClasses.length >= 2) {
    displayAlertName = `Nhiều vật cản ở ${dirText}`;
  } else {
    const count = relevantObstacles.length;
    const quantityText = count > 1 ? `${count} ` : '';
    displayAlertName = `${quantityText}${targetName} ở ${dirText}`;
  }

  return displayAlertName.charAt(0).toUpperCase() + displayAlertName.slice(1);
};