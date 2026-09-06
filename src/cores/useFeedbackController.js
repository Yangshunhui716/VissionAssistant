import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Vibration } from 'react-native';
import Tts from 'react-native-tts';

const TTS_RATE = 0.6;

const HEARTBEAT_TIMEOUT_MS = 6000;
const HEARTBEAT_TICK_MS = 1000;
const HEARTBEAT_VIBE_DURATION = 40;

const PRIORITY_IDLE = 99;
const PRIORITY_DEFAULT = 3;
const PRIORITY_INTERRUPT = 1;

const HAPTIC_WAKE_UP = 100;
const HAPTIC_SUCCESS = [0, 100, 100, 100];
const HAPTIC_ERROR = 500;

Tts.setDefaultLanguage('vi-VN');
Tts.setDefaultRate(TTS_RATE);

export const useFeedbackController = () => {
  const [uiTranscript, setUiTranscript] = useState('Đang chờ khởi tạo...');
  const currentPriorityRef = useRef(PRIORITY_IDLE);
  const lastActionTimeRef = useRef(Date.now());

  useEffect(() => {
    const onFinish = () => {
      currentPriorityRef.current = PRIORITY_IDLE;
    };
    const onCancel = () => {
      currentPriorityRef.current = PRIORITY_IDLE;
    };

    Tts.addEventListener('tts-finish', onFinish);
    Tts.addEventListener('tts-cancel', onCancel);

    return () => {
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, []);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
      if (timeSinceLastAction > HEARTBEAT_TIMEOUT_MS) {
        Vibration.vibrate(HEARTBEAT_VIBE_DURATION);
        lastActionTimeRef.current = Date.now();
      }
    }, HEARTBEAT_TICK_MS);
    return () => clearInterval(heartbeatInterval);
  }, []);

  const playFeedback = useCallback(promptObj => {
    if (promptObj.ui) {
      setUiTranscript(promptObj.ui);
    }

    if (promptObj.tts) {
      const incomingPriority = promptObj.priority || PRIORITY_DEFAULT;

      if (incomingPriority <= currentPriorityRef.current) {
        if (incomingPriority === PRIORITY_INTERRUPT) Tts.stop();

        Tts.speak(promptObj.tts);
        currentPriorityRef.current = incomingPriority;
        lastActionTimeRef.current = Date.now();
      } 
    }
  }, []);

  const haptics = useMemo(
    () => ({
      wakeUp: () => {
        Vibration.vibrate(HAPTIC_WAKE_UP);
        lastActionTimeRef.current = Date.now();
      },
      success: () => {
        Vibration.vibrate(HAPTIC_SUCCESS);
        lastActionTimeRef.current = Date.now();
      },
      error: () => {
        Vibration.vibrate(HAPTIC_ERROR);
        lastActionTimeRef.current = Date.now();
      },
    }),
    [],
  );

  return { uiTranscript, playFeedback, haptics };
};