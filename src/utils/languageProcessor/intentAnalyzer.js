import Fuse from 'fuse.js';
import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';
import {
  ALIAS_MAP,
  ACTION_WORDS,
  FUNCTION_KEYWORDS,
  COMMON_WORDS,
  TARGET_STOP_WORDS,
} from './grammar';

const normalizeText = text => {
  return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
};

const escapeRegExp = value => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const PRECOMPILED_ALIASES = Object.keys(ALIAS_MAP)
  .sort((a, b) => b.length - a.length)
  .map(alias => ({
    regex: new RegExp(`(^|\\s)${escapeRegExp(alias)}(?=\\s|$)`, 'g'),
    replacement: ALIAS_MAP[alias],
  }));

const applyAliases = text => {
  let result = text;

  for (const { regex, replacement } of PRECOMPILED_ALIASES) {
    result = result.replace(regex, (_, prefix) => `${prefix}${replacement}`);
  }

  return result;
};

const buildPhraseMap = () => {
  const map = new Map();

  const add = (words, type) => {
    words.forEach(word => {
      map.set(normalizeText(word), type);
    });
  };

  add(ACTION_WORDS, 'ACTION');
  add(FUNCTION_KEYWORDS.OBSTACLE, 'OBSTACLE_KEYWORD');
  add(FUNCTION_KEYWORDS.CURRENCY, 'CURRENCY_KEYWORD');
  add(FUNCTION_KEYWORDS.TEXT, 'TEXT_KEYWORD');
  add(FUNCTION_KEYWORDS.GENERAL, 'GENERAL_KEYWORD');
  add(FUNCTION_KEYWORDS.FIND, 'FIND_KEYWORD');
  add(COMMON_WORDS, 'COMMON');

  return map;
};

const PHRASE_MAP = buildPhraseMap();

const OBJECT_SET = new Set(
  OBJECT365_LABELS_VI.map(item => normalizeText(item)),
);

const OBJECT_PHRASES = [...OBJECT_SET]
  .filter(item => item.includes(' '))
  .sort((a, b) => b.length - a.length);

