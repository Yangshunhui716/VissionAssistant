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
  const isModelLoaded = useRef(false);
  const isSwitching = useRef(false);
  const ignoreWakeRef = useRef(0);

  const changeState = (newState, promptObj) => {
    stateRef.current = newState;
    setAppState(newState);

    if (promptObj) {
      playFeedback(promptObj);
    }
  };

  const startVoskGuard = async () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      isSwitching.current = true;
      ignoreWakeRef.current = Date.now() + voiceConfig.WAKE_LOCK_MS;
      changeState('SLEEP', PROMPTS.system.sleeping);

      if (isModelLoaded.current) {
        await vosk.stop();
        await vosk.start({
          grammar: WAKE_GRAMMAR,
        });
      }

      isSwitching.current = false;
    } catch (e) {
      if (debugConfigRef.current.logging) {
        console.log('Error Vosk Guard: ', e);
      }

      isSwitching.current = false;
    }
  };

  const switchToListening = async () => {
    try {
      if (isSwitching.current) return;

      isSwitching.current = true;
      haptics.wakeUp();
      changeState('WAKING_UP', PROMPTS.system.wakingUp);

      await vosk.stop();
      await vosk.start({
        grammar: COMMAND_GRAMMAR,
      });

      changeState('LISTENING', PROMPTS.system.listening);
      isSwitching.current = false;
    } catch (e) {
      isSwitching.current = false;
      startVoskGuard();
    }
  };

  const finalizeCommand = async finalText => {
    if (isSwitching.current) return;

    isSwitching.current = true;
    await vosk.stop();

    if (debugConfigRef.current.logging) {
      console.log('LỆNH ĐÃ CHỐT: ', finalText);
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

    setTimeout(startVoskGuard, voiceConfig.POST_COMMAND_COOLDOWN_MS);
  };

  useEffect(() => {
    if (!hasMicPermission) return;

    let isCancelled = false;

    const initializeVosk = async () => {
      try {
        await vosk.loadModel('model-vn-vn');

        if (isCancelled) return;

        isModelLoaded.current = true;
        await startVoskGuard();
      } catch (e) {
        if (debugConfigRef.current.logging && !isCancelled) {
          console.log('Error load Vosk: ', e);
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
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (text.length >= voiceConfigRef.current.MIN_COMMAND_LENGTH) {
            finalizeCommand(text);
          } else {
            startVoskGuard();
          }
        }, voiceConfigRef.current.SILENCE_TIMEOUT_MS);
      }
    });

    return () => {
      isCancelled = true;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
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
