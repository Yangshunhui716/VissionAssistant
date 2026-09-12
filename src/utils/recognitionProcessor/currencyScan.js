export const processCurrencyScan = (
  parsedCurrency,
  labelsVi,
  currencyConfig,
) => {
  'worklet';

  const { SCORE_THRESHOLD, MAX_FRAMES, MIN_APPEARANCE_COUNT } = currencyConfig;

  globalThis.__currencyFrameCount = (globalThis.__currencyFrameCount || 0) + 1;
  globalThis.__currencyResults = globalThis.__currencyResults || [];

  const validNotes = parsedCurrency.filter(
    note => note.score > SCORE_THRESHOLD,
  );

  const currentFrameCounts = {};

  for (let i = 0; i < validNotes.length; i++) {
    const id = validNotes[i].labelIdx;
    currentFrameCounts[id] = (currentFrameCounts[id] || 0) + 1;
  }

  globalThis.__currencyResults.push(currentFrameCounts);

  if (globalThis.__currencyFrameCount < MAX_FRAMES) {
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

    if (appearanceCount[id] >= MIN_APPEARANCE_COUNT) {
      const qty = finalCounts[id];
      const name = labelsVi[id];

      resultParts.push(`${qty} tờ ${name}`);
    }
  }

  if (resultParts.length === 0) {
    return null;
  }

  return resultParts.join(', ');
};

export const resetCurrencyScan = () => {
  'worklet';

  globalThis.__currencyFrameCount = 0;
  globalThis.__currencyResults = [];
};
