import { getBoxCenters } from '../spatialProcessor/geometryUtils';

const TARGET_RETENTION_BONUS = 1.2; 

const GRID_WEIGHTS = [
  [0.5,  0.8,  0.5],
  [1.0,  1.5,  1.0],
  [2.0,  3.0,  2.0]
];

export const gridWeighting = (validObstacles, cocoLabelsVi, yoloSize, lastTargetName = "") => {
  'worklet';

  if (validObstacles.length === 0) {
    return { mostDangerousTarget: null, targetName: null };
  }

  const cellW = yoloSize / 3;
  const cellH = yoloSize / 3;

  validObstacles.forEach(obj => {
    const area = obj.width * obj.height;
    const { cx, bottomY } = getBoxCenters(obj);

    let col = Math.floor(cx / cellW);
    col = Math.max(0, Math.min(2, col));

    let row = Math.floor(bottomY / cellH);
    row = Math.max(0, Math.min(2, row));

    const weight = GRID_WEIGHTS[row][col];
    let dangerScore = area * weight;

    if (cocoLabelsVi[obj.labelIdx] === lastTargetName) {
      dangerScore *= TARGET_RETENTION_BONUS; 
    }

    obj.dangerScore = dangerScore;
  });

  validObstacles.sort((a, b) => b.dangerScore - a.dangerScore);
  
  const mostDangerousTarget = validObstacles[0];
  const targetName = cocoLabelsVi[mostDangerousTarget.labelIdx];

  return { mostDangerousTarget, targetName };
};