import {
  OpenCV,
  Mat,
  MatVector,
  DataTypes,
  BorderTypes,
  InterpolationFlags,
  RotateFlags,
  ColorConversionCodes,
  Size,
  Scalar,
} from 'react-native-fast-opencv';

export function createBmpBase64(pixels, width, height, format, boxes = [], labelsVi = null) {
  'worklet';
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const dataSize = rowSize * height;
  const fileSize = 54 + dataSize;
  const buffer = new Uint8Array(fileSize);

  buffer[0] = 0x42; buffer[1] = 0x4d;
  buffer[2] = fileSize & 0xff; buffer[3] = (fileSize >> 8) & 0xff;
  buffer[4] = (fileSize >> 16) & 0xff; buffer[5] = (fileSize >> 24) & 0xff;
  buffer[10] = 54; buffer[14] = 40;
  buffer[18] = width & 0xff; buffer[19] = (width >> 8) & 0xff;

  const h = -height;
  buffer[22] = h & 0xff; buffer[23] = (h >> 8) & 0xff;
  buffer[24] = (h >> 16) & 0xff; buffer[25] = (h >> 24) & 0xff;
  buffer[26] = 1; buffer[28] = 24;

  const channelSize = width * height;
  const channelSize2 = channelSize * 2;

  let p = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r, g, b;
      if (format === 'CHW') {
        const srcIdx = y * width + x;
        r = pixels[srcIdx] * 255;
        g = pixels[srcIdx + channelSize] * 255;
        b = pixels[srcIdx + channelSize2] * 255;
      } else {
        const srcIdx = (y * width + x) * 3;
        r = pixels[srcIdx]; g = pixels[srcIdx + 1]; b = pixels[srcIdx + 2];
      }
      buffer[p] = b; buffer[p + 1] = g; buffer[p + 2] = r;
      p += 3;
    }
    p += rowSize - width * 3;
  }

  if (boxes && boxes.length > 0) {
    const thickness = 2;
    const colorB = 0, colorG = 255, colorR = 0;

    const FONT = {
      'A':[2,5,7,5,5], 'B':[6,5,6,5,6], 'C':[3,4,4,4,3], 'D':[6,5,5,5,6],
      'E':[7,4,6,4,7], 'F':[7,4,6,4,4], 'G':[3,4,5,5,3], 'H':[5,5,7,5,5],
      'I':[7,2,2,2,7], 'J':[1,1,1,5,2], 'K':[5,6,4,6,5], 'L':[4,4,4,4,7],
      'M':[5,7,5,5,5], 'N':[5,6,5,3,5], 'O':[2,5,5,5,2], 'P':[6,5,6,4,4],
      'Q':[2,5,5,6,3], 'R':[6,5,6,5,5], 'S':[3,4,2,1,6], 'T':[7,2,2,2,2],
      'U':[5,5,5,5,3], 'V':[5,5,5,5,2], 'W':[5,5,5,7,5], 'X':[5,5,2,5,5],
      'Y':[5,5,2,2,2], 'Z':[7,1,2,4,7], '0':[2,5,5,5,2], '1':[2,6,2,2,7], 
      '2':[6,1,2,4,7], '3':[6,1,2,1,6], '4':[5,5,7,1,1], '5':[7,4,6,1,6], 
      '6':[3,4,6,5,2], '7':[7,1,2,2,2], '8':[2,5,2,5,2], '9':[2,5,3,1,6],
      '.':[0,0,0,0,2], '%':[5,1,2,4,5], ' ':[0,0,0,0,0], '-':[0,0,7,0,0],
      ':':[0,2,0,2,0], '[':[6,4,4,4,6], ']':[3,1,1,1,3]
    };

    const removeAccents = (str) => {
      let res = str.toLowerCase();
      res = res.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a');
      res = res.replace(/[èéẹẻẽêềếệểễ]/g, 'e');
      res = res.replace(/[ìíịỉĩ]/g, 'i');
      res = res.replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o');
      res = res.replace(/[ùúụủũưừứựửữ]/g, 'u');
      res = res.replace(/[ỳýỵỷỹ]/g, 'y');
      res = res.replace(/đ/g, 'd');
      return res.toUpperCase();
    };

    const drawChar = (char, px, py, scale) => {
      const charData = FONT[char] || FONT[' '];
      for (let r = 0; r < 5; r++) {
        const rowBits = charData[r];
        for (let c = 0; c < 3; c++) {
          if ((rowBits >> (2 - c)) & 1) {
            for (let dy = 0; dy < scale; dy++) {
              for (let dx = 0; dx < scale; dx++) {
                const finalX = px + c * scale + dx;
                const finalY = py + r * scale + dy;
                if (finalX >= 0 && finalX < width && finalY >= 0 && finalY < height) {
                  const idx = 54 + finalY * rowSize + finalX * 3;
                  buffer[idx] = 255; buffer[idx + 1] = 255; buffer[idx + 2] = 255;
                }
              }
            }
          }
        }
      }
    };

    const drawText = (str, px, py, scale) => {
      const textWidth = str.length * 4 * scale;
      const textHeight = 5 * scale;
      for (let y = py - 2; y < py + textHeight + 2; y++) {
        for (let x = px - 2; x < px + textWidth; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = 54 + y * rowSize + x * 3;
            buffer[idx] = 0; buffer[idx + 1] = 80; buffer[idx + 2] = 0;
          }
        }
      }
      let cx = px;
      for (let i = 0; i < str.length; i++) {
        drawChar(str[i], cx, py, scale);
        cx += 4 * scale;
      }
    };

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const bx = Math.round(box.x);
      const by = Math.round(box.y);
      const bw = Math.round(box.width);
      const bh = Math.round(box.height);

      for (let t = 0; t < thickness; t++) {
        const topY = by + t; const botY = by + bh - 1 - t;
        const leftX = bx + t; const rightX = bx + bw - 1 - t;
        for (let x = bx; x < bx + bw; x++) {
          if (x >= 0 && x < width) {
            if (topY >= 0 && topY < height) { const idx = 54 + topY * rowSize + x * 3; buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR; }
            if (botY >= 0 && botY < height) { const idx = 54 + botY * rowSize + x * 3; buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR; }
          }
        }
        for (let y = by; y < by + bh; y++) {
          if (y >= 0 && y < height) {
            if (leftX >= 0 && leftX < width) { const idx = 54 + y * rowSize + leftX * 3; buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR; }
            if (rightX >= 0 && rightX < width) { const idx = 54 + y * rowSize + rightX * 3; buffer[idx] = colorB; buffer[idx + 1] = colorG; buffer[idx + 2] = colorR; }
          }
        }
      }

      if (labelsVi) {
        let labelName = 'ID ' + box.labelIdx;
        if (labelsVi[box.labelIdx]) {
          labelName = labelsVi[box.labelIdx];
        }
        const scoreStr = Math.round(box.score * 100) + '%';
        const textStr = '[' + box.labelIdx + '] ' + removeAccents(labelName) + ' ' + scoreStr;

        const textScale = 2;
        const textH = 5 * textScale + 4; 
        let textY = by - textH;
        if (textY < 0) textY = by;

        drawText(textStr, Math.max(0, bx), textY, textScale);
      }
    }
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  for (let i = 0; i < fileSize; i += 3) {
    const b1 = buffer[i]; const b2 = i + 1 < fileSize ? buffer[i + 1] : 0; const b3 = i + 2 < fileSize ? buffer[i + 2] : 0;
    b64 += chars[b1 >> 2];
    b64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    b64 += i + 1 < fileSize ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    b64 += i + 2 < fileSize ? chars[b3 & 63] : '=';
  }
  return 'data:image/bmp;base64,' + b64;
}

