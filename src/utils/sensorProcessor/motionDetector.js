import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';

const UPDATE_INTERVAL_MS = 100;
const GRAVITY_CONSTANT = 9.81;
const SHAKE_FORCE_THRESHOLD = 4.5;
const SHAKE_DURATION_TRIGGER = 3000;
const WARN_COOLDOWN_MS = 10000;

setUpdateIntervalForType(SensorTypes.accelerometer, UPDATE_INTERVAL_MS);

let subscription = null;
let shakyTime = 0;
let lastWarnTime = 0;

export const startMotionGuard = (onMotionStateChange, onShakeWarning) => {
  if (subscription) return;

  subscription = accelerometer.subscribe(({ x, y, z }) => {
    const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
    const movementForce = Math.abs(totalAcceleration - GRAVITY_CONSTANT);

    if (movementForce > SHAKE_FORCE_THRESHOLD) {
      if (onMotionStateChange) onMotionStateChange(true);
      shakyTime += UPDATE_INTERVAL_MS;

      const now = Date.now();
      if (
        shakyTime > SHAKE_DURATION_TRIGGER &&
        now - lastWarnTime > WARN_COOLDOWN_MS
      ) {
        if (onShakeWarning) onShakeWarning();
        lastWarnTime = now;
        shakyTime = 0;
      }
    } else {
      if (onMotionStateChange) onMotionStateChange(false);
      shakyTime = 0;
    }
  });

  console.log('[TIỀN ĐÌNH] Đã kích hoạt cảm biến chống nhòe ảnh.');
};

export const stopMotionGuard = () => {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
    console.log('[TIỀN ĐÌNH] Đã tắt cảm biến.');
  }
};