import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';


setUpdateIntervalForType(SensorTypes.accelerometer, 100);

let subscription = null;
let shakyTime = 0;
let lastWarnTime = 0;

export const startMotionGuard = (onMotionStateChange, onShakeWarning) => {
  if (subscription) return;

  subscription = accelerometer.subscribe(({ x, y, z }) => {
    const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
    const movementForce = Math.abs(totalAcceleration - 9.81);

    if (movementForce > 4.5) {
      if (onMotionStateChange) onMotionStateChange(true);
      shakyTime += 100;
      
      const now = Date.now();
      if (shakyTime > 3000 && now - lastWarnTime > 10000) {
        if (onShakeWarning) onShakeWarning();
        lastWarnTime = now;
        shakyTime = 0;
      }
    } else {
      if (onMotionStateChange) onMotionStateChange(false);
      shakyTime = 0;
    }
  });
  
  console.log("[TIỀN ĐÌNH] Đã kích hoạt cảm biến chống nhòe ảnh.");
};

export const stopMotionGuard = () => {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
    console.log("[TIỀN ĐÌNH] Đã tắt cảm biến.");
  }
};