export function resize(
  srcPixels,
  srcWidth,
  srcHeight,
  dstWidth,
  dstHeight,
  outputBuffer,
  format = 'CHW',
  orientation = 'portrait',
  isMirrored = false,
  reportData = null,
) {
  'worklet';
  const dst = outputBuffer;
  if (!srcPixels || srcWidth <= 0 || srcHeight <= 0) return dst;

  const isCapturing = reportData !== null;

  let rgba = null;
  let rgb = null;
  let oriented = null;
  let resized = null;
  let letterboxed = null;
  let resizeSize = null;
  let borderValue = null;

  try {
    rgba = Mat.createFromVisionCameraFrameBuffer(
      srcHeight,
      srcWidth,
      4,
      srcPixels,
    );
    rgb = Mat.create(0, 0, DataTypes.CV_8UC3);
    OpenCV.cvtColor(rgba, rgb, ColorConversionCodes.COLOR_RGBA2RGB);

    if (isCapturing)
      reportData.b1 = createBmpBase64(
        new Uint8Array(rgb.toBuffer('uint8').buffer),
        rgb.cols,
        rgb.rows,
        'HWC',
      );

    rgba.release();
    rgba = null;
    oriented = rgb;

    const ori = String(orientation || 'portrait').toLowerCase();
    let rotateCode = -1;
    if (ori === 'left' || ori === 'landscape-left')
      rotateCode = RotateFlags.ROTATE_90_CLOCKWISE;
    else if (ori === 'right' || ori === 'landscape-right')
      rotateCode = RotateFlags.ROTATE_90_COUNTERCLOCKWISE;
    else if (ori === 'down' || ori === 'portrait-upside-down')
      rotateCode = RotateFlags.ROTATE_180;

    if (rotateCode !== -1) {
      const rotated = Mat.create(0, 0, DataTypes.CV_8UC3);
      OpenCV.rotate(rgb, rotated, rotateCode);
      rgb.release();
      rgb = null;
      oriented = rotated;
    }
    if (isMirrored) {
      const mirrored = Mat.create(0, 0, DataTypes.CV_8UC3);
      OpenCV.flip(oriented, mirrored, 1);
      oriented.release();
      oriented = mirrored;
    }

    if (isCapturing)
      reportData.b2 = createBmpBase64(
        new Uint8Array(oriented.toBuffer('uint8').buffer),
        oriented.cols,
        oriented.rows,
        'HWC',
      );

    const logicalWidth = oriented.cols;
    const logicalHeight = oriented.rows;
    const scale = Math.min(dstWidth / logicalWidth, dstHeight / logicalHeight);
    const newWidth = Math.max(1, Math.round(logicalWidth * scale));
    const newHeight = Math.max(1, Math.round(logicalHeight * scale));

    resized = Mat.create(0, 0, DataTypes.CV_8UC3);
    resizeSize = Size.create(newWidth, newHeight);
    OpenCV.resize(
      oriented,
      resized,
      resizeSize,
      0,
      0,
      InterpolationFlags.INTER_LINEAR,
    );
    resizeSize.release();
    resizeSize = null;
    oriented.release();
    oriented = null;

    if (isCapturing)
      reportData.b3 = createBmpBase64(
        new Uint8Array(resized.toBuffer('uint8').buffer),
        resized.cols,
        resized.rows,
        'HWC',
      );

    const padX = Math.floor((dstWidth - newWidth) / 2);
    const padY = Math.floor((dstHeight - newHeight) / 2);
    const right = dstWidth - newWidth - padX;
    const bottom = dstHeight - newHeight - padY;

    if (padX === 0 && padY === 0 && right === 0 && bottom === 0) {
      letterboxed = resized;
      resized = null;
    } else {
      letterboxed = Mat.create(0, 0, DataTypes.CV_8UC3);
      borderValue = Scalar.create(114, 114, 114, 0);
      OpenCV.copyMakeBorder(
        resized,
        letterboxed,
        padY,
        bottom,
        padX,
        right,
        BorderTypes.BORDER_CONSTANT,
        borderValue,
      );
      borderValue.release();
      borderValue = null;
      resized.release();
      resized = null;
    }

    if (isCapturing)
      reportData.b4 = createBmpBase64(
        new Uint8Array(letterboxed.toBuffer('uint8').buffer),
        letterboxed.cols,
        letterboxed.rows,
        'HWC',
      );

    if (format === 'CHW') {
      const channels = MatVector.create();
      OpenCV.split(letterboxed, channels);
      const rMat = channels.get(0);
      const gMat = channels.get(1);
      const bMat = channels.get(2);
      const r = new Uint8Array(rMat.toBuffer('uint8').buffer);
      const g = new Uint8Array(gMat.toBuffer('uint8').buffer);
      const b = new Uint8Array(bMat.toBuffer('uint8').buffer);
      const planeSize = dstWidth * dstHeight;
      const inv255 = 1 / 255;
      for (let i = 0; i < planeSize; i++) {
        dst[i] = r[i] * inv255;
        dst[planeSize + i] = g[i] * inv255;
        dst[planeSize * 2 + i] = b[i] * inv255;
      }
    } else {
      const pixels = new Uint8Array(letterboxed.toBuffer('uint8').buffer);
      const length = dstWidth * dstHeight * 3;
      const inv255 = 1 / 255;
      for (let i = 0; i < length; i++) dst[i] = pixels[i] * inv255;
    }
  } catch (e) {
    console.log('Error frame preprocessor: ', e);
  } finally {
    if (rgba) rgba.release();
    if (rgb) rgb.release();
    if (oriented) oriented.release();
    if (resized) resized.release();
    if (letterboxed) letterboxed.release();
    if (borderValue) borderValue.release();
    if (resizeSize) resizeSize.release();
  }
  return dst;
}