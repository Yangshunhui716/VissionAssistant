import { useState, useEffect, useRef } from 'react';
import * as vosk from 'react-native-vosk'; 
import { VOSK_GRAMMAR } from '../utils/recognitionProcessor/cocoLabels';

export const useAudio = (hasMicPermission) => {
  const [appState, setAppState] = useState('SLEEP');
  const [transcript, setTranscript] = useState("Đang chờ khởi tạo...");
  
  const stateRef = useRef('SLEEP');
  const timeoutRef = useRef(null);
  
  const isModelLoaded = useRef(false); 

  const changeState = (newState, message) => {
    stateRef.current = newState;
    setAppState(newState);
    if (message) setTranscript(message);
  };

  const startVoskGuard = async () => {
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      changeState('SLEEP', 'Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)');
      
      if (isModelLoaded.current) {
        await vosk.start({ grammar: VOSK_GRAMMAR });
      }
    } catch (e) {
      console.log("Lỗi khởi động Vosk:", e);
    }
  };

  const finalizeCommand = (finalText) => {
    vosk.stop(); 
    changeState('PROCESSING', finalText);
    console.log(">> LỆNH ĐÃ CHỐT:", finalText);

    setTimeout(() => {
      startVoskGuard();
    }, 3000);
  };

  useEffect(() => {
    if (!hasMicPermission) return;

    vosk.loadModel('model-vn-vn')
      .then(() => {
        console.log("Nạp mô hình Vosk thành công!");
        isModelLoaded.current = true;
        startVoskGuard();
      })
      .catch((e) => {
        console.error("Lỗi nạp mô hình:", e);
        setTranscript("Lỗi: Không tìm thấy mô hình");
      });

    const voskResult = vosk.onPartialResult((res) => {
      const text = (res || "").toString().toLowerCase().trim();
      if (!text) return;
      console.log(">> LISTENED:", text);

      if (stateRef.current === 'SLEEP') {
        if (text.match(/(xin chào|vision|trợ lý)/)) {
          console.log(">> WAKE WORD:", text);
          changeState('WAKING_UP', 'Đã nghe! (Chuẩn bị...)');
          vosk.stop();

          setTimeout(() => {
            vosk.start({ grammar: VOSK_GRAMMAR });
            changeState('LISTENING', 'Đang nghe lệnh...');
          }, 800); 
        }
      } 
      else if (stateRef.current === 'LISTENING') {
        setTranscript(text);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        timeoutRef.current = setTimeout(() => {
          if (text.length > 2) {
            finalizeCommand(text);
          } else {
            startVoskGuard(); 
          }
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

  const manualWakeUp = () => {
    if (stateRef.current === 'SLEEP') {
      changeState('LISTENING', 'Đang nghe lệnh...');
    }
  };

  const manualStop = () => {
    if (stateRef.current === 'LISTENING') {
      startVoskGuard();
    }
  };

  return { 
    appState, 
    transcript, 
    manualWakeUp, 
    manualStop 
  };
};