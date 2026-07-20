import { useState, useEffect, useRef } from 'react';
import AudioRecord from 'react-native-audio-record';
import * as vosk from 'react-native-vosk'; // CHUẨN NHƯ CODE MẪU
import { initWhisper } from 'whisper.rn/index.js';
import { Buffer } from 'buffer';

export const useAudio = (hasMicPermission) => {
  const whisperModelRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isSpeakingRef = useRef(false);

  const [appState, setAppState] = useState('SLEEP');
  const [transcript, setTranscript] = useState("Đang chờ khởi tạo...");

  useEffect(() => {
    if (!hasMicPermission) return;

    const resultEvent = vosk.onResult((res) => {
      console.log("[VOSK CHỐT CÂU]:", res); 
      const text = (res || "").toString().toLowerCase();
      
      if (text.includes('vi sần') || text.includes('vision') || text.includes('xin chào')) {
        vosk.stop(); 
        setTimeout(() => {
          startRecordingCommand();
        }, 500);
      }
    });

    const partialResultEvent = vosk.onPartialResult((res) => {
      console.log("[VOSK NGHE NHÁP]:", res);
    });

    const errorEvent = vosk.onError((e) => {
      console.log("Lỗi Vosk ngầm:", e);
    });

    const initTimer = setTimeout(() => {
      const init = async () => {
        try {
          setTranscript("Đang nạp Whisper...");
          AudioRecord.init({
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,
            wavFile: 'command.wav'
          });

          console.log(">> 1. BẮT ĐẦU LOAD WHISPER...");
          whisperModelRef.current = await initWhisper({
            filePath: require('../assets/models/ggml-base.bin'),
            useGpu: false 
          });
          console.log("Whisper loaded...");
          
          setTranscript("Đang nạp Vosk...");
          console.log(">> 2. BẮT ĐẦU LOAD VOSK...");
          
          await vosk.loadModel('model-vn-vn');
          console.log("Vosk loaded...");

          startWakeWordEngine();
        } catch (e) {
          console.log("Lỗi Init Audio:", e);
          setTranscript("Lỗi khởi tạo âm thanh!");
        }
      };
      init();
    }, 2000); 

    return () => {
      clearTimeout(initTimer);
      whisperModelRef.current?.release();
      vosk.unload();
      resultEvent.remove();
      errorEvent.remove();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [hasMicPermission]);

  const startWakeWordEngine = () => {
    setAppState('SLEEP');
    setTranscript('Đang ngủ... (Gọi "Vi sần xin chào")');

    vosk.start()
      .then(() => console.log(">> Vosk đang lắng nghe..."))
      .catch((e) => console.log("Lỗi bật Vosk:", e));
  };

  const startRecordingCommand = async () => {
    if (!whisperModelRef.current) return;
    try {
      setAppState('LISTENING');
      setTranscript('Mời ra lệnh... (Tự ngắt khi nói xong)');

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      isSpeakingRef.current = false;

      AudioRecord.on('data', data => {
        const chunk = Buffer.from(data, 'base64');
        let sum = 0;
        for (let i = 0; i < chunk.length; i += 2) {
          const sample = chunk.readInt16LE(i);
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / (chunk.length / 2));

        if (rms > 300) { 
          isSpeakingRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          if (isSpeakingRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopAndTranscribe();
            }, 3000); 
          }
        }
      });

      AudioRecord.start();

      setTimeout(() => {
        setAppState(prev => {
           if (prev === 'LISTENING') stopAndTranscribe();
           return prev;
        });
      }, 10000);

    } catch (e) {
      console.log(e);
      setTranscript('Có lỗi xảy ra khi ghi âm');
    }
  };

  const stopAndTranscribe = async () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    AudioRecord.on('data', () => {}); 

    setAppState('THINKING');
    setTranscript('Đang suy nghĩ...');

    const audioFilePath = await AudioRecord.stop();
    console.log("ĐÃ LƯU FILE GHI ÂM TẠI:", audioFilePath); 

    try {
      const transcriptionTask = await whisperModelRef.current.transcribe(audioFilePath, { language: 'vi' });

      const result = await transcriptionTask.promise;
      
      console.log("[WHISPER KẾT QUẢ THỰC SỰ]:", result);

      const cleanText = result.result?.trim() || "";
      const hallucinations = [".", "Bye bye.", "Thank you.", "Cảm ơn.", "Cảm ơn bạn.", "[BLANK_AUDIO]"];

      if (cleanText.length > 1 && !hallucinations.includes(cleanText)) {
        setTranscript(`Lệnh: "${cleanText}"`);
      } else {
        setTranscript("Không nghe rõ lệnh.");
      }
    } catch (e) {
      console.log("Lỗi Whisper:", e);
      setTranscript("Lỗi dịch thuật.");
    }

    setTimeout(startWakeWordEngine, 3000); 
  };

  const manualStop = () => {
     setAppState(prev => {
         if (prev === 'LISTENING') stopAndTranscribe();
         return prev;
     });
  };

  return { appState, transcript, manualStop };
};