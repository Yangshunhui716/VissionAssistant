import { getBoxCenters } from '../spatialProcessor/geometryUtils';
import { getDirection } from '../spatialProcessor/spatialAnalyzer';

export const analyzeThreat = (mostDangerousTarget, targetName, trackedObstacles, cocoLabels, yoloSize) => {
  'worklet';

  if (!mostDangerousTarget) return "";

  const halfScreen = yoloSize / 2;
  const yoloBounds = { padX: 0, newW: yoloSize };
  const direction = getDirection(mostDangerousTarget, yoloBounds);

  const countInSameDirection = trackedObstacles.filter(obj => {
    const isSameName = cocoLabels[obj.labelIdx] === targetName; 
    return isSameName && (getDirection(obj, yoloBounds) === direction);
  }).length;

  const hasSurroundingThreats = trackedObstacles.some(obj => {
    const dir = getDirection(obj, yoloBounds);
    const { bottomY } = getBoxCenters(obj);
    return (dir !== direction) && (bottomY > halfScreen);
  });
  
  let displayAlertName = "";
  if (hasSurroundingThreats) {
    displayAlertName = "Chú ý: Có vật cản ở nhiều hướng";
  } else {
    const quantityText = countInSameDirection > 1 ? `${countInSameDirection} ` : '';
    const formattedDirection = direction.charAt(0).toUpperCase() + direction.slice(1);
    
    displayAlertName = `${quantityText}${targetName} ${formattedDirection}`;
  }

  return displayAlertName; 
};