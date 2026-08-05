export function analyzeThreat(mostDangerousTarget, targetName, trackedObstacles, cocoLabels) {
  'worklet';

  if (!mostDangerousTarget) return "";

  const centerX = mostDangerousTarget.x + (mostDangerousTarget.width / 2);
  let direction = "Trực diện";
  if (centerX < 106) direction = "Bên trái";
  else if (centerX > 213) direction = "Bên phải";

  const countInSameDirection = trackedObstacles.filter(obj => {
    const isSameName = cocoLabels[obj.labelIdx] === targetName; 
    const objCX = obj.x + (obj.width / 2);
    let objDir = "Trực diện";
    if (objCX < 106) objDir = "Bên trái";
    else if (objCX > 213) objDir = "Bên phải";
    return isSameName && (objDir === direction);
  }).length;

  const hasSurroundingThreats = trackedObstacles.some(obj => {
    const cx = obj.x + (obj.width / 2);
    let dir = "Trực diện";
    if (cx < 106) dir = "Bên trái";
    else if (cx > 213) dir = "Bên phải";
    const bottomY = obj.y + obj.height;
    return (dir !== direction) && (bottomY > 160);
  });
  
  let displayAlertName = "";
  if (hasSurroundingThreats) {
    displayAlertName = "Chú ý: Có vật cản ở nhiều hướng";
  } else {
    const quantityText = countInSameDirection > 1 ? `${countInSameDirection} ` : '';
    displayAlertName = `${quantityText}${targetName} ${direction}`;
  }

  return displayAlertName; 
}