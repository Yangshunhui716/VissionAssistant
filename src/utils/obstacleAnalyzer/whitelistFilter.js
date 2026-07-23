export function whitelistFilter(parsed, stableLabels, whitelist, cocoLabelsVi) {
  'worklet';

  return parsed.filter(item => {
    const itemName = cocoLabelsVi[item.labelIdx];
    return stableLabels.includes(itemName) && whitelist.includes(itemName);
  });
}