import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';

let subscription = null;
let shakyTime = 0;
let lastWarnTime = 0;

export const startMotionGuard = (
  onMotionStateChange,
  onShakeWarning,
  motionConfig,
) => {
  if (subscription) return;

  const UPDATE_INTERVAL_MS = motionConfig.UPDATE_INTERVAL_MS;

  const GRAVITY_CONSTANT = motionConfig.GRAVITY_CONSTANT;

  const SHAKE_FORCE_THRESHOLD = motionConfig.SHAKE_FORCE_THRESHOLD;

  const SHAKE_DURATION_TRIGGER = motionConfig.SHAKE_DURATION_TRIGGER;

  const WARN_COOLDOWN_MS = motionConfig.WARN_COOLDOWN_MS;

  setUpdateIntervalForType(SensorTypes.accelerometer, UPDATE_INTERVAL_MS);

  subscription = accelerometer.subscribe(({ x, y, z }) => {
    const totalAcceleration = Math.sqrt(x * x + y * y + z * z);

    const movementForce = Math.abs(totalAcceleration - GRAVITY_CONSTANT);

    if (movementForce > SHAKE_FORCE_THRESHOLD) {
      if (onMotionStateChange) {
        onMotionStateChange(true);
      }

      shakyTime += UPDATE_INTERVAL_MS;

      const now = Date.now();

      if (
        shakyTime > SHAKE_DURATION_TRIGGER &&
        now - lastWarnTime > WARN_COOLDOWN_MS
      ) {
        if (onShakeWarning) {
          onShakeWarning();
        }

        lastWarnTime = now;
        shakyTime = 0;
      }
    } else {
      if (onMotionStateChange) {
        onMotionStateChange(false);
      }

      shakyTime = 0;
    }
  });
};

export const stopMotionGuard = () => {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }
};
