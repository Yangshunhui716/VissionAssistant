import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Vibration } from 'react-native';
import Tts from 'react-native-tts';

import { useRuntimeConfig } from '../context/RuntimeConfigContext';

export const useFeedbackController = () => {
  const { config } = useRuntimeConfig();
  const feedback = config.feedback;

  const [uiTranscript, setUiTranscript] = useState('Đang chờ khởi tạo...');
  const currentPriorityRef = useRef(feedback.PRIORITY_IDLE);
  const lastActionTimeRef = useRef(Date.now());

  useEffect(() => {
    Tts.setDefaultLanguage(feedback.DEFAULT_LANGUAGE);
    Tts.setDefaultRate(feedback.TTS_RATE);
  }, [feedback.DEFAULT_LANGUAGE, feedback.TTS_RATE]);

  useEffect(() => {
    const onFinish = () => {
      currentPriorityRef.current = feedback.PRIORITY_IDLE;
    };

    const onCancel = () => {
      currentPriorityRef.current = feedback.PRIORITY_IDLE;
    };

    const finishListener = Tts.addEventListener('tts-finish', onFinish);
    const cancelListener = Tts.addEventListener('tts-cancel', onCancel);

    return () => {
      finishListener.remove();
      cancelListener.remove();
    };
  }, [feedback.PRIORITY_IDLE]);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;

      if (timeSinceLastAction > feedback.HEARTBEAT_TIMEOUT_MS) {
        Vibration.vibrate(
          feedback.HEARTBEAT_VIBE_DURATION
        );

        lastActionTimeRef.current = Date.now();
      }
    }, feedback.HEARTBEAT_TICK_MS);

    return () => clearInterval(heartbeatInterval);
  }, [
    feedback.HEARTBEAT_TIMEOUT_MS,
    feedback.HEARTBEAT_TICK_MS,
    feedback.HEARTBEAT_VIBE_DURATION,
  ]);

  const playFeedback = useCallback(
    promptObj => {
      if (!promptObj) return;

      if (promptObj.ui) {
        setUiTranscript(promptObj.ui);
      }

      if (!promptObj.tts) return;

      const incomingPriority = promptObj.priority ?? feedback.PRIORITY_DEFAULT;

      if (incomingPriority <= currentPriorityRef.current) {
        if (incomingPriority === feedback.PRIORITY_INTERRUPT) {
          Tts.stop();
        }

        Tts.speak(promptObj.tts);
        currentPriorityRef.current = incomingPriority;
        lastActionTimeRef.current = Date.now();
      }
    },
    [feedback.PRIORITY_DEFAULT, feedback.PRIORITY_INTERRUPT],
  );

  const haptics = useMemo(
    () => ({
      wakeUp: () => {
        Vibration.vibrate(feedback.HAPTIC_WAKE_UP);
        lastActionTimeRef.current = Date.now();
      },

      success: () => {
        Vibration.vibrate(feedback.HAPTIC_SUCCESS);
        lastActionTimeRef.current = Date.now();
      },

      error: () => {
        Vibration.vibrate(feedback.HAPTIC_ERROR);
        lastActionTimeRef.current = Date.now();
      },
    }),
    [feedback.HAPTIC_WAKE_UP, feedback.HAPTIC_SUCCESS, feedback.HAPTIC_ERROR],
  );

  return {
    uiTranscript,
    playFeedback,
    haptics,
  };
};
