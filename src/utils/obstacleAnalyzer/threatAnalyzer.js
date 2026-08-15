export const analyzeThreat = (mostDangerousTarget, targetName, trackedObstacles, cocoLabels) => {
  'worklet';

  if (!mostDangerousTarget) return "";

  const centerX = mostDangerousTarget.x + (mostDangerousTarget.width / 2);
  let direction = "Trực diện";
  if (centerX < 212) direction = "Bên trái";
  else if (centerX > 426) direction = "Bên phải";

  const countInSameDirection = trackedObstacles.filter(obj => {
    const isSameName = cocoLabels[obj.labelIdx] === targetName; 
    const objCX = obj.x + (obj.width / 2);
    let objDir = "Trực diện";
    if (objCX < 212) objDir = "Bên trái";
    else if (objCX > 426) objDir = "Bên phải";
    return isSameName && (objDir === direction);
  }).length;

  const hasSurroundingThreats = trackedObstacles.some(obj => {
    const cx = obj.x + (obj.width / 2);
    let dir = "Trực diện";
    if (cx < 212) dir = "Bên trái";
    else if (cx > 426) dir = "Bên phải";
    const bottomY = obj.y + obj.height;
    return (dir !== direction) && (bottomY > 320);
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