export const analyzeThreat = (mostDangerousTarget, targetName, trackedObstacles, cocoLabels, yoloSize) => {
  'worklet';

  if (!mostDangerousTarget) return "";

  const firstBorder = yoloSize / 3;
  const secondBorder = (yoloSize * 2) / 3;
  const halfScreen = yoloSize / 2;

  const centerX = mostDangerousTarget.x + (mostDangerousTarget.width / 2);
  let direction = "Trực diện";
  if (centerX < firstBorder) direction = "Bên trái";
  else if (centerX > secondBorder) direction = "Bên phải";

  const countInSameDirection = trackedObstacles.filter(obj => {
    const isSameName = cocoLabels[obj.labelIdx] === targetName; 
    const objCX = obj.x + (obj.width / 2);
    let objDir = "Trực diện";
    if (objCX < firstBorder) objDir = "Bên trái";
    else if (objCX > secondBorder) objDir = "Bên phải";
    return isSameName && (objDir === direction);
  }).length;

  const hasSurroundingThreats = trackedObstacles.some(obj => {
    const cx = obj.x + (obj.width / 2);
    let dir = "Trực diện";
    if (cx < firstBorder) dir = "Bên trái";
    else if (cx > secondBorder) dir = "Bên phải";
    const bottomY = obj.y + obj.height;
    return (dir !== direction) && (bottomY > halfScreen);
  });
  
  let displayAlertName = "";
  if (hasSurroundingThreats) {
    displayAlertName = "Chú ý: Có vật cản ở nhiều hướng";
  } else {
    const quantityText = countInSameDirection > 1 ? `${countInSameDirection} ` : '';
    displayAlertName = `${quantityText}${targetName} ${direction}`;
  }

  return displayAlertName; 
};