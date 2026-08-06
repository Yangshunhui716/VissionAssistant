import { useState, useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';
import { COCO_LABELS_VI, ALIAS_MAP } from '../utils/recognitionProcessor/cocoLabels';
import { getNGrams } from '../utils/textProcessor/nlpUtils';

const INTENT_DICTIONARY = [
  { intent: 'FIND', keywords: ['tìm', 'kiếm', 'ở đâu'] },
  { intent: 'SCAN_GENERAL', keywords: ['có gì', 'nhận diện', 'phía trước', 'quét', 'trước mắt', 'nhìn'] }
];

export const useCommandParser = () => {
  const [targetToFind, setTargetToFind] = useState(null);
  const [isScanningGeneral, setIsScanningGeneral] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState("");

  const objectFuse = useMemo(() => {
    return new Fuse(COCO_LABELS_VI, {
      includeScore: true,
      threshold: 0.45, 
    });
  }, []);

  const intentFuse = useMemo(() => {
    return new Fuse(INTENT_DICTIONARY, {
      includeScore: true,
      threshold: 0.3,
      keys: ['keywords']
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

    console.log("[LÕI AI] Đang xử lý câu nói thô:", text);

    const chunks = getNGrams(text).sort((a, b) => b.length - a.length);
    let detectedIntent = null;

    for (const chunk of chunks) {
      const intentResults = intentFuse.search(chunk);
      if (intentResults.length > 0 && intentResults[0].score <= 0.4) {
        detectedIntent = intentResults[0].item.intent; 
        break;
      }
    }

    if (!detectedIntent && (text.includes('tìm') || text.includes('kiếm'))) {
      detectedIntent = 'FIND';
    }

    console.log("[LÕI AI] Ý định sau khi nắn ngọng:", detectedIntent);

    if (detectedIntent === 'FIND') {
      let bestMatchName = null;
      let bestScore = 1;

      const multiWordChunks = chunks.filter(c => c.includes(' ') && c.length >= 3);
      const singleWordChunks = chunks.filter(c => !c.includes(' ') && c.length >= 3);

      const prioritizedChunks = [...multiWordChunks, ...singleWordChunks];

      for (const chunk of prioritizedChunks) {
        const results = objectFuse.search(chunk);
        if (results.length > 0) {
          const match = results[0];

          const isSingleWord = !chunk.includes(' ');
          const allowedScore = isSingleWord ? 0.15 : 0.35;

          if (match.score < bestScore && match.score <= allowedScore) {
            bestScore = match.score;
            bestMatchName = match.item;
            
            if (!isSingleWord && match.score <= 0.25) break;
          }
        }
      }

      if (bestMatchName) {
        setTargetToFind(bestMatchName); 
        setSearchFeedback(`Đang quét tìm: ${bestMatchName}...`);
        console.log(`[LỆNH CHỐT] Tìm đồ vật: ${bestMatchName} (Độ khớp: ${bestScore.toFixed(2)})`);
      } else {
        setSearchFeedback("Không rõ đồ vật cần tìm.");
        console.log("[LỆNH CHỐT] Không tìm thấy vật thể nào khớp an toàn với từ điển.");
      }
    } 
    else if (detectedIntent === 'SCAN_GENERAL') {
      setIsScanningGeneral(true);
      setSearchFeedback("Đang nhận diện đồ vật trước mặt...");
      console.log("[LỆNH CHỐT] Quét tổng quát không gian");
    } 
    else {
      setSearchFeedback("Không nhận diện được lệnh.");
      setTimeout(() => setSearchFeedback('Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)'), 4000);
    }
  }, [objectFuse, intentFuse]);

  return { 
    targetToFind, 
    isScanningGeneral, 
    searchFeedback, 
    onSearchComplete, 
    onGeneralScanComplete, 
    processCommand 
  };
};