import {
  OpenCV,
  Mat,
  DataTypes,
  BorderTypes,
  InterpolationFlags,
  Size,
  ColorConversionCodes,
} from 'react-native-fast-opencv';

import { IS_DEBUG } from '../config/runtimeConfig';

const THRESHOLD_DARK = 25;
const THRESHOLD_GLARE = 230;
const THRESHOLD_BLUR = 100;
const THRESHOLD_BLUR_STD = 10;

const ANALYZE_MAX_SIZE = 640;

export function analyzeFrameQuality(srcPixels, width, height) {
  'worklet';

  if (!srcPixels || width <= 0 || height <= 0) {
    return {
      isBad: false,
      reason: '',
    };
  }

  let rgba = null;
  let gray = null;
  let resizedGray = null;

  let meanMat = null;
  let stddevMat = null;

  let laplacian = null;
  let lapMean = null;
  let lapStddev = null;

  let resizeSize = null;

  try {
    rgba = Mat.createFromVisionCameraFrameBuffer(height, width, 4, srcPixels);

    gray = Mat.create(0, 0, DataTypes.CV_8UC1);

    OpenCV.cvtColor(rgba, gray, ColorConversionCodes.COLOR_RGBA2GRAY);

    rgba.release();
    rgba = null;

    const scale = Math.min(
      1,
      ANALYZE_MAX_SIZE / gray.cols,
      ANALYZE_MAX_SIZE / gray.rows,
    );

    const analyzeWidth = Math.max(1, Math.round(gray.cols * scale));

    const analyzeHeight = Math.max(1, Math.round(gray.rows * scale));

    if (analyzeWidth !== gray.cols || analyzeHeight !== gray.rows) {
      resizedGray = Mat.create(0, 0, DataTypes.CV_8UC1);

      resizeSize = Size.create(analyzeWidth, analyzeHeight);

      OpenCV.resize(
        gray,
        resizedGray,
        resizeSize,
        0,
        0,
        InterpolationFlags.INTER_AREA,
      );

      resizeSize.release();
      resizeSize = null;

      gray.release();
      gray = null;
    } else {
      resizedGray = gray;
      gray = null;
    }

    meanMat = Mat.create(1, 1, DataTypes.CV_64FC1);

    stddevMat = Mat.create(1, 1, DataTypes.CV_64FC1);

    OpenCV.meanStdDev(resizedGray, meanMat, stddevMat);

    const meanBuffer = meanMat.toBuffer('float64');
    const stdBuffer = stddevMat.toBuffer('float64');

    const mean = meanBuffer?.buffer?.[0];
    const stddev = stdBuffer?.buffer?.[0];

    if (
      mean === undefined ||
      stddev === undefined ||
      !Number.isFinite(mean) ||
      !Number.isFinite(stddev)
    ) {
      if (IS_DEBUG) {
        console.log('[QUALITY] Không đọc được Mean/StdDev');
      }

      return {
        isBad: false,
        reason: '',
      };
    }

    if (mean < THRESHOLD_DARK) {
      if (IS_DEBUG) {
        console.log(
          `[QUALITY] DARK | mean=${mean.toFixed(2)} ` +
            `std=${stddev.toFixed(2)}`,
        );
      }

      return {
        isBad: true,
        reason: 'Camera quá tối',
      };
    }

    if (mean > THRESHOLD_GLARE) {
      if (IS_DEBUG) {
        console.log(
          `[QUALITY] GLARE | mean=${mean.toFixed(2)} ` +
            `std=${stddev.toFixed(2)}`,
        );
      }

      return {
        isBad: true,
        reason: 'Camera bị lóa sáng',
      };
    }

    laplacian = Mat.create(0, 0, DataTypes.CV_64FC1);

    OpenCV.Laplacian(
      resizedGray,
      laplacian,
      DataTypes.CV_64F,
      3,
      1,
      0,
      BorderTypes.BORDER_DEFAULT,
    );

    lapMean = Mat.create(1, 1, DataTypes.CV_64FC1);

    lapStddev = Mat.create(1, 1, DataTypes.CV_64FC1);

    OpenCV.meanStdDev(laplacian, lapMean, lapStddev);

    const lapStdBuffer = lapStddev.toBuffer('float64');

    const lapStd = lapStdBuffer?.buffer?.[0];

    if (lapStd === undefined || !Number.isFinite(lapStd)) {
      if (IS_DEBUG) {
        console.log('[QUALITY] Không đọc được Laplacian StdDev');
      }

      return {
        isBad: false,
        reason: '',
      };
    }

    const laplacianVariance = lapStd * lapStd;

    if (IS_DEBUG) {
      console.log(
        `[QUALITY] ` +
          `mean=${mean.toFixed(2)} ` +
          `std=${stddev.toFixed(2)} ` +
          `lapVar=${laplacianVariance.toFixed(2)}`,
      );
    }

    if (laplacianVariance < THRESHOLD_BLUR && stddev >= THRESHOLD_BLUR_STD) {
      if (IS_DEBUG) {
        console.log('[QUALITY] BLUR');
      }

      return {
        isBad: true,
        reason: 'Camera mất nét',
      };
    }

    return {
      isBad: false,
      reason: 'Tốt',
    };
  } catch (error) {
    if (IS_DEBUG) {
      console.log('[FrameAnalyzer] Error:', String(error));
    }

    return {
      isBad: false,
      reason: '',
    };
  } finally {
    if (rgba) rgba.release();
    if (gray) gray.release();
    if (resizedGray) resizedGray.release();

    if (meanMat) meanMat.release();
    if (stddevMat) stddevMat.release();

    if (laplacian) laplacian.release();
    if (lapMean) lapMean.release();
    if (lapStddev) lapStddev.release();

    if (resizeSize) resizeSize.release();
  }
}
