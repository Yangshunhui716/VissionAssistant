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
  timingOutput = null,
) {
  'worklet';

  const dst = outputBuffer;
  const tStart = timingOutput ? Date.now() : 0;

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
  let channels = null;
  let chw8u = null;
  let chw32f = null;
  let hwc32f = null;

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

    const tOpenCvDone = timingOutput ? Date.now() : 0;

    if (format === 'CHW') {
      // C++ Native CHW Pipeline: split into 3 planes (R, G, B) and vertically concatenate into a single planar matrix (3H x W)
      channels = MatVector.create();
      OpenCV.split(letterboxed, channels);

      chw8u = Mat.create(0, 0, DataTypes.CV_8UC1);
      OpenCV.vconcat(channels, chw8u);

      channels.release();
      channels = null;

      // Native C++ float32 conversion & 1/255.0 normalization with ARM NEON SIMD
      chw32f = Mat.create(0, 0, DataTypes.CV_32FC1);
      OpenCV.convertTo(chw8u, chw32f, DataTypes.CV_32FC1, 1 / 255.0, 0);

      chw8u.release();
      chw8u = null;

      // Single JSI typed array access and low-level C++ memcpy into destination buffer
      const floatBuf = chw32f.toBuffer('float32').buffer;
      dst.set(floatBuf);

      chw32f.release();
      chw32f = null;
    } else {
      // C++ Native HWC Pipeline: direct convertTo float32 with ARM NEON SIMD
      hwc32f = Mat.create(0, 0, DataTypes.CV_32FC3);
      OpenCV.convertTo(letterboxed, hwc32f, DataTypes.CV_32FC3, 1 / 255.0, 0);

      const floatBuf = hwc32f.toBuffer('float32').buffer;
      dst.set(floatBuf);

      hwc32f.release();
      hwc32f = null;
    }
    if (timingOutput) {
      const tEnd = Date.now();
      timingOutput.opencvMs = tOpenCvDone - tStart;
      timingOutput.chwMs = tEnd - tOpenCvDone;
      timingOutput.totalMs = tEnd - tStart;
    }
  } catch (e) {
    console.log('[framePreprocessor] Error frame preprocessor: ', e);
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

    if (channels) {
      channels.release();
      channels = null;
    }

    if (chw8u) {
      chw8u.release();
      chw8u = null;
    }

    if (chw32f) {
      chw32f.release();
      chw32f = null;
    }

    if (hwc32f) {
      hwc32f.release();
      hwc32f = null;
    }
  }

  return dst;
}
