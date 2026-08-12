import { useState, useEffect, useRef } from 'react';
import * as vosk from 'react-native-vosk'; 
import { COMMAND_GRAMMAR, WAKE_GRAMMAR } from '../utils/languageProcessor/grammar';
import { analyzeCommand } from '../utils/languageProcessor/intentAnalyzer';
import { PROMPTS } from '../utils/languageProcessor/feedbackPrompts';

export const useVoiceCommand = (hasMicPermission, playFeedback, haptics) => {
  const [appState, setAppState] = useState('SLEEP');
  const [targetToFind, setTargetToFind] = useState(null);
  const [isScanningGeneral, setIsScanningGeneral] = useState(false);
  
  const stateRef = useRef('SLEEP');
  const timeoutRef = useRef(null);
  const isModelLoaded = useRef(false); 
  const isSwitching = useRef(false);

  const changeState = (newState, promptObj) => {
    stateRef.current = newState;
    setAppState(newState);
    if (promptObj) playFeedback(promptObj);
  };

  const startVoskGuard = async () => {
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isSwitching.current = true;
      changeState('SLEEP', PROMPTS.system.sleeping);
      
      if (isModelLoaded.current) {
        await vosk.stop();
        await vosk.start({ grammar: WAKE_GRAMMAR });
      }
      isSwitching.current = false;
    } catch (e) {
      console.log("Lỗi Vosk Guard:", e);
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
      await new Promise(resolve => setTimeout(resolve, 600));

      await vosk.start({ grammar: COMMAND_GRAMMAR });
      changeState('LISTENING', PROMPTS.system.listening);
      
      isSwitching.current = false;
    } catch (e) {
      isSwitching.current = false;
      startVoskGuard();
    }
  };

  const finalizeCommand = async (finalText) => {
    if (isSwitching.current) return;
    await vosk.stop(); 
    console.log(">> LỆNH ĐÃ CHỐT:", finalText);
    const { intent, targetName } = analyzeCommand(finalText);

    if (intent === 'FIND') {
      setTargetToFind(targetName);
      playFeedback(PROMPTS.search.start(targetName));
    } 
    else if (intent === 'SCAN_GENERAL') {
      setIsScanningGeneral(true);
      playFeedback(PROMPTS.scan.start);
    } 
    else {
      haptics.error();
      playFeedback(PROMPTS.search.invalid);
    }

    setTimeout(startVoskGuard, 3500);
  };

  useEffect(() => {
    if (!hasMicPermission) return;

    vosk.loadModel('model-vn-vn').then(() => {
        isModelLoaded.current = true;
        startVoskGuard();
    });

    const voskResult = vosk.onPartialResult((res) => {
      if (isSwitching.current) return;
      const text = (res || "").toString().toLowerCase().trim();
      if (!text) return;
      console.log(">> KẾT QUẢ VOSK:", text);

      if (stateRef.current === 'SLEEP') {
        if (text.match(/(xin chào|trợ lý)/)) switchToListening();
      } 
      else if (stateRef.current === 'LISTENING') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (text.length > 2) finalizeCommand(text);
          else startVoskGuard(); 
        }, 1500); 
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
    appState, targetToFind, isScanningGeneral, 
    setTargetToFind, setIsScanningGeneral,
    manualWakeUp: switchToListening, 
    manualStop: startVoskGuard 
  };
};