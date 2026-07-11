export function resize(srcPixels, srcWidth, srcHeight, dstWidth, dstHeight) {
  'worklet';

  const dstPixels = new Float32Array(dstWidth * dstHeight * 3);

  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);

  const newW = (srcWidth * scale) | 0;
  const newH = (srcHeight * scale) | 0;

  const padX = ((dstWidth - newW) / 2) | 0;
  const padY = ((dstHeight - newH) / 2) | 0;

  const xRatio = srcWidth / newW;
  const yRatio = srcHeight / newH;

  const channelSize = dstWidth * dstHeight;
  const channelSize2 = channelSize << 1;

  const inv255 = 1.0 / 255.0;

  // Lookup tables
  const xMap = new Int32Array(newW);
  const yMap = new Int32Array(newH);

  for (let x = 0; x < newW; x++) {
    xMap[x] = (x * xRatio) | 0;
  }

  for (let y = 0; y < newH; y++) {
    yMap[y] = ((y * yRatio) | 0) * srcWidth;
  }

  for (let y = 0; y < newH; y++) {

    const srcRow = yMap[y];
    const dstRow = (y + padY) * dstWidth + padX;

    for (let x = 0; x < newW; x++) {

      const srcIdx = (srcRow + xMap[x]) << 2;
      const dstIdx = dstRow + x;

      dstPixels[dstIdx] = srcPixels[srcIdx] * inv255;
      dstPixels[dstIdx + channelSize] = srcPixels[srcIdx + 1] * inv255;
      dstPixels[dstIdx + channelSize2] = srcPixels[srcIdx + 2] * inv255;
    }
  }

  return dstPixels;
}