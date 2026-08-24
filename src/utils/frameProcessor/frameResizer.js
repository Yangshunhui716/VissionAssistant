import { OpenCV, Mat, DataTypes, BorderTypes, InterpolationFlags,
  RotateFlags, ColorConversionCodes, Size, Scalar } from 'react-native-fast-opencv';

export function resize(srcPixels, srcWidth, srcHeight, dstWidth, dstHeight, outputBuffer, format = 'CHW', orientation = 'portrait', isMirrored = false) {
  'worklet';

  const dst = outputBuffer;
  if (!srcPixels || srcWidth <= 0 || srcHeight <= 0) {
    return dst;
  }

  let rgba = null;
  let rgb = null;
  let oriented = null;
  let mirrored = null;
  let resized = null;
  let letterboxed = null;
  let borderValue = null;
  let resizeSize = null;

  try {
    rgba = Mat.createFromVisionCameraFrameBuffer(srcHeight, srcWidth, 4, srcPixels);

    rgb = Mat.create(0, 0, DataTypes.CV_8UC3);
    OpenCV.cvtColor(rgba, rgb, ColorConversionCodes.COLOR_RGBA2RGB);
    rgba.release();
    rgba = null;

    oriented = rgb;
    const ori = String(orientation || 'portrait').toLowerCase();

    let rotateCode = -1;
    if (ori === 'left' || ori === 'landscape-left') {
      rotateCode = RotateFlags.ROTATE_90_CLOCKWISE;
    } else if (ori === 'right' || ori === 'landscape-right') {
      rotateCode = RotateFlags.ROTATE_90_COUNTERCLOCKWISE;
    } else if (ori === 'down' || ori === 'portrait-upside-down') {
      rotateCode = RotateFlags.ROTATE_180;
    }

    if (rotateCode !== -1) {
      const rotated = Mat.create(0, 0, DataTypes.CV_8UC3);
      OpenCV.rotate(rgb, rotated, rotateCode);
      rgb.release();
      rgb = null;
      oriented = rotated;
    }

    if (isMirrored) {
      mirrored = Mat.create(0, 0, DataTypes.CV_8UC3);
      OpenCV.flip(oriented, mirrored, 1);
      if (oriented !== rgb) oriented.release();
      oriented = mirrored;
    }

    const logicalWidth = oriented.cols;
    const logicalHeight = oriented.rows;

    const scale = Math.min(dstWidth / logicalWidth, dstHeight / logicalHeight);
    const newWidth = Math.max(1, Math.round(logicalWidth * scale));
    const newHeight = Math.max(1, Math.round(logicalHeight * scale));

    resized = Mat.create(0, 0, DataTypes.CV_8UC3);
    resizeSize = Size.create(newWidth, newHeight);
    OpenCV.resize(oriented, resized, resizeSize, 0, 0, InterpolationFlags.INTER_LINEAR);
    resizeSize.release();
    resizeSize = null;

    if (oriented !== rgb) oriented.release();
    oriented = null;

    const padX = Math.floor((dstWidth - newWidth) / 2);
    const padY = Math.floor((dstHeight - newHeight) / 2);
    const right = dstWidth - newWidth - padX;
    const bottom = dstHeight - newHeight - padY;

    letterboxed = Mat.create(0, 0, DataTypes.CV_8UC3);
    borderValue = Scalar.create(114, 114, 114, 0);
    OpenCV.copyMakeBorder(resized, letterboxed, padY, bottom, padX, right, BorderTypes.BORDER_CONSTANT, borderValue);
    borderValue.release();
    borderValue = null;

    resized.release();
    resized = null;

    const result = letterboxed.toBuffer('uint8');
    const pixels = result.buffer;
    letterboxed.release();
    letterboxed = null;

    const inv255 = 1 / 255.0;
    const totalPixels = dstWidth * dstHeight;

    if (format === 'CHW') {
      const planeSize = totalPixels;
      const plane2 = planeSize * 2;
      for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
          const srcIdx = (y * dstWidth + x) * 3;
          const dstIdx = y * dstWidth + x;
          dst[dstIdx]             = pixels[srcIdx]     * inv255;
          dst[dstIdx + planeSize] = pixels[srcIdx + 1] * inv255;
          dst[dstIdx + plane2]    = pixels[srcIdx + 2] * inv255;
        }
      }
    } else {
      const len = totalPixels * 3;
      for (let i = 0; i < len; i++) {
        dst[i] = pixels[i] * inv255;
      }
    }

  } catch (e) {
  } finally {
    if (rgba) rgba.release();
    if (rgb) rgb.release();
    if (oriented && oriented !== rgb) oriented.release();
    if (resized) resized.release();
    if (letterboxed) letterboxed.release();
    if (borderValue) borderValue.release();
    if (resizeSize) resizeSize.release();
  }

  return dst;
}


