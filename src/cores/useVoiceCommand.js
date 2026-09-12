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
  const voice = config.voice;
  const intentConfig = config.intent;
  const debug = config.debug;

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
      ignoreWakeRef.current = Date.now() + voice.WAKE_LOCK_MS;
      changeState('SLEEP', PROMPTS.system.sleeping);

      if (isModelLoaded.current) {
        await vosk.stop();
        await vosk.start({
          grammar: WAKE_GRAMMAR,
        });
      }

      isSwitching.current = false;
    } catch (e) {
      if (debug.logging) {
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

    if (debug.logging) {
      console.log('LỆNH ĐÃ CHỐT: ', finalText);
    }

    const { intent, targetName } = analyzeCommand(
      finalText,
      intentConfig,
      debug.logging,
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
      setTargetToFind(targetName);
    } else if (intent === 'SCAN_GENERAL') {
      setTargetToFind(null);
      setIsScanningText(false);
      setIsScanningCurrency(false);
      setIsScanningGeneral(true);
    } else if (intent === 'SCAN_CURRENCY') {
      setTargetToFind(null);
      setIsScanningGeneral(false);
      setIsScanningText(false);
      setIsScanningCurrency(true);
    } else if (intent === 'SCAN_TEXT') {
      setTargetToFind(null);
      setIsScanningGeneral(false);
      setIsScanningCurrency(false);
      setIsScanningText(true);
    } else {
      haptics.error()
      playFeedback(PROMPTS.error.invalidCommand);
    }

    setTimeout(startVoskGuard, voice.POST_COMMAND_COOLDOWN_MS);
  };

  useEffect(() => {
    if (!hasMicPermission) return;

    vosk.loadModel('model-vn-vn').then(() => {
      isModelLoaded.current = true;
      startVoskGuard();
    });

    const voskResult = vosk.onPartialResult(res => {
      if (isSwitching.current) return;

      const text = (res || '').toString().toLowerCase().trim();

      if (!text) return;

      if (debug.logging) {
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
          if (text.length >= voice.MIN_COMMAND_LENGTH) {
            finalizeCommand(text);
          } else {
            startVoskGuard();
          }
        }, voice.SILENCE_TIMEOUT_MS);
      }
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      vosk.stop();
      vosk.unload();
      voskResult.remove();

      isModelLoaded.current = false;
    };
  }, [
    hasMicPermission,
    voice.SILENCE_TIMEOUT_MS,
    voice.POST_COMMAND_COOLDOWN_MS,
    voice.MIN_COMMAND_LENGTH,
    voice.WAKE_LOCK_MS,
    debug.logging,
    intentConfig,
  ]);

  return {
    manualWakeUp: switchToListening,
    manualStop: startVoskGuard,
  };
};
