import { useState, useCallback, useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import Tts from 'react-native-tts';
import { AI_PROMPTS } from '../utils/languageProcessor/prompts';

Tts.setDefaultLanguage('vi-VN');
Tts.setDefaultRate(0.5); 

export const useFeedbackController = () => {
  const [uiTranscript, setUiTranscript] = useState("Đang chờ khởi tạo...");
  
  const currentPriorityRef = useRef(99); 

  useEffect(() => {
    const onFinish = () => { currentPriorityRef.current = 99; };
    const onCancel = () => { currentPriorityRef.current = 99; };

    Tts.addEventListener('tts-finish', onFinish);
    Tts.addEventListener('tts-cancel', onCancel);

    return () => {
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, []);

  const playFeedback = useCallback((promptObj) => {
    if (promptObj.ui) {
      setUiTranscript(promptObj.ui);
    }

    if (promptObj.tts) {
      const incomingPriority = promptObj.priority || 3;

      if (incomingPriority <= currentPriorityRef.current) {

        if (incomingPriority === 1) {
          Tts.stop();
        }

        Tts.speak(promptObj.tts); 
        currentPriorityRef.current = incomingPriority;
      } 
      else {
        console.log(`[BỘ ĐIỀU PHỐI] Đã bỏ qua câu "${promptObj.tts}" vì AI đang bận đọc lệnh ưu tiên cao hơn.`);
      }
    }
  }, []);

  const haptics = {
    wakeUp: () => Vibration.vibrate(100), 
    success: () => Vibration.vibrate([0, 100, 100, 100]), 
    error: () => Vibration.vibrate(500), 
  };

  return { uiTranscript, playFeedback, haptics, AI_PROMPTS };
};