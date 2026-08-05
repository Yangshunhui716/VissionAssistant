import { useState, useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';
import { COCO_LABELS_VI, ALIAS_MAP } from '../utils/recognitionProcessor/cocoLabels';
import { getNGrams } from '../utils/textProcessor/nlpUtils';


export const useCommandParser = () => {
  const [targetToFind, setTargetToFind] = useState(null);
  const [isScanningGeneral, setIsScanningGeneral] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState("");

  const fuse = useMemo(() => {
    return new Fuse(COCO_LABELS_VI, {
      includeScore: true,
      threshold: 0.4, 
    });
  }, []);

  const onSearchComplete = useCallback((isFound, itemData) => {
    setTargetToFind((currentTarget) => {
      if (isFound) {
        const msg = `[KẾT QUẢ] Đã tìm thấy: ${currentTarget}`;
        console.log(msg);
        setSearchFeedback(msg);
      } else {
        const msg = `[KẾT QUẢ] Không tìm thấy: ${currentTarget} ở quanh đây.`;
        console.log(msg);
        setSearchFeedback(msg);
      }
      return null;
    });
    setTimeout(() => setSearchFeedback(""), 5000);
  }, []);

  const onGeneralScanComplete = useCallback((foundItems) => {
    setIsScanningGeneral(false);
    
    if (foundItems && foundItems.length > 0) {
      setSearchFeedback(`Phía trước có: ${foundItems[0]}`);
      console.log(`[LỆNH] Nhận diện không gian: ${foundItems[0]}`);
    } else {
      setSearchFeedback("Phía trước đang trống.");
      console.log("[LỆNH] Nhận diện không gian: Trống");
    }
    setTimeout(() => setSearchFeedback(""), 7000);
  }, []);

  const processCommand = useCallback((transcript) => {
    if (!transcript) return;

    let text = transcript.trim().toLowerCase();
    
    Object.keys(ALIAS_MAP).forEach(alias => {
      const regex = new RegExp(`\\b${alias}\\b`, 'g');
      text = text.replace(regex, ALIAS_MAP[alias]);
    });

    console.log("[LÕI AI] Đang xử lý câu nói:", text);

    if (text.includes('tìm') || text.includes('kiếm') || text.includes('ở đâu')) {
      
      const chunks = getNGrams(text);
      let bestMatchName = null;
      let bestScore = 1;

      for (const chunk of chunks) {
        const results = fuse.search(chunk);
        if (results.length > 0) {
          const match = results[0];
          if (match.score < bestScore) {
            bestScore = match.score;
            bestMatchName = match.item;
          }
        }
      }

      if (bestMatchName) {
        setTargetToFind(bestMatchName); 
        setSearchFeedback(`Đang quét tìm: ${bestMatchName}...`);
      } else {
        setSearchFeedback("Không rõ đồ vật cần tìm.");
      }
    } 

    else if (text.includes('có gì') || text.includes('nhận diện') || text.includes('phía trước') || text.includes('quét')) {
      setIsScanningGeneral(true);
      setSearchFeedback("Đang nhận diện đồ vật trước mặt...");
    }

    else {
      setSearchFeedback("Không nhận diện được lệnh.");
      setTimeout(() => setSearchFeedback('Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)'), 4000);
    }
  }, [fuse]);

  return { 
    targetToFind, 
    isScanningGeneral, 
    searchFeedback, 
    onSearchComplete, 
    onGeneralScanComplete, 
    processCommand 
  };
};