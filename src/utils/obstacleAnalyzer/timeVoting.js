export function timeVoting(parsed, frameHistory, cocoLabelsVi) {
  'worklet';

  const names = [];
  const emergencyLabels = [];

  for (let i = 0; i < parsed.length; i++) {
    const obj = parsed[i];
    const label = cocoLabelsVi[obj.labelIdx];
    
    if (!names.includes(label)) {
      names.push(label);
    }

    const areaRatio = (obj.width * obj.height) / (320 * 320);
    if (areaRatio > 0.3) { 
      emergencyLabels.push(label);
    }
  }

  frameHistory.push(names);
  if (frameHistory.length > 3) {
    frameHistory.shift();
  }

  const voteCounts = {};
  for (let i = 0; i < frameHistory.length; i++) {
    const frameLabels = frameHistory[i];
    for (let j = 0; j < frameLabels.length; j++) {
      const label = frameLabels[j];
      voteCounts[label] = (voteCounts[label] || 0) + 1;
    }
  }
  
  const stableLabels = Object.keys(voteCounts).filter(label => voteCounts[label] >= 2);

  const finalLabels = [...stableLabels, ...emergencyLabels];
  
  return [...new Set(finalLabels)];
}