import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Vibration } from 'react-native';
import Tts from 'react-native-tts';

import { useRuntimeConfig } from '../context/RuntimeConfigContext';

export const useFeedbackController = () => {
  const { config } = useRuntimeConfig();
  const feedbackConfig = config.feedback;

  const [uiTranscript, setUiTranscript] = useState('Đang chờ khởi tạo...');
  const currentPriorityRef = useRef(feedbackConfig.PRIORITY_IDLE);
  const lastActionTimeRef = useRef(Date.now());

  useEffect(() => {
    Tts.setDefaultLanguage(feedbackConfig.DEFAULT_LANGUAGE);
    Tts.setDefaultRate(feedbackConfig.TTS_RATE);
  }, [feedbackConfig.DEFAULT_LANGUAGE, feedbackConfig.TTS_RATE]);

  useEffect(() => {
    const onFinish = () => {
      currentPriorityRef.current = feedbackConfig.PRIORITY_IDLE;
    };

    const onCancel = () => {
      currentPriorityRef.current = feedbackConfig.PRIORITY_IDLE;
    };

    const finishListener = Tts.addEventListener('tts-finish', onFinish);
    const cancelListener = Tts.addEventListener('tts-cancel', onCancel);

    return () => {
      finishListener.remove();
      cancelListener.remove();
    };
  }, [feedbackConfig.PRIORITY_IDLE]);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;

      if (timeSinceLastAction > feedbackConfig.HEARTBEAT_TIMEOUT_MS) {
        Vibration.vibrate(feedbackConfig.HEARTBEAT_VIBE_DURATION);

        lastActionTimeRef.current = Date.now();
      }
    }, feedbackConfig.HEARTBEAT_TICK_MS);

    return () => clearInterval(heartbeatInterval);
  }, [
    feedbackConfig.HEARTBEAT_TIMEOUT_MS,
    feedbackConfig.HEARTBEAT_TICK_MS,
    feedbackConfig.HEARTBEAT_VIBE_DURATION,
  ]);

  const playFeedback = useCallback(
    promptObj => {
      if (!promptObj) return;

      const incomingPriority =
        promptObj.priority ?? feedbackConfig.PRIORITY_DEFAULT;

      if (incomingPriority <= currentPriorityRef.current) {
        if (promptObj.ui) {
          setUiTranscript(promptObj.ui);
        }

        if (!promptObj.tts) return;

        if (
          incomingPriority === feedbackConfig.PRIORITY_EMERGENCY ||
          incomingPriority === feedbackConfig.PRIORITY_INTERRUPT ||
          incomingPriority < currentPriorityRef.current
        ) {
          Tts.stop();
        }
        Tts.speak(promptObj.tts);
        currentPriorityRef.current = incomingPriority;
        lastActionTimeRef.current = Date.now();
      }
    },
    [
      feedbackConfig.PRIORITY_DEFAULT,
      feedbackConfig.PRIORITY_INTERRUPT,
      feedbackConfig.PRIORITY_EMERGENCY,
    ],
  );

  const haptics = useMemo(
    () => ({
      emergency: () => {
        Vibration.vibrate(
          feedbackConfig.HAPTIC_EMERGENCY || [0, 200, 100, 300],
        );
        lastActionTimeRef.current = Date.now();
      },

      warning: () => {
        Vibration.vibrate(feedbackConfig.HAPTIC_WARNING || 250);
        lastActionTimeRef.current = Date.now();
      },

      wakeUp: () => {
        Vibration.vibrate(feedbackConfig.HAPTIC_WAKE_UP);
        lastActionTimeRef.current = Date.now();
      },

      success: () => {
        Vibration.vibrate(feedbackConfig.HAPTIC_SUCCESS);
        lastActionTimeRef.current = Date.now();
      },

      error: () => {
        Vibration.vibrate(feedbackConfig.HAPTIC_ERROR);
        lastActionTimeRef.current = Date.now();
      },
    }),
    [
      feedbackConfig.HAPTIC_EMERGENCY,
      feedbackConfig.HAPTIC_WARNING,
      feedbackConfig.HAPTIC_WAKE_UP,
      feedbackConfig.HAPTIC_SUCCESS,
      feedbackConfig.HAPTIC_ERROR,
    ],
  );

  return {
    uiTranscript,
    playFeedback,
    haptics,
  };
};
