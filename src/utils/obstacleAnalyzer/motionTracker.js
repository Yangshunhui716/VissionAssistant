export function analyzeMotion(mostDangerousTarget, cocoLabelsVi) {
  'worklet';

  if (!mostDangerousTarget) return "Tĩnh";

  const targetName = cocoLabelsVi[mostDangerousTarget.labelIdx];
  const currentArea = mostDangerousTarget.width * mostDangerousTarget.height;
  const cx = mostDangerousTarget.x + mostDangerousTarget.width / 2;
  const cy = mostDangerousTarget.y + mostDangerousTarget.height / 2;

  global.targetTracker = global.targetTracker || [];

  if (global.targetTracker.length > 0) {
    const lastFrame = global.targetTracker[global.targetTracker.length - 1];
    const distance = Math.hypot(cx - lastFrame.cx, cy - lastFrame.cy);
    if (distance > 50 || lastFrame.name !== targetName) {
      global.targetTracker = []; 
    }
  }

  global.targetTracker.push({ name: targetName, area: currentArea, cx, cy });

  if (global.targetTracker.length > 5) {
    global.targetTracker.shift();
  }

  let motionState = "Tĩnh";
  if (global.targetTracker.length >= 3) {
    const oldestFrame = global.targetTracker[0];
    const newestFrame = global.targetTracker[global.targetTracker.length - 1];

    const areaGrowth = newestFrame.area / oldestFrame.area;
    if (areaGrowth > 1.15) { 
      motionState = "Đang tiến lại gần !";
    }

    const moveX = newestFrame.cx - oldestFrame.cx;
    if (Math.abs(moveX) > 30) { 
      motionState = moveX > 0 ? "Cắt ngang sang phải" : "Cắt ngang sang trái";
    }
  }

  return motionState;
}