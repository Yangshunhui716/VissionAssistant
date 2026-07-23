export function gridWeighting(validObstacles, cocoLabelsVi) {
  'worklet';

  if (validObstacles.length === 0) {
    return { mostDangerousTarget: null, targetName: null };
  }

  validObstacles.forEach(obj => {
    const area = obj.width * obj.height;
    const bottomY = obj.y + obj.height;
    
    let weight = 1.0;
    if (bottomY < 106) weight = 0.5;
    else if (bottomY < 213) weight = 1.0;
    else weight = 2.0;

    obj.dangerScore = area * weight;
  });

  validObstacles.sort((a, b) => b.dangerScore - a.dangerScore);
  
  const mostDangerousTarget = validObstacles[0];
  const targetName = cocoLabelsVi[mostDangerousTarget.labelIdx];

  return { mostDangerousTarget, targetName };
}