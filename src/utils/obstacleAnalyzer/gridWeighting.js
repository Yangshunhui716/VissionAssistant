import { getBoxCenters } from '../spatialProcessor/geometryUtils';

/**
 * Thuật toán Ma trận Trọng số Không gian Động học (Kinematic-Aware Dynamic Spatial Weighting)
 * Thuộc Phase 2 - Tuần 7 (Task 32)
 *
 * Tích hợp 4 lớp trọng số có cơ sở khoa học:
 * 1. Ma trận lưới 3x3 tĩnh (Row x Col): Ưu tiên không gian bước chân (Row 2 > Row 1 > Row 0).
 * 2. Vector vận tốc quỹ đạo (Trajectory Vector vx): Tăng 35% cho vật cản cắt ngang hướng vào tâm bước đi (col 0 sang phải hoặc col 2 sang trái).
 * 3. Mức độ đe dọa va chạm động học (Threat Level & Motion từ Task 31): Tăng gấp đôi cho CRITICAL (TTC <= 1.5s), tăng 40% cho WARNING, giảm 30% cho vật cản đang lùi xa an toàn.
 * 4. Cơ chế Hysteresis (Target Retention Bonus từ Task 28): Dập tắt nhảy nhãn TTS (flickering).
 */
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

  const inwardBonus = obstacleConfig.CROSS_INWARD_BONUS || 1.35;
  const outwardPenalty = obstacleConfig.CROSS_OUTWARD_PENALTY || 0.85;
  const criticalBonus = obstacleConfig.THREAT_CRITICAL_BONUS || 2.0;
  const warningBonus = obstacleConfig.THREAT_WARNING_BONUS || 1.4;
  const recedingPenalty = obstacleConfig.RECEDING_PENALTY || 0.7;
  const retentionBonus = obstacleConfig.TARGET_RETENTION_BONUS || 1.25;

  validObstacles.forEach(obj => {
    const area = obj.width * obj.height;
    const { cx, bottomY } = getBoxCenters(obj);

    let col = Math.floor((cx - yoloBounds.padX) / cellW);
    col = Math.max(0, Math.min(2, col));

    let row = Math.floor((bottomY - yoloBounds.padY) / cellH);
    row = Math.max(0, Math.min(2, row));

    const baseWeight = obstacleConfig.GRID_WEIGHTS[row][col];
    let dynamicWeight = baseWeight;

    // 1. Phân tích vector vận tốc quỹ đạo cắt ngang (Trajectory Direction)
    const vx = obj.vx || 0;
    // Ngưỡng vận tốc tối thiểu 0.03 px/ms để loại trừ rung tay camera
    if (Math.abs(vx) > 0.03) {
      if (col === 0 && vx > 0) {
        // Cánh trái di chuyển cắt ngang vào trung tâm
        dynamicWeight *= inwardBonus;
      } else if (col === 2 && vx < 0) {
        // Cánh phải di chuyển cắt ngang vào trung tâm
        dynamicWeight *= inwardBonus;
      } else if ((col === 0 && vx < 0) || (col === 2 && vx > 0)) {
        // Di chuyển ly tâm ra khỏi luồng di chuyển
        dynamicWeight *= outwardPenalty;
      }
    }

    // 2. Phân tích mức độ đe dọa va chạm động học (Threat Level & Motion)
    if (obj.threatLevel === 'CRITICAL') {
      dynamicWeight *= criticalBonus;
    } else if (obj.threatLevel === 'WARNING') {
      dynamicWeight *= warningBonus;
    } else if (obj.motion === 'Đang lùi xa') {
      dynamicWeight *= recedingPenalty;
    }

    let dangerScore = area * dynamicWeight;

    // 3. Cơ chế Hysteresis lưu giữ mục tiêu hiện tại chống nhảy nhãn TTS
    if (labelsVi[obj.labelIdx] === lastTargetName) {
      dangerScore *= retentionBonus;
    }

    obj.baseGridWeight = baseWeight;
    obj.gridWeight = Math.round(dynamicWeight * 100) / 100;
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
