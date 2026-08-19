export const gridWeighting = (validObstacles, cocoLabelsVi, yoloSize) => {
  'worklet';

  if (validObstacles.length === 0) {
    return { mostDangerousTarget: null, targetName: null };
  }

  const firstBorder = yoloSize / 3;
  const secondBorder = (yoloSize * 2) / 3;

  validObstacles.forEach(obj => {
    const area = obj.width * obj.height;
    const bottomY = obj.y + obj.height;
    
    let weight = 1.0;
    if (bottomY < firstBorder) weight = 0.5;
    else if (bottomY < secondBorder) weight = 1.0;
    else weight = 2.0;

    obj.dangerScore = area * weight;
  });

  validObstacles.sort((a, b) => b.dangerScore - a.dangerScore);
  
  const mostDangerousTarget = validObstacles[0];
  const targetName = cocoLabelsVi[mostDangerousTarget.labelIdx];

  return { mostDangerousTarget, targetName };
};