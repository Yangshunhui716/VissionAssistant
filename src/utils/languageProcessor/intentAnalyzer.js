import Fuse from 'fuse.js';
import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';
import {
  ALIAS_MAP,
  ACTION_WORDS,
  FUNCTION_KEYWORDS,
  COMMON_WORDS,
  SYNONYM_MAP,
} from './grammar';

const normalizeText = text => {
  return String(text || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = text => {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  return normalized.split(' ');
};

const escapeRegExp = value => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const COMMAND_ALIASES = Object.entries(ALIAS_MAP)
  .map(([from, to]) => ({
    from: normalizeText(from),
    to: tokenize(to),
  }))
  .sort((a, b) => {
    return b.from.split(' ').length - a.from.split(' ').length;
  });

const TARGET_SYNONYMS = Object.entries(SYNONYM_MAP)
  .map(([from, to]) => ({
    from: normalizeText(from),
    to: normalizeText(to),
  }))
  .sort((a, b) => {
    return b.from.length - a.from.length;
  });

const OBJECT_SET = new Set(
  OBJECT365_LABELS_VI.map(label => normalizeText(label)),
);

const COMMAND_FUSE_ITEMS = [
  ...ACTION_WORDS.map(token => ({
    token: normalizeText(token),
    type: 'ACTION',
  })),

  ...Object.entries(FUNCTION_KEYWORDS).flatMap(([group, keywords]) =>
    keywords.map(token => ({
      token: normalizeText(token),
      type: `${group}_KEYWORD`,
    })),
  ),
];

const UNIQUE_COMMAND_FUSE_ITEMS = Array.from(
  new Map(
    COMMAND_FUSE_ITEMS.map(item => [`${item.type}:${item.token}`, item]),
  ).values(),
);

const COMMAND_FUSE = new Fuse(UNIQUE_COMMAND_FUSE_ITEMS, {
  keys: ['token'],
  includeScore: true,
  threshold: 0.5,
  ignoreLocation: true,
});

const applyCommandAliases = rawText => {
  const sourceTokens = tokenize(rawText);
  const result = [];

  let i = 0;

  while (i < sourceTokens.length) {
    let matched = false;

    for (const alias of COMMAND_ALIASES) {
      const aliasTokens = alias.from.split(' ');
      const end = i + aliasTokens.length;

      if (end > sourceTokens.length) {
        continue;
      }

      let isMatch = true;

      for (let j = 0; j < aliasTokens.length; j++) {
        if (sourceTokens[i + j] !== aliasTokens[j]) {
          isMatch = false;
          break;
        }
      }

      if (!isMatch) {
        continue;
      }

      alias.to.forEach(token => {
        result.push({
          token,
          sourceStart: i,
          sourceEnd: end - 1,
        });
      });

      i = end;
      matched = true;
      break;
    }

    if (!matched) {
      result.push({
        token: sourceTokens[i],
        sourceStart: i,
        sourceEnd: i,
      });

      i++;
    }
  }

  return {
    sourceTokens,
    commandTokens: result,
  };
};

const classifyCommand = commandTokens => {
  const classified = [];

  for (const item of commandTokens) {
    const token = normalizeText(item.token);

    if (OBJECT_SET.has(token)) {
      classified.push({
        ...item,
        type: 'OBJECT',
      });

      continue;
    }

    if (FUNCTION_KEYWORDS.OBSTACLE.includes(token)) {
      classified.push({
        ...item,
        type: 'OBSTACLE_KEYWORD',
      });
      continue;
    }

    if (FUNCTION_KEYWORDS.CURRENCY.includes(token)) {
      classified.push({
        ...item,
        type: 'CURRENCY_KEYWORD',
      });
      continue;
    }

    if (FUNCTION_KEYWORDS.TEXT.includes(token)) {
      classified.push({
        ...item,
        type: 'TEXT_KEYWORD',
      });
      continue;
    }

    if (FUNCTION_KEYWORDS.GENERAL.includes(token)) {
      classified.push({
        ...item,
        type: 'GENERAL_KEYWORD',
      });
      continue;
    }

    if (FUNCTION_KEYWORDS.FIND.includes(token)) {
      classified.push({
        ...item,
        type: 'FIND_KEYWORD',
      });
      break;
    }

    if (ACTION_WORDS.includes(token)) {
      classified.push({
        ...item,
        type: 'ACTION',
      });
      continue;
    }

    if (COMMON_WORDS.includes(token)) {
      classified.push({
        ...item,
        type: 'COMMON',
      });
      continue;
    }

    classified.push({
      ...item,
      type: 'UNKNOWN',
    });
  }

  return classified;
};

const hasType = (classified, type) => {
  return classified.some(item => item.type === type);
};

const detectIntent = classified => {
  const hasAction = hasType(classified, 'ACTION');
  const hasObstacle = hasType(classified, 'OBSTACLE_KEYWORD');
  const hasCurrency = hasType(classified, 'CURRENCY_KEYWORD');
  const hasText = hasType(classified, 'TEXT_KEYWORD');
  const hasGeneral = hasType(classified, 'GENERAL_KEYWORD');
  const hasFind = hasType(classified, 'FIND_KEYWORD');

  if (hasObstacle) {
    if (
      classified.some(
        item =>
          item.token === 'tắt' ||
          item.token === 'ngừng' ||
          item.token === 'dừng' ||
          item.token === 'hủy',
      )
    ) {
      return 'OBSTACLE_OFF';
    }

    return 'OBSTACLE_ON';
  }

  if (hasCurrency && hasAction) {
    return 'CURRENCY';
  }

  if (hasText && hasAction) {
    return 'TEXT';
  }

  if (hasGeneral && !hasFind) {
    return 'GENERAL';
  }

  if (hasFind) {
    return 'FIND';
  }

  return 'UNKNOWN';
};

const findKeywordPosition = classified => {
  const keyword = classified.find(item => {
    return item.type === 'FIND_KEYWORD';
  });

  if (!keyword) {
    return null;
  }

  return {
    sourceStart: keyword.sourceStart,
    sourceEnd: keyword.sourceEnd,
  };
};

const extractTargetFromSource = (sourceTokens, keywordPosition) => {
  const targetTokens = sourceTokens.slice(keywordPosition.sourceEnd + 1);
  return targetTokens.join(' ').trim();
};

const applyTargetSynonyms = text => {
  let result = normalizeText(text);

  for (const synonym of TARGET_SYNONYMS) {
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(synonym.from)}(?=\\s|$)`,
      'g',
    );

    result = result.replace(regex, `$1${synonym.to}`);
  }

  return result;
};

const repairObjectCommandTokens = (
  commandTokens,
  classified,
  scoreThreshold,
  debugLogging,
) => {
  return commandTokens.map((item, index) => {
    const classifiedItem = classified[index];

    if (
      classifiedItem?.type !== 'OBJECT' ||
      classifiedItem?.type !== 'UNKNOWN'
    ) {
      return item;
    }

    const normalizedToken = normalizeText(item.token);

    if (normalizedToken.length < 3) {
      return item;
    }

    const results = COMMAND_FUSE.search(normalizedToken, {
      limit: 1,
    });

    if (!results.length) {
      return item;
    }

    const bestMatch = results[0];
    const score = bestMatch.score ?? 1;

    if (score > scoreThreshold) {
      return item;
    }

    const repairedToken = bestMatch.item.token;

    if (debugLogging) {
      console.log('[intentAnalyzer] Object/Unknown → Command Fuse:', {
        from: normalizedToken,
        to: repairedToken,
        type: bestMatch.item.type,
        score,
      });
    }

    return {
      ...item,
      token: repairedToken,
      repairedFrom: normalizedToken,
      repairedType: bestMatch.item.type,
    };
  });
};

const fuseObject = (target, scoreThreshold, debugLogging) => {
  const normalizedTarget = normalizeText(target);

  if (!normalizedTarget) {
    return null;
  }

  const fuse = new Fuse(OBJECT365_LABELS_VI, {
    includeScore: true,
    threshold: scoreThreshold,
    ignoreLocation: true,
  });

  const results = fuse.search(normalizedTarget);

  if (debugLogging) {
    console.log('[intentAnalyzer] Fuse target:', normalizedTarget);
    console.log(
      '[intentAnalyzer] Fuse results:',
      results.slice(0, 10).map(item => ({
        name: item.item,
        score: item.score,
      })),
    );
  }

  if (!results.length) {
    return null;
  }

  return {
    name: results[0].item,
    score: 1 - results[0].score,
  };
};

export const analyzeCommand = (rawText, intentConfig, debugLogging = false) => {
  const normalizedRaw = normalizeText(rawText);

  if (!normalizedRaw) {
    return {
      intent: 'UNKNOWN',
      targetName: null,
    };
  }

  const { OBJECT_FUSE_THRESH, COMMAND_FUSE_THRESH } = intentConfig;

  const { sourceTokens, commandTokens } = applyCommandAliases(normalizedRaw);

  let aliasedCommandTokens = commandTokens;
  let classified = classifyCommand(aliasedCommandTokens);
  let intent = detectIntent(classified);

  if (intent === 'UNKNOWN') {
    aliasedCommandTokens = repairObjectCommandTokens(
      aliasedCommandTokens,
      classified,
      COMMAND_FUSE_THRESH,
      debugLogging,
    );

    classified = classifyCommand(aliasedCommandTokens);
    intent = detectIntent(classified);
  }

  const keywordPosition = findKeywordPosition(classified);

  if (debugLogging) {
    console.log('[intentAnalyzer] raw:', normalizedRaw);
    console.log('[intentAnalyzer] sourceTokens:', sourceTokens);
    console.log('[intentAnalyzer] commandTokens:', aliasedCommandTokens);
    console.log('[intentAnalyzer] classified:', classified);
    console.log('[intentAnalyzer] intent:', intent);
    console.log('[intentAnalyzer] keyword position:', keywordPosition);
  }

  if (intent !== 'FIND' || !keywordPosition) {
    return {
      intent,
      targetName: null,
    };
  }

  const rawTarget = extractTargetFromSource(sourceTokens, keywordPosition);
  const synonymTarget = applyTargetSynonyms(rawTarget);

  const objectMatch = fuseObject(
    synonymTarget,
    OBJECT_FUSE_THRESH,
    debugLogging,
  );

  if (debugLogging) {
    console.log('[intentAnalyzer] rawTarget:', rawTarget);
    console.log('[intentAnalyzer] synonymTarget:', synonymTarget);
    console.log('[intentAnalyzer] objectMatch:', objectMatch);
  }

  return {
    intent: 'FIND',
    targetName: objectMatch?.name || null,
  };
};

export default analyzeCommand;
