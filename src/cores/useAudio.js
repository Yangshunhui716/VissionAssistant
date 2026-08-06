import { useState, useEffect, useRef } from 'react';
import * as vosk from 'react-native-vosk'; 
import { COMMAND_GRAMMAR, WAKE_GRAMMAR } from '../utils/recognitionProcessor/cocoLabels';

export const useAudio = (hasMicPermission) => {
  const [appState, setAppState] = useState('SLEEP');
  const [transcript, setTranscript] = useState("Đang chờ khởi tạo...");
  
  const stateRef = useRef('SLEEP');
  const timeoutRef = useRef(null);
  const isModelLoaded = useRef(false); 
  const isSwitching = useRef(false);

  const changeState = (newState, message) => {
    stateRef.current = newState;
    setAppState(newState);
    if (message) setTranscript(message);
  };

  const startVoskGuard = async () => {
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isSwitching.current = true;
      changeState('SLEEP', 'Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)');
      
      if (isModelLoaded.current) {
        await vosk.stop();
        await vosk.start({ grammar: WAKE_GRAMMAR });
      }
      isSwitching.current = false;
    } catch (e) {
      console.log("Lỗi khởi động Vosk Guard:", e);
      isSwitching.current = false;
    }
  };

  const switchToListening = async () => {
    try {
      if (isSwitching.current) return;
      isSwitching.current = true;

      changeState('WAKING_UP', 'Đã nghe! (Chuẩn bị...)');
      await vosk.stop();

      await new Promise(resolve => setTimeout(resolve, 600));

      await vosk.start({ grammar: COMMAND_GRAMMAR });
      changeState('LISTENING', 'Đang nghe lệnh...');
      
      isSwitching.current = false;
    } catch (e) {
      console.log("Lỗi chuyển đổi luồng:", e);
      isSwitching.current = false;
      startVoskGuard();
    }
  };

  const finalizeCommand = async (finalText) => {
    if (isSwitching.current) return;
    changeState('PROCESSING', finalText);
    console.log(">> LỆNH ĐÃ CHỐT:", finalText);
    
    await vosk.stop(); 

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
      if (isSwitching.current) return;

      const text = (res || "").toString().toLowerCase().trim();
      if (!text) return;
      console.log(">> LISTENED:", text);

      if (stateRef.current === 'SLEEP') {
        if (text.match(/(xin chào|vision|trợ lý)/)) {
          console.log(">> WAKE WORD:", text);
          switchToListening();
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
      switchToListening();
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