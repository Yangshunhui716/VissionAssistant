export function resize(srcPixels, srcWidth, srcHeight, dstWidth, dstHeight) {
  'worklet';
  
  const dstPixels = new Float32Array(dstWidth * dstHeight * 3);
  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
  
  const newW = Math.floor(srcWidth * scale);
  const newH = Math.floor(srcHeight * scale);

  const padX = Math.floor((dstWidth - newW) / 2);
  const padY = Math.floor((dstHeight - newH) / 2);

  const xRatio = srcWidth / newW;
  const yRatio = srcHeight / newH;

  const channelSize = dstWidth * dstHeight;

  for (let y = 0; y < newH; y++) {
    const srcY = Math.floor(y * yRatio);
    const dstY = y + padY; 

    for (let x = 0; x < newW; x++) {
      const srcX = Math.floor(x * xRatio);
      const dstX = x + padX; 

      const srcIdx = (srcY * srcWidth + srcX) * 4;

      const pixelIdx = dstY * dstWidth + dstX;
      const rIdx = pixelIdx;
      const gIdx = pixelIdx + channelSize;
      const bIdx = pixelIdx + (channelSize * 2);

      dstPixels[rIdx] = srcPixels[srcIdx] / 255.0;
      dstPixels[gIdx] = srcPixels[srcIdx + 1] / 255.0;
      dstPixels[bIdx] = srcPixels[srcIdx + 2] / 255.0;
    }
  }
  
  return dstPixels;
}