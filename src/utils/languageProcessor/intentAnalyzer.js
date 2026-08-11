import Fuse from 'fuse.js';
import { COCO_LABELS_VI, ALIAS_MAP } from '../recognitionProcessor/cocoLabels';
import { getNGrams } from './nlpUtils';

const INTENT_DICTIONARY = [
  { intent: 'FIND', keywords: ['tìm', 'kiếm', 'ở đâu'] },
  { intent: 'SCAN_GENERAL', keywords: ['có gì', 'nhận diện', 'phía trước', 'quét', 'trước mắt', 'nhìn'] }
];

const intentFuse = new Fuse(INTENT_DICTIONARY, { includeScore: true, threshold: 0.3, keys: ['keywords'] });
const objectFuse = new Fuse(COCO_LABELS_VI, { includeScore: true, threshold: 0.45 });

export const analyzeCommand = (rawText) => {
  let text = rawText.toLowerCase().trim();

  Object.keys(ALIAS_MAP).forEach(alias => {
    const regex = new RegExp(`\\b${alias}\\b`, 'g');
    text = text.replace(regex, ALIAS_MAP[alias]);
  });
  console.log("[NÃO BỘ] Đã nắn ngọng:", text);

  const chunks = getNGrams(text).sort((a, b) => b.length - a.length);
  let detectedIntent = null;

  for (const chunk of chunks) {
    const intentResults = intentFuse.search(chunk);
    if (intentResults.length > 0 && intentResults[0].score <= 0.4) {
      detectedIntent = intentResults[0].item.intent; 
      break;
    }
  }
  if (!detectedIntent && (text.includes('tìm') || text.includes('kiếm'))) detectedIntent = 'FIND';

  if (detectedIntent === 'FIND') {
    let bestMatchName = null;
    let bestScore = 1;
    const prioritizedChunks = [...chunks.filter(c => c.includes(' ') && c.length >= 3), ...chunks.filter(c => !c.includes(' ') && c.length >= 3)];

    for (const chunk of prioritizedChunks) {
      const results = objectFuse.search(chunk);
      if (results.length > 0) {
        const match = results[0];
        const allowedScore = !chunk.includes(' ') ? 0.15 : 0.35;
        if (match.score < bestScore && match.score <= allowedScore) {
          bestScore = match.score;
          bestMatchName = match.item;
          if (chunk.includes(' ') && match.score <= 0.25) break;
        }
      }
    }
    return bestMatchName ? { intent: 'FIND', targetName: bestMatchName } : { intent: 'INVALID' };
  } 
  
  if (detectedIntent === 'SCAN_GENERAL') return { intent: 'SCAN_GENERAL' };

  return { intent: 'INVALID' };
};