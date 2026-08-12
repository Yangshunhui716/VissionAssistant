export const isCameraBlocked = (buffer, width, height) => {
  'worklet';

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  
  const channelSize = width * height;
  const step = 50; 

  for (let i = 0; i < channelSize; i += step) {
     const val = buffer[i] * 255; 
     sum += val;
     sumSq += val * val;
     count++;
  }

  const mean = sum / count;
  const variance = (sumSq / count) - (mean * mean);
  const standardDeviation = Math.sqrt(variance);

  return standardDeviation < 15;
};