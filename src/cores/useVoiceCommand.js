import { useEffect, useRef } from 'react';
import * as vosk from 'react-native-vosk';
import {
  COMMAND_GRAMMAR,
  WAKE_GRAMMAR,
} from '../utils/languageProcessor/grammar';
import { analyzeCommand } from '../utils/languageProcessor/intentAnalyzer';
import { PROMPTS } from '../utils/languageProcessor/feedbackPrompts';
import { IS_DEBUG } from '../utils/debug/debug';

const SILENCE_TIMEOUT_MS = 1500;
const POST_COMMAND_COOLDOWN_MS = 3500;
const MIN_COMMAND_LENGTH = 2;
const WAKE_LOCK_MS = 4500;

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
  const stateRef = useRef('SLEEP');
  const timeoutRef = useRef(null);
  const isModelLoaded = useRef(false);
  const isSwitching = useRef(false);
  const ignoreWakeRef = useRef(0);

  const changeState = (newState, promptObj) => {
    stateRef.current = newState;
    setAppState(newState);
    if (promptObj) playFeedback(promptObj);
  };

  const startVoskGuard = async () => {
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isSwitching.current = true;
      ignoreWakeRef.current = Date.now() + WAKE_LOCK_MS;
      
      changeState('SLEEP', PROMPTS.system.sleeping);

      if (isModelLoaded.current) {
        await vosk.stop();
        await vosk.start({ grammar: WAKE_GRAMMAR });
      }
      isSwitching.current = false;
    } catch (e) {
      console.log('Error Vosk Guard: ', e);
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

      await vosk.start({ grammar: COMMAND_GRAMMAR });
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

    if (IS_DEBUG) console.log('LỆNH ĐÃ CHỐT: ', finalText);
    const { intent, targetName } = analyzeCommand(finalText);

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
      playFeedback(PROMPTS.search.start(targetName));
    } else if (intent === 'SCAN_GENERAL') {
      setTargetToFind(null);
      setIsScanningText(false);
      setIsScanningCurrency(false);
      setIsScanningGeneral(true);
      playFeedback(PROMPTS.scan.start);
    } else if (intent === 'SCAN_CURRENCY') {
      setTargetToFind(null);
      setIsScanningGeneral(false);
      setIsScanningText(false);
      setIsScanningCurrency(true);
      playFeedback(PROMPTS.currency.start);
    } else if (intent === 'SCAN_TEXT') {
      setTargetToFind(null);
      setIsScanningGeneral(false);
      setIsScanningCurrency(false);
      setIsScanningText(true);
      playFeedback(PROMPTS.text.start);
    } else {
      haptics.error();
      playFeedback(PROMPTS.error.invalidCommand);
    }

    setTimeout(startVoskGuard, POST_COMMAND_COOLDOWN_MS);
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

      if (IS_DEBUG) console.log('KẾT QUẢ VOSK: ', text);

      if (stateRef.current === 'SLEEP') {
        if (Date.now() < ignoreWakeRef.current) return;
        if (text.match(/(xin chào|trợ lý)/)) switchToListening();
      } else if (stateRef.current === 'LISTENING') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (text.length > MIN_COMMAND_LENGTH) finalizeCommand(text);
          else startVoskGuard();
        }, SILENCE_TIMEOUT_MS);
      }
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
