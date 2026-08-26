const GRID = 3;
const STEP = 20;
const VARIANCE_THRESHOLD = 49;
const BLOCKED_THRESHOLD = 5;

export const isCameraBlocked = (buffer, width, height, bytesPerRow) => {
  'worklet';

  const regionW = Math.floor(width / GRID);
  const regionH = Math.floor(height / GRID);
  const bytesPerPixel = Math.round(bytesPerRow / width);

  let blockedRegions = 0;
  let checkedRegions = 0;

  for (let row = 0; row < GRID; row++) {
    const startY = row * regionH;
    const endY = row === GRID - 1 ? height : startY + regionH;

    for (let col = 0; col < GRID; col++) {
      const startX = col * regionW;
      const endX = col === GRID - 1 ? width : startX + regionW;

      let sum = 0;
      let sumSq = 0;
      let count = 0;

      for (let y = startY; y < endY; y += STEP) {
        const rowOffset = y * bytesPerRow;

        for (let x = startX; x < endX; x += STEP) {
          const index = rowOffset + x * bytesPerPixel;
          if (index + 2 >= buffer.length) {
            continue;
          }
          const value =
            (buffer[index] + buffer[index + 1] + buffer[index + 2]) / 3;
          sum += value;
          sumSq += value * value;
          count++;
        }
      }

      checkedRegions++;

      if (count > 0) {
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;

        if (variance < VARIANCE_THRESHOLD) {
          blockedRegions++;

          if (blockedRegions >= BLOCKED_THRESHOLD) {
            return true;
          }
        }
      }

      const regionsLeft = 9 - checkedRegions;
      if (blockedRegions + regionsLeft < BLOCKED_THRESHOLD) {
        return false;
      }
    }
  }

  return false;
};