const classifyText = text => {
  const words = text.split(' ').filter(Boolean);
  const results = [];
  let i = 0;

  while (i < words.length) {
    let matched = false;

    for (const objectPhrase of OBJECT_PHRASES) {
      const objectWords = objectPhrase.split(' ');

      if (i + objectWords.length > words.length) {
        continue;
      }

      const candidate = words.slice(i, i + objectWords.length).join(' ');

      if (candidate === objectPhrase) {
        results.push({
          text: candidate,
          type: 'OBJECT',
        });

        i += objectWords.length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    const word = words[i];

    if (OBJECT_SET.has(word)) {
      results.push({
        text: word,
        type: 'OBJECT',
      });

      i += 1;
      continue;
    }

    if (PHRASE_MAP.has(word)) {
      results.push({
        text: word,
        type: PHRASE_MAP.get(word),
      });

      i += 1;
      continue;
    }

    results.push({
      text: word,
      type: 'UNKNOWN',
    });

    i += 1;
  }

  return results;
};

const detectIntent = classified => {
  const hasType = type => classified.some(item => item.type === type);

  const obstacleCount = classified.filter(
    item => item.type === 'OBSTACLE_KEYWORD',
  ).length;

  const currencyCount = classified.filter(
    item => item.type === 'CURRENCY_KEYWORD',
  ).length;

  const textCount = classified.filter(
    item => item.type === 'TEXT_KEYWORD',
  ).length;

  const generalCount = classified.filter(
    item => item.type === 'GENERAL_KEYWORD',
  ).length;

  const hasFind = hasType('FIND_KEYWORD');
  const hasAction = hasType('ACTION');

  const hasOnAction = classified.some(item =>
    ['bật', 'mở', 'chạy'].includes(item.text),
  );

  const hasOffAction = classified.some(item =>
    ['tắt', 'ngừng', 'dừng', 'hủy'].includes(item.text),
  );

  if (obstacleCount > 0) {
    if (hasOffAction) {
      return 'OBSTACLE_OFF';
    }

    if (hasOnAction || hasAction) {
      return 'OBSTACLE_ON';
    }
  }

  if (currencyCount > 0 && hasAction) {
    return 'SCAN_CURRENCY';
  }

  if (textCount > 0 && hasAction) {
    return 'SCAN_TEXT';
  }

  if (generalCount > 0 && hasAction && !hasFind) {
    return 'SCAN_GENERAL';
  }

  if (hasFind) {
    return 'FIND';
  }

  return null;
};

const extractTargetText = text => {
  let result = text;
  const stopWords = [...TARGET_STOP_WORDS].sort((a, b) => b.length - a.length);

  for (const word of stopWords) {
    const regex = new RegExp(`(^|\\s)${escapeRegExp(word)}(?=\\s|$)`, 'gi');
    result = result.replace(regex, ' ');
  }

  return result.replace(/\s+/g, ' ').trim();
};

const createObjectFuse = OBJECT_FUSE_THRESH => {
  return new Fuse(OBJECT365_LABELS_VI, {
    includeScore: true,
    threshold: OBJECT_FUSE_THRESH,
  });
};

const getNGrams = (text, maxWords) => {
  const words = text.split(' ').filter(Boolean);
  const nGrams = [];

  for (let i = 0; i < words.length; i++) {
    let chunk = '';

    for (let j = 0; j < maxWords && i + j < words.length; j++) {
      chunk += `${j > 0 ? ' ' : ''}${words[i + j]}`;
      nGrams.push(chunk);
    }
  }

  return nGrams;
};

const findObject = (targetText, intentConfig) => {
  const {
    NGRAM_MAX_WORDS,
    OBJECT_FUSE_THRESH,
    MIN_CHAR_MATCH,
    SINGLE_WORD_SCORE,
    MULTI_WORD_SCORE,
    EARLY_EXIT_SCORE,
  } = intentConfig;

  if (!targetText || targetText.length < MIN_CHAR_MATCH) {
    return null;
  }

  const objectFuse = createObjectFuse(OBJECT_FUSE_THRESH);
  const exactObject = OBJECT365_LABELS_VI.find(
    item => normalizeText(item) === targetText,
  );

  if (exactObject) {
    return exactObject;
  }

  const chunks = getNGrams(targetText, NGRAM_MAX_WORDS).sort(
    (a, b) => b.length - a.length,
  );

  const prioritizedChunks = [
    ...chunks.filter(
      chunk => chunk.includes(' ') && chunk.length >= MIN_CHAR_MATCH,
    ),
    ...chunks.filter(
      chunk => !chunk.includes(' ') && chunk.length >= MIN_CHAR_MATCH,
    ),
  ];

  let bestMatchName = null;
  let bestScore = 1;

  for (const chunk of prioritizedChunks) {
    const results = objectFuse.search(chunk);

    if (!results.length) {
      continue;
    }

    const match = results[0];
    const allowedScore = chunk.includes(' ')
      ? MULTI_WORD_SCORE
      : SINGLE_WORD_SCORE;

    if (match.score < bestScore && match.score <= allowedScore) {
      bestScore = match.score;
      bestMatchName = match.item;

      if (chunk.includes(' ') && match.score <= EARLY_EXIT_SCORE) {
        break;
      }
    }
  }

  return bestMatchName;
};

export const analyzeCommand = (rawText, intentConfig, debugLogging = false) => {
  let text = normalizeText(rawText);
  text = applyAliases(text);

  if (debugLogging) {
    console.log('SAU KHI XỬ LÝ ALIAS:', text);
  }

  const classified = classifyText(text);

  if (debugLogging) {
    console.log('PHÂN LOẠI:', classified);
  }

  const detectedIntent = detectIntent(classified);

  if (debugLogging) {
    console.log('INTENT:', detectedIntent);
  }

  if (detectedIntent === 'OBSTACLE_ON') {
    return {
      intent: 'OBSTACLE_ON',
    };
  }

  if (detectedIntent === 'OBSTACLE_OFF') {
    return {
      intent: 'OBSTACLE_OFF',
    };
  }

  if (detectedIntent === 'SCAN_GENERAL') {
    return {
      intent: 'SCAN_GENERAL',
    };
  }

  if (detectedIntent === 'SCAN_CURRENCY') {
    return {
      intent: 'SCAN_CURRENCY',
    };
  }

  if (detectedIntent === 'SCAN_TEXT') {
    return {
      intent: 'SCAN_TEXT',
    };
  }

  if (detectedIntent === 'FIND') {
    const targetText = extractTargetText(text);

    if (debugLogging) {
      console.log('TARGET RAW:', targetText);
    }

    if (targetText.length < intentConfig.MIN_CHAR_MATCH) {
      return {
        intent: 'INVALID',
      };
    }

    const bestMatchName = findObject(targetText, intentConfig);

    if (debugLogging) {
      console.log('OBJECT MATCH:', bestMatchName);
    }

    if (bestMatchName) {
      return {
        intent: 'FIND',
        targetName: bestMatchName,
      };
    }

    return {
      intent: 'INVALID',
    };
  }

  return {
    intent: 'INVALID',
  };
};
