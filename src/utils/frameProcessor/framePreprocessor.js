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

import { createBmpBase64 } from '../config/defaultConfig';

export function preprocessFrame(
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
  boundsOutput = null,
) {
  'worklet';

  const dst = outputBuffer;

  if (!srcPixels || srcWidth <= 0 || srcHeight <= 0) {
    return dst;
  }

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

    if (isCapturing) {
      reportData.b1 = createBmpBase64(
        new Uint8Array(rgb.toBuffer('uint8').buffer),
        rgb.cols,
        rgb.rows,
        'HWC',
      );
    }

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
      const mirrored = Mat.create(0, 0, DataTypes.CV_8UC3);

      OpenCV.flip(oriented, mirrored, 1);

      oriented.release();
      oriented = mirrored;
    }

    if (isCapturing) {
      reportData.b2 = createBmpBase64(
        new Uint8Array(oriented.toBuffer('uint8').buffer),
        oriented.cols,
        oriented.rows,
        'HWC',
      );
    }

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

    if (isCapturing) {
      reportData.b3 = createBmpBase64(
        new Uint8Array(resized.toBuffer('uint8').buffer),
        resized.cols,
        resized.rows,
        'HWC',
      );
    }

    const padX = Math.floor((dstWidth - newWidth) / 2);

    const padY = Math.floor((dstHeight - newHeight) / 2);

    const right = dstWidth - newWidth - padX;

    const bottom = dstHeight - newHeight - padY;

    if (boundsOutput) {
      boundsOutput.padX = padX;
      boundsOutput.padY = padY;
      boundsOutput.newW = newWidth;
      boundsOutput.newH = newHeight;
      boundsOutput.dstW = dstWidth;
      boundsOutput.dstH = dstHeight;
    }

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

    if (isCapturing) {
      reportData.b4 = createBmpBase64(
        new Uint8Array(letterboxed.toBuffer('uint8').buffer),
        letterboxed.cols,
        letterboxed.rows,
        'HWC',
      );
    }

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

      for (let i = 0; i < length; i++) {
        dst[i] = pixels[i] * inv255;
      }
    }
  } catch (e) {
    console.log('Error frame preprocessor: ', e);
  } finally {
    if (rgba) {
      rgba.release();
    }

    if (rgb) {
      rgb.release();
    }

    if (oriented) {
      oriented.release();
    }

    if (resized) {
      resized.release();
    }

    if (letterboxed) {
      letterboxed.release();
    }

    if (borderValue) {
      borderValue.release();
    }

    if (resizeSize) {
      resizeSize.release();
    }
  }

  return dst;
}
