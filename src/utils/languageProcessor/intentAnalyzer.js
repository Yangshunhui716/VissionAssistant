import Fuse from 'fuse.js';
import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';
import { ALIAS_MAP } from './grammar';

const IS_DEBUG = true;

const NGRAM_MAX_WORDS = 3;
const INTENT_FUSE_THRESH = 0.3;
const OBJECT_FUSE_THRESH = 0.45;
const INTENT_ACCEPT_SCORE = 0.4;
const MIN_CHAR_MATCH = 2;
const SINGLE_WORD_SCORE = 0.15;
const MULTI_WORD_SCORE = 0.35;
const EARLY_EXIT_SCORE = 0.25;

const INTENT_DICTIONARY = [
  { intent: 'FIND', keywords: ['tìm', 'kiếm', 'ở đâu'] },
  {
    intent: 'SCAN_GENERAL',
    keywords: ['có gì', 'nhận diện', 'phía trước', 'quét', 'trước mắt', 'nhìn'],
  },
];

const PRECOMPILED_ALIASES = Object.keys(ALIAS_MAP).map(alias => ({
  regex: new RegExp(`\\b${alias}\\b`, 'g'),
  replacement: ALIAS_MAP[alias]
}));

const intentFuse = new Fuse(INTENT_DICTIONARY, {
  includeScore: true,
  threshold: INTENT_FUSE_THRESH,
  keys: ['keywords'],
});

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
    text = text.replace(PRECOMPILED_ALIASES[i].regex, PRECOMPILED_ALIASES[i].replacement);
  }

  if (IS_DEBUG) console.log('[NÃO BỘ] Đã nắn ngọng:', text);

  let detectedIntent = null;

  if (text.includes('tìm') || text.includes('kiếm') || text.includes('ở đâu')) {
    detectedIntent = 'FIND';
  } else if (
    text.includes('có gì') ||
    text.includes('nhận diện') ||
    text.includes('quét') ||
    text.includes('phía trước')
  ) {
    detectedIntent = 'SCAN_GENERAL';
  } else {
    const chunks = getNGrams(text).sort((a, b) => b.length - a.length);
    for (const chunk of chunks) {
      const intentResults = intentFuse.search(chunk);
      if (
        intentResults.length > 0 &&
        intentResults[0].score <= INTENT_ACCEPT_SCORE
      ) {
        detectedIntent = intentResults[0].item.intent;
        break;
      }
    }
  }

  if (detectedIntent === 'FIND') {
    let bestMatchName = null;
    let bestScore = 1;

    const chunks = getNGrams(text).sort((a, b) => b.length - a.length);
    const prioritizedChunks = [
      ...chunks.filter(c => c.includes(' ') && c.length >= MIN_CHAR_MATCH),
      ...chunks.filter(c => !c.includes(' ') && c.length >= MIN_CHAR_MATCH),
    ];

    for (const chunk of prioritizedChunks) {
      const results = objectFuse.search(chunk);
      if (results.length > 0) {
        const match = results[0];
        const allowedScore = !chunk.includes(' ')
          ? SINGLE_WORD_SCORE
          : MULTI_WORD_SCORE;

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

  if (detectedIntent === 'SCAN_GENERAL') return { intent: 'SCAN_GENERAL' };

  return { intent: 'INVALID' };
};