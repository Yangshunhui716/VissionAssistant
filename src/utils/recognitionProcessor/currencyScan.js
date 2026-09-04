const SCAN_SCORE_THRESHOLD = 0.1;
const CURRENCY_MAX_FRAMES = 3;

export const processCurrencyScan = (parsedCurrency, labelsVi) => {
  'worklet';
  
  globalThis.__currencyFrameCount = (globalThis.__currencyFrameCount || 0) + 1;
  globalThis.__currencyResults = globalThis.__currencyResults || [];

  const validNotes = parsedCurrency.filter(note => note.score > SCAN_SCORE_THRESHOLD);
  const currentFrameCounts = {};
  
  for (let i = 0; i < validNotes.length; i++) {
    const id = validNotes[i].labelIdx;
    currentFrameCounts[id] = (currentFrameCounts[id] || 0) + 1;
  }
  
  globalThis.__currencyResults.push(currentFrameCounts);
  if (globalThis.__currencyFrameCount < CURRENCY_MAX_FRAMES) {
    return null; 
  }

  const finalCounts = {};
  const appearanceCount = {};

  for (let i = 0; i < globalThis.__currencyResults.length; i++) {
    const frameCounts = globalThis.__currencyResults[i];
    const ids = Object.keys(frameCounts);
    
    for (let j = 0; j < ids.length; j++) {
      const id = ids[j];
      appearanceCount[id] = (appearanceCount[id] || 0) + 1;
      finalCounts[id] = Math.max(finalCounts[id] || 0, frameCounts[id]); 
    }
  }

  globalThis.__currencyFrameCount = 0;
  globalThis.__currencyResults = [];

  const resultParts = [];
  const validIds = Object.keys(appearanceCount);
  
  for (let i = 0; i < validIds.length; i++) {
    const id = validIds[i];
    if (appearanceCount[id] >= 2) {
      const qty = finalCounts[id];
      const name = labelsVi[id];
      resultParts.push(`${qty} tờ ${name}`);
    }
  }

  if (resultParts.length === 0) return null;
  return resultParts.join(' và ');
};

export const resetCurrencyScan = () => {
  'worklet';
  globalThis.__currencyFrameCount = 0;
  globalThis.__currencyResults = [];
};