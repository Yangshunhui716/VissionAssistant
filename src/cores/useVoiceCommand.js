import { useEffect, useRef } from 'react';
import * as vosk from 'react-native-vosk';

import {
  COMMAND_GRAMMAR,
  WAKE_GRAMMAR,
} from '../utils/languageProcessor/grammar';
import { analyzeCommand } from '../utils/languageProcessor/intentAnalyzer';
import { PROMPTS } from '../utils/languageProcessor/feedbackPrompts';
import { useRuntimeConfig } from '../context/RuntimeConfigContext';

export const useVoiceCommand = (
  hasMicPermission,
  playFeedback,
  haptics,
  setAppState,
  setIsObstacleActive,
  setTargetToFind,
  setIsScanningGeneral,
  setIsScanningCurrency,
  setIsScanningText,
) => {
  const { config } = useRuntimeConfig();
  const voiceConfig = config.voice;
  const intentConfig = config.intent;
  const debugConfig = config.debug;

  const voiceConfigRef = useRef(voiceConfig);
  const intentConfigRef = useRef(intentConfig);
  const debugConfigRef = useRef(debugConfig);

  useEffect(() => {
    voiceConfigRef.current = voiceConfig;
    intentConfigRef.current = intentConfig;
    debugConfigRef.current = debugConfig;
  }, [voiceConfig, intentConfig, debugConfig]);

  const stateRef = useRef('SLEEP');
  const timeoutRef = useRef(null);
  const cooldownRef = useRef(null);
  const isModelLoaded = useRef(false);
  const isSwitching = useRef(false);
  const isCancelledRef = useRef(false);
  const ignoreWakeRef = useRef(0);

  const changeState = (newState, promptObj) => {
    stateRef.current = newState;
    setAppState(newState);

    if (promptObj) {
      playFeedback(promptObj);
    }
  };

  const startVoskGuard = async () => {
    if (isCancelledRef.current) return;

    try {
      if (isSwitching.current) return;

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      isSwitching.current = true;
      ignoreWakeRef.current = Date.now() + voiceConfigRef.current.WAKE_LOCK_MS;
      changeState('SLEEP', PROMPTS.system.sleeping);

      if (isCancelledRef.current) return;

      if (isModelLoaded.current) {
        await vosk.stop();

        if (isCancelledRef.current) return;

        await vosk.start({
          grammar: WAKE_GRAMMAR,
        });
      }
    } catch (e) {
      if (debugConfigRef.current.logging && !isCancelledRef.current) {
        console.log('[useVoiceCommand] Error Vosk Guard: ', e);
      }
    } finally {
      isSwitching.current = false;
    }
  };

  const switchToListening = async () => {
    if (isCancelledRef.current) return;
    if (isSwitching.current) return;

    isSwitching.current = true;

    try {
      haptics.wakeUp();

      changeState('WAKING_UP', PROMPTS.system.wakingUp);

      await vosk.stop();

      if (isCancelledRef.current) return;

      await vosk.start({
        grammar: COMMAND_GRAMMAR,
      });

      if (isCancelledRef.current) return;

      changeState('LISTENING', PROMPTS.system.listening);
    } catch (e) {
      if (debugConfigRef.current.logging && !isCancelledRef.current) {
        console.log('[useVoiceCommand] Error change state: ', e);
      }

      if (!isCancelledRef.current) {
        isSwitching.current = false;
        await startVoskGuard();
      }
    } finally {
      isSwitching.current = false;
    }
  };

  const finalizeCommand = async finalText => {
    if (isCancelledRef.current) return;

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isSwitching.current) return;

    isSwitching.current = true;
    try {
      await vosk.stop();

      if (isCancelledRef.current) return;

      if (debugConfigRef.current.logging) {
        console.log('[useVoiceCommand] LỆNH ĐÃ NGHE: ', finalText);
      }

      const { intent, targetName } = analyzeCommand(
        finalText,
        intentConfigRef.current,
        debugConfigRef.current.logging,
      );

      if (intent === 'OBSTACLE_ON') {
        setTargetToFind(null);
        setIsScanningGeneral(false);
        setIsScanningText(false);
        setIsScanningCurrency(false);
        setIsObstacleActive(true);
        playFeedback(PROMPTS.obstacle.on);
      } else if (intent === 'OBSTACLE_OFF') {
        setIsObstacleActive(false);
        playFeedback(PROMPTS.obstacle.off);
      } else if (intent === 'FIND') {
        setIsScanningGeneral(false);
        setIsScanningText(false);
        setIsScanningCurrency(false);
        if (targetName) setTargetToFind(targetName);
        else playFeedback(PROMPTS.find.invalid);
      } else if (intent === 'GENERAL') {
        setTargetToFind(null);
        setIsScanningText(false);
        setIsScanningCurrency(false);
        setIsScanningGeneral(true);
      } else if (intent === 'CURRENCY') {
        setTargetToFind(null);
        setIsScanningGeneral(false);
        setIsScanningText(false);
        setIsScanningCurrency(true);
      } else if (intent === 'TEXT') {
        setTargetToFind(null);
        setIsScanningGeneral(false);
        setIsScanningCurrency(false);
        setIsScanningText(true);
      } else {
        haptics.error();
        playFeedback(PROMPTS.error.invalidCommand);
      }
    } catch (e) {
      if (debugConfigRef.current.logging && !isCancelledRef.current) {
        console.log('[useVoiceCommand] Error finalize command: ', e);
      }
    } finally {
      isSwitching.current = false;

      if (!isCancelledRef.current) {
        if (cooldownRef.current !== null) {
          clearTimeout(cooldownRef.current);
          cooldownRef.current = null;
        }

        cooldownRef.current = setTimeout(() => {
          cooldownRef.current = null;

          if (!isCancelledRef.current) {
            startVoskGuard();
          }
        }, voiceConfigRef.current.POST_COMMAND_COOLDOWN_MS);
      }
    }
  };

  useEffect(() => {
    if (!hasMicPermission) return;

    isCancelledRef.current = false;

    const initializeVosk = async () => {
      try {
        await vosk.loadModel('model-vn-vn');

        if (isCancelledRef.current) return;

        isModelLoaded.current = true;
        await startVoskGuard();
      } catch (e) {
        if (debugConfigRef.current.logging && !isCancelledRef.current) {
          console.log('[useVoiceCommand] Error load Vosk: ', e);
        }
      }
    };

    initializeVosk();

    const voskResult = vosk.onPartialResult(res => {
      if (isSwitching.current) return;

      const text = (res || '').toString().toLowerCase().trim();
      if (!text) return;

      if (debugConfigRef.current.logging) {
        console.log('KẾT QUẢ VOSK: ', text);
      }

      if (stateRef.current === 'SLEEP') {
        if (Date.now() < ignoreWakeRef.current) {
          return;
        }

        if (text.match(/(xin chào|trợ lý)/)) {
          switchToListening();
        }
      } else if (stateRef.current === 'LISTENING') {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          if (isCancelledRef.current) return;

          if (text.length >= voiceConfigRef.current.MIN_COMMAND_LENGTH) {
            finalizeCommand(text);
          } else {
            startVoskGuard();
          }
        }, voiceConfigRef.current.SILENCE_TIMEOUT_MS);
      }
    });

    return () => {
      isCancelledRef.current = true;

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (cooldownRef.current !== null) {
        clearTimeout(cooldownRef.current);
        cooldownRef.current = null;
      }

      vosk.stop();
      vosk.unload();
      voskResult.remove();

      isModelLoaded.current = false;
    };
  }, [hasMicPermission]);

  return {
    manualWakeUp: switchToListening,
    manualStop: startVoskGuard,
  };
};
