export function resize(srcPixels, srcWidth, srcHeight, 
  dstWidth, dstHeight, bytesPerRow, outputBuffer, format = 'CHW') {
  'worklet';

  const dstPixels = outputBuffer;
  dstPixels.fill(format === 'CHW' ? (114 / 255) : 0);

  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
  const newW = (srcWidth * scale) | 0;
  const newH = (srcHeight * scale) | 0;

  const padX = ((dstWidth - newW) / 2) | 0;
  const padY = ((dstHeight - newH) / 2) | 0;

  const xRatio = srcWidth / newW;
  const yRatio = srcHeight / newH;

  const inv255 = 1.0 / 255.0;
  const bytesPerPixel = Math.round(bytesPerRow / srcWidth); 

  if (format === 'CHW') {
    const channelSize = dstWidth * dstHeight;
    const channelSize2 = channelSize * 2; 
    for (let y = 0; y < newH; y++) {
      const srcY = (y * yRatio) | 0;
      const dstRow = (y + padY) * dstWidth + padX;
      const srcRowByteOffset = srcY * bytesPerRow;

      for (let x = 0; x < newW; x++) {
        const srcX = (x * xRatio) | 0;
        const srcIdx = srcRowByteOffset + (srcX * bytesPerPixel); 
        const dstIdx = dstRow + x;

        if (srcIdx >= 0 && (srcIdx + 2) < srcPixels.length) {
          dstPixels[dstIdx] = srcPixels[srcIdx] * inv255;
          dstPixels[dstIdx + channelSize] = srcPixels[srcIdx + 1] * inv255;
          dstPixels[dstIdx + channelSize2] = srcPixels[srcIdx + 2] * inv255;
        }
      }
    }
  } else {
    for (let y = 0; y < newH; y++) {
      const srcY = (y * yRatio) | 0;
      const dstY = y + padY; 
      const srcRowByteOffset = srcY * bytesPerRow;

      for (let x = 0; x < newW; x++) {
        const srcX = (x * xRatio) | 0;
        const dstX = x + padX; 
        const srcIdx = srcRowByteOffset + (srcX * bytesPerPixel); 
        const dstIdx = (dstY * dstWidth + dstX) * 3; 
        if (srcIdx >= 0 && (srcIdx + 2) < srcPixels.length) {
          dstPixels[dstIdx] = srcPixels[srcIdx] * inv255;
          dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1] * inv255;
          dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2] * inv255;
        }
      }
    }
  }
  return dstPixels;
}