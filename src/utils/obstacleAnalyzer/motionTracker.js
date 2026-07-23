export function analyzeMotion(validObstacles, targetName, cocoLabelsVi) {
  'worklet';
  
  if (validObstacles.length === 0 || !targetName) return "Tĩnh";
  global.motionHistories = global.motionHistories || {};

  validObstacles.forEach(obj => {
    const name = cocoLabelsVi[obj.labelIdx];

    if (!global.motionHistories[name]) {
      global.motionHistories[name] = [];
    }

    const area = obj.width * obj.height;
    const cx = obj.x + obj.width / 2;
    global.motionHistories[name].push({ area, cx });

    if (global.motionHistories[name].length > 5) {
      global.motionHistories[name].shift();
    }
  });

  const targetHistory = global.motionHistories[targetName];
  let motionState = "Tĩnh";

  if (targetHistory && targetHistory.length >= 3) {
    const oldestFrame = targetHistory[0];
    const newestFrame = targetHistory[targetHistory.length - 1];

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