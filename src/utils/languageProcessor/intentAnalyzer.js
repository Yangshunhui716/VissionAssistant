import Fuse from 'fuse.js';
import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';
import { ALIAS_MAP } from './grammar';
import { IS_DEBUG } from '../debug/debug';

const NGRAM_MAX_WORDS = 3;
const OBJECT_FUSE_THRESH = 0.45;
const MIN_CHAR_MATCH = 2;
const SINGLE_WORD_SCORE = 0.15;
const MULTI_WORD_SCORE = 0.35;
const EARLY_EXIT_SCORE = 0.25;

const PRECOMPILED_ALIASES = Object.keys(ALIAS_MAP).map(alias => ({
  regex: new RegExp(`\\b${alias}\\b`, 'g'),
  replacement: ALIAS_MAP[alias],
}));

const objectFuse = new Fuse(OBJECT365_LABELS_VI, {
  includeScore: true,
  threshold: OBJECT_FUSE_THRESH,
});

const getNGrams = text => {
  const words = text.split(' ').filter(w => w.trim() !== '');
  const nGrams = [];
  for (let i = 0; i < words.length; i++) {
    let chunk = '';
    for (let j = 0; j < NGRAM_MAX_WORDS && i + j < words.length; j++) {
      chunk += (j > 0 ? ' ' : '') + words[i + j];
      nGrams.push(chunk);
    }
  }
  return nGrams;
};

export const analyzeCommand = rawText => {
  let text = rawText.toLowerCase().trim();

  for (let i = 0; i < PRECOMPILED_ALIASES.length; i++) {
    text = text.replace(
      PRECOMPILED_ALIASES[i].regex,
      PRECOMPILED_ALIASES[i].replacement,
    );
  }

  if (IS_DEBUG) console.log('SAU KHI XỬ LÝ ALIAS: ', text);

  let detectedIntent = null;

  if (/(tắt|ngừng|dừng|hủy).*(vật cản|cảnh báo)/i.test(text)) {
    detectedIntent = 'OBSTACLE_OFF';
  } else if (/(bật|mở|chạy).*(vật cản|cảnh báo)/i.test(text) || /(nhận diện|quét).*(vật cản|chướng ngại)/i.test(text)) {
    detectedIntent = 'OBSTACLE_ON';
  } else if (/(đọc|quét|nhận diện|kiểm tra|xem).*(tiền|tờ này|mệnh giá)/i.test(text)) {
    detectedIntent = 'SCAN_CURRENCY';
  } else if (/(đọc|quét|nhận diện|xem).*(chữ|văn bản|tài liệu|trang giấy|câu này)/i.test(text)) {
    detectedIntent = 'SCAN_TEXT';
  } else if (/(có gì|xung quanh|phía trước|nhìn|quét|nhận diện).*(đồ vật|phía trước|xung quanh)?/i.test(text)) {
    if (!/(tìm|kiếm|ở đâu)/i.test(text)) {
      detectedIntent = 'SCAN_GENERAL';
    }
  } else if (/(tìm|kiếm|ở đâu)/i.test(text)) {
    detectedIntent = 'FIND';
  }

  if (detectedIntent === 'OBSTACLE_ON') return { intent: 'OBSTACLE_ON' };
  if (detectedIntent === 'OBSTACLE_OFF') return { intent: 'OBSTACLE_OFF' };
  if (detectedIntent === 'SCAN_GENERAL') return { intent: 'SCAN_GENERAL' };
  if (detectedIntent === 'SCAN_CURRENCY') return { intent: 'SCAN_CURRENCY' };
  if (detectedIntent === 'SCAN_TEXT') return { intent: 'SCAN_TEXT' };

  if (detectedIntent === 'FIND') {
    let bestMatchName = null;
    let bestScore = 1;

    let cleanSearchText = text.replace(/(tìm|kiếm|cho tui|cho tôi|ở đâu|giúp|nhé|cái|chiếc|con|quả)/gi, '').trim();

    if (cleanSearchText.length < MIN_CHAR_MATCH) {
      return { intent: 'INVALID' };
    }

    const chunks = getNGrams(cleanSearchText).sort((a, b) => b.length - a.length);
    
    const prioritizedChunks = [
      ...chunks.filter(c => c.includes(' ') && c.length >= MIN_CHAR_MATCH),
      ...chunks.filter(c => !c.includes(' ') && c.length >= MIN_CHAR_MATCH),
    ];

    for (const chunk of prioritizedChunks) {
      const results = objectFuse.search(chunk);
      if (results.length > 0) {
        const match = results[0];
        const allowedScore = !chunk.includes(' ') ? SINGLE_WORD_SCORE : MULTI_WORD_SCORE;

        if (match.score < bestScore && match.score <= allowedScore) {
          bestScore = match.score;
          bestMatchName = match.item;

          if (chunk.includes(' ') && match.score <= EARLY_EXIT_SCORE) break;
        }
      }
    }
    
    return bestMatchName
      ? { intent: 'FIND', targetName: bestMatchName }
      : { intent: 'INVALID' };
  }

  return { intent: 'INVALID' };
};