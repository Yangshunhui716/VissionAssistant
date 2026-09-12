import { getBoxCenters } from '../spatialProcessor/geometryUtils';

export const gridWeighting = (
  validObstacles,
  labelsVi,
  lastTargetName = '',
  obstacleConfig,
  yoloBounds,
) => {
  'worklet';

  if (validObstacles.length === 0) {
    return {
      mostDangerousTarget: null,
      targetName: null,
    };
  }

  const cellW = yoloBounds.newW / 3;
  const cellH = yoloBounds.newH / 3;

  validObstacles.forEach(obj => {
    const area = obj.width * obj.height;
    const { cx, bottomY } = getBoxCenters(obj);

    let col = Math.floor((cx - yoloBounds.padX) / cellW);
    col = Math.max(0, Math.min(2, col));

    let row = Math.floor((bottomY - yoloBounds.padY) / cellH);
    row = Math.max(0, Math.min(2, row));

    const weight = obstacleConfig.GRID_WEIGHTS[row][col];
    let dangerScore = area * weight;

    if (labelsVi[obj.labelIdx] === lastTargetName) {
      dangerScore *= obstacleConfig.TARGET_RETENTION_BONUS;
    }

    obj.dangerScore = dangerScore;
  });

  validObstacles.sort((a, b) => b.dangerScore - a.dangerScore);

  const mostDangerousTarget = validObstacles[0];
  const targetName = labelsVi[mostDangerousTarget.labelIdx];

  return {
    mostDangerousTarget,
    targetName,
  };
};
