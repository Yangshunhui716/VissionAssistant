import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Vibration } from 'react-native';
import Tts from 'react-native-tts';


Tts.setDefaultLanguage('vi-VN');
Tts.setDefaultRate(0.5); 

export const useFeedbackController = () => {
  const [uiTranscript, setUiTranscript] = useState("Đang chờ khởi tạo...");
  const currentPriorityRef = useRef(99);
  const lastActionTimeRef = useRef(Date.now());

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

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
      if (timeSinceLastAction > 6000) {
        Vibration.vibrate(40); 
        lastActionTimeRef.current = Date.now(); 
      }
    }, 1000);
    return () => clearInterval(heartbeatInterval);
  }, []);

  const playFeedback = useCallback((promptObj) => {
    if (promptObj.ui) {
      setUiTranscript(promptObj.ui);
    }

    if (promptObj.tts) {
      const incomingPriority = promptObj.priority || 3;

      if (incomingPriority <= currentPriorityRef.current) {
        if (incomingPriority === 1) Tts.stop();

        Tts.speak(promptObj.tts); 
        currentPriorityRef.current = incomingPriority;
        lastActionTimeRef.current = Date.now();
      } 
      else {
        console.log(`[BỘ ĐIỀU PHỐI] Đã bỏ qua câu "${promptObj.tts}" vì AI đang bận đọc lệnh ưu tiên cao hơn.`);
      }
    }
  }, []);

  const haptics = useMemo(() => ({
    wakeUp: () => { Vibration.vibrate(100); lastActionTimeRef.current = Date.now(); }, 
    success: () => { Vibration.vibrate([0, 100, 100, 100]); lastActionTimeRef.current = Date.now(); }, 
    error: () => { Vibration.vibrate(500); lastActionTimeRef.current = Date.now(); }, 
  }), []);

  return { uiTranscript, playFeedback, haptics };
};