/**
 * Bộ điều phối suy luận MiDaS thích ứng (Adaptive Inference Scheduler)
 * Thuộc Phase 2 - Tuần 5 (Task 21 & Task 22)
 *
 * Thuật toán 3 tầng nhận biết rủi ro động học (Three-Tier Kinematic-Risk Scheduler):
 * - Tầng 1: Lưới rủi ro không gian (Spatial Risk Tier) - chỉ kích hoạt khi gridWeight >= MIDAS_MIN_GRID_WEIGHT (1.5)
 * - Tầng 2: Động học Bounding Box (Kinematic Trigger Tier) - biến thiên diện tích >= 20% hoặc dịch chuyển tâm >= 15%
 * - Tầng 3: Nhịp bảo vệ trần & nhận dạng mục tiêu (Safety Ceiling & Target Identity) - mục tiêu mới hoặc quá 4000ms
 */

export const evaluateAdaptiveMidasTrigger = (
  mostDangerousTarget,
  targetName,
  lastMidasTarget,
  lastState,
  now,
  visionConfig,
  yoloBounds,
) => {
  'worklet';

  if (!mostDangerousTarget) {
    return {
      shouldTriggerMidas: false,
      currentArea: 0,
      currentCx: 0,
      currentCy: 0,
      reason: 'NO_TARGET',
    };
  }

  const currentArea = mostDangerousTarget.width * mostDangerousTarget.height;

  // Tính tọa độ tâm chuẩn hóa [0, 1] trên khung hình YOLO
  const currentCx =
    (mostDangerousTarget.x + mostDangerousTarget.width / 2 - yoloBounds.padX) /
    (yoloBounds.newW || 1);
  const currentCy =
    (mostDangerousTarget.y + mostDangerousTarget.height / 2 - yoloBounds.padY) /
    (yoloBounds.newH || 1);

  const timeSinceLastMidas = now - (lastState.lastTime || 0);
  const isNewTarget = targetName !== lastMidasTarget;

  // Tầng 1: Kiểm tra vùng nguy hiểm (Trọng số lưới >= ngưỡng nguy hiểm)
  const gridWeight =
    mostDangerousTarget.gridWeight !== undefined
      ? mostDangerousTarget.gridWeight
      : mostDangerousTarget.dangerScore / (currentArea || 1);
  const isHighRiskZone =
    gridWeight >= (visionConfig.MIDAS_MIN_GRID_WEIGHT || 1.5);

  // Tầng 2: Kiểm tra biến thiên động học Bounding Box
  const lastArea = lastState.lastArea || 0;
  const lastCx = lastState.lastCx ?? currentCx;
  const lastCy = lastState.lastCy ?? currentCy;

  const areaDeltaRatio =
    lastArea > 0 ? Math.abs(currentArea - lastArea) / lastArea : 1.0;
  const hasSignificantAreaChange =
    areaDeltaRatio >= (visionConfig.MIDAS_AREA_GROWTH_THRESHOLD || 0.2);

  const centerShift = Math.sqrt(
    Math.pow(currentCx - lastCx, 2) + Math.pow(currentCy - lastCy, 2),
  );
  const hasSignificantShift =
    centerShift >= (visionConfig.MIDAS_CENTER_SHIFT_THRESHOLD || 0.15);

  const isApproaching =
    mostDangerousTarget.motion === 'Đang tiến lại gần !';
  const hasKinematicChange =
    hasSignificantAreaChange || hasSignificantShift || isApproaching;

  // Tầng 3: Nhịp bảo vệ trần (Ceiling Timeout) hoặc đối tượng mới
  const isCeilingTimeout =
    timeSinceLastMidas > (visionConfig.MIDAS_CEILING_TIMEOUT_MS || 4000);
  const isTargetNewOrExpired =
    isNewTarget && timeSinceLastMidas > visionConfig.MIDAS_TARGET_DELAY_MS;

  // Quyết định kích hoạt MiDaS thích ứng (Adaptive Triggering)
  const shouldTriggerMidas =
    (isHighRiskZone &&
      hasKinematicChange &&
      timeSinceLastMidas > visionConfig.MIDAS_TARGET_DELAY_MS) ||
    isTargetNewOrExpired ||
    (isHighRiskZone && isCeilingTimeout);

  let reason = 'SLEEPING';
  if (shouldTriggerMidas) {
    if (isTargetNewOrExpired) {
      reason = 'NEW_TARGET';
    } else if (hasKinematicChange) {
      reason = 'KINEMATIC_CHANGE';
    } else if (isCeilingTimeout) {
      reason = 'CEILING_TIMEOUT';
    }
  }

  return {
    shouldTriggerMidas,
    currentArea,
    currentCx,
    currentCy,
    reason,
  };
};