export function createBmpBase64(pixels, width, height, format, boxes = []) {
  'worklet';
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const dataSize = rowSize * height;
  const fileSize = 54 + dataSize;
  const buffer = new Uint8Array(fileSize);

  buffer[0] = 0x42; buffer[1] = 0x4D;
  buffer[2] = fileSize & 0xff; buffer[3] = (fileSize >> 8) & 0xff; buffer[4] = (fileSize >> 16) & 0xff; buffer[5] = (fileSize >> 24) & 0xff;
  buffer[10] = 54; buffer[14] = 40;
  buffer[18] = width & 0xff; buffer[19] = (width >> 8) & 0xff;
  
  const h = -height;
  buffer[22] = h & 0xff; buffer[23] = (h >> 8) & 0xff; buffer[24] = (h >> 16) & 0xff; buffer[25] = (h >> 24) & 0xff;
  buffer[26] = 1; buffer[28] = 24;

  const channelSize = width * height;
  const channelSize2 = channelSize * 2;

  let p = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r, g, b;
      if (format === 'CHW') {
        const srcIdx = y * width + x;
        r = pixels[srcIdx] * 255; g = pixels[srcIdx + channelSize] * 255; b = pixels[srcIdx + channelSize2] * 255;
      } else {
        const srcIdx = (y * width + x) * 3;
        r = pixels[srcIdx] * 255; g = pixels[srcIdx + 1] * 255; b = pixels[srcIdx + 2] * 255;
      }
      buffer[p] = b; buffer[p + 1] = g; buffer[p + 2] = r; 
      p += 3;
    }
    p += (rowSize - width * 3); 
  }

  if (boxes && boxes.length > 0) {
    const thickness = 2;
    const colorB = 0, colorG = 255, colorR = 0;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const bx = Math.round(box.x);
      const by = Math.round(box.y);
      const bw = Math.round(box.width);
      const bh = Math.round(box.height);

      for (let t = 0; t < thickness; t++) {
        const topY = by + t;
        const botY = by + bh - 1 - t;
        const leftX = bx + t;
        const rightX = bx + bw - 1 - t;

        for (let x = bx; x < bx + bw; x++) {
          if (x >= 0 && x < width) {
            if (topY >= 0 && topY < height) {
              const idx = 54 + topY * rowSize + x * 3;
              buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR;
            }
            if (botY >= 0 && botY < height) {
              const idx = 54 + botY * rowSize + x * 3;
              buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR;
            }
          }
        }
        for (let y = by; y < by + bh; y++) {
          if (y >= 0 && y < height) {
            if (leftX >= 0 && leftX < width) {
              const idx = 54 + y * rowSize + leftX * 3;
              buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR;
            }
            if (rightX >= 0 && rightX < width) {
              const idx = 54 + y * rowSize + rightX * 3;
              buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR;
            }
          }
        }
      }
    }
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  for (let i = 0; i < fileSize; i += 3) {
    const b1 = buffer[i];
    const b2 = i + 1 < fileSize ? buffer[i + 1] : 0;
    const b3 = i + 2 < fileSize ? buffer[i + 2] : 0;
    b64 += chars[b1 >> 2]; b64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    b64 += i + 1 < fileSize ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    b64 += i + 2 < fileSize ? chars[b3 & 63] : '=';
  }
  return 'data:image/bmp;base64,' + b64;
}