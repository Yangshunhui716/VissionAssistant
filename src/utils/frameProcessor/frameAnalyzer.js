const STEP = 20;
const THRESHOLD_DARK = 25;
const THRESHOLD_GLARE = 230;
const THRESHOLD_BLOCKED = 40;
const THRESHOLD_BLUR = 8.0;
const CROP_MARGIN_RATIO = 0.2;
const BLUR_VARIANCE_TOLERANCE = 120;

export const analyzeCameraQuality = (buffer, width, height, bytesPerRow) => {
  'worklet';
  const bytesPerPixel = Math.round(bytesPerRow / width);

  const startX = Math.floor(width * CROP_MARGIN_RATIO);
  const endX = Math.floor(width * (1 - CROP_MARGIN_RATIO)) - STEP;
  const startY = Math.floor(height * CROP_MARGIN_RATIO);
  const endY = Math.floor(height * (1 - CROP_MARGIN_RATIO)) - STEP;

  const colStep = STEP * bytesPerPixel;
  const rowStep = STEP * bytesPerRow;
  const greenOffset = 1;

  let sum = 0;
  let sumSq = 0;
  let edgeSum = 0;
  let count = 0;

  for (let y = startY; y < endY; y += STEP) {
    let idx = y * bytesPerRow + startX * bytesPerPixel + greenOffset;

    for (let x = startX; x < endX; x += STEP) {
      const p = buffer[idx];
      const pRight = buffer[idx + colStep];
      const pBottom = buffer[idx + rowStep];

      sum += p;
      sumSq += p * p;

      edgeSum += Math.abs(p - pRight) + Math.abs(p - pBottom);

      count++;
      idx += colStep;
    }
  }

  if (count === 0) return { isBad: false, reason: '' };

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  const edgeStrength = edgeSum / count;

  if (mean < THRESHOLD_DARK) return { isBad: true, reason: 'Camera quá tối' };

  if (mean > THRESHOLD_GLARE)
    return { isBad: true, reason: 'Camera bị chói lóa' };

  if (variance < THRESHOLD_BLOCKED)
    return { isBad: true, reason: 'Camera đang bị che' };

  if (edgeStrength < THRESHOLD_BLUR && variance < BLUR_VARIANCE_TOLERANCE)
    return { isBad: true, reason: 'Camera bị nhòe mất nét' };

  return { isBad: false, reason: 'Tốt' };
};
