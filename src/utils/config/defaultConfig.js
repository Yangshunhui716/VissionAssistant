export const DEFAULT_CONFIG = {
  debug: {
    enabled: false,
    logging: false,
    qualityFrame: false,
    showImage: false,
    showFps: false,
    showObjects: false,
  },

  vision: {
    PROCESS_DELAY_MS: 250,
    MIDAS_DELAY_MS: 2000,
    MIDAS_NEW_TARGET_DELAY_MS: 500,
    MIDAS_SEARCH_INTERVAL_MS: 1000,
    BLOCKED_WARN_MS: 4000,
    THREAT_COOLDOWN_MS: 4000,
    THREAT_RESET_MS: 2000,
    ALERT_CLEAR_DELAY_MS: 1000,
    CURRENCY_COOLDOWN_MS: 4000,
    CURRENCY_TIMEOUT_MS: 6000,
    DEBUG_DUMP_INTERVAL_MS: 3000,
    FPS_UPDATE_INTERVAL_MS: 1000,
    SEARCH_MAX_FRAMES: 5,
    SCAN_GENERAL_MAX_FRAMES: 10,
  },

  frameQuality: {
    DARK_THRESHOLD: 25,
    GLARE_THRESHOLD: 200,
    BLUR_THRESHOLD: 150,
    MIN_STDDEV: 15,
    ANALYZE_MAX_SIZE: 640,
  },

  yolo: {
    CONFIDENCE_THRESHOLD: 0.45,
  },

  search: {
    SCORE_THRESHOLD: 0.45,
  },

  generalScan: {
    DIST_SMOOTHING_FACTOR: 10,
  },

  currency: {
    SCORE_THRESHOLD: 0.1,
    MAX_FRAMES: 3,
    MIN_APPEARANCE_COUNT: 2,
  },

  obstacle: {
    IOU_MATCH: 0.2,
    CONFIRM_HITS: 2,
    MAX_MISSES: 3,
    HISTORY_LEN: 5,
    STALE_MS: 2000,
    EMERGENCY_AREA_RATIO: 0.15,
    GROWTH_RATIO: 1.3,
    CROSS_MOVE_RATIO: 0.1,
    MIN_MOTION_FRAMES: 2,

    MIN_AREA_RATIO: 0.33,
    MAX_AREA_RATIO: 3.0,
    MAX_Y_DIFF_RATIO: 0.3,

    TARGET_RETENTION_BONUS: 1.0,

    GRID_WEIGHTS: [
      [0.5, 0.8, 0.5],
      [1.0, 1.5, 1.0],
      [2.0, 3.0, 2.0],
    ],
  },

  spatial: {
    LEFT_ZONE_RATIO: 1 / 3,
    RIGHT_ZONE_RATIO: 2 / 3,

    ROI_X_OFFSET: 0.25,
    ROI_Y_OFFSET: 0.4,
    ROI_WIDTH: 0.5,
    ROI_HEIGHT: 0.5,

    MAX_DEPTH_WEIGHT: 0.7,
    AVG_DEPTH_WEIGHT: 0.3,

    DEPTH_LVL_0_5M: 200,
    DEPTH_LVL_1M: 150,
    DEPTH_LVL_2M: 100,
    DEPTH_LVL_3M: 60,
    DEPTH_LVL_5M: 30,
  },

  motion: {
    UPDATE_INTERVAL_MS: 100,
    GRAVITY_CONSTANT: 9.81,
    SHAKE_FORCE_THRESHOLD: 4.5,
    SHAKE_DURATION_TRIGGER: 3000,
    WARN_COOLDOWN_MS: 10000,
  },

  voice: {
    SILENCE_TIMEOUT_MS: 1500,
    POST_COMMAND_COOLDOWN_MS: 3500,
    MIN_COMMAND_LENGTH: 2,
    WAKE_LOCK_MS: 5000,
  },

  intent: {
    NGRAM_MAX_WORDS: 3,
    OBJECT_FUSE_THRESH: 0.45,
    MIN_CHAR_MATCH: 2,
    SINGLE_WORD_SCORE: 0.15,
    MULTI_WORD_SCORE: 0.35,
    EARLY_EXIT_SCORE: 0.25,
  },

  feedback: {
    TTS_RATE: 0.65,
    DEFAULT_LANGUAGE: 'vi-VN',
    HEARTBEAT_TIMEOUT_MS: 6000,
    HEARTBEAT_TICK_MS: 1000,
    HEARTBEAT_VIBE_DURATION: 40,

    PRIORITY_IDLE: 99,
    PRIORITY_DEFAULT: 3,
    PRIORITY_INTERRUPT: 1,

    HAPTIC_WAKE_UP: 100,
    HAPTIC_SUCCESS: [0, 100, 100, 100],
    HAPTIC_ERROR: 500,
  },
};

export const FIXED_CONFIG = {
  YOLO_SIZE: 320,
  MIDAS_SIZE: 256,
};

export function createBmpBase64(
  pixels,
  width,
  height,
  format,
  boxes = [],
  labelsVi = null,
) {
  'worklet';
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const dataSize = rowSize * height;
  const fileSize = 54 + dataSize;
  const buffer = new Uint8Array(fileSize);

  buffer[0] = 0x42;
  buffer[1] = 0x4d;
  buffer[2] = fileSize & 0xff;
  buffer[3] = (fileSize >> 8) & 0xff;
  buffer[4] = (fileSize >> 16) & 0xff;
  buffer[5] = (fileSize >> 24) & 0xff;
  buffer[10] = 54;
  buffer[14] = 40;
  buffer[18] = width & 0xff;
  buffer[19] = (width >> 8) & 0xff;

  const h = -height;
  buffer[22] = h & 0xff;
  buffer[23] = (h >> 8) & 0xff;
  buffer[24] = (h >> 16) & 0xff;
  buffer[25] = (h >> 24) & 0xff;
  buffer[26] = 1;
  buffer[28] = 24;

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
        r = pixels[srcIdx];
        g = pixels[srcIdx + 1];
        b = pixels[srcIdx + 2];
      }
      buffer[p] = b;
      buffer[p + 1] = g;
      buffer[p + 2] = r;
      p += 3;
    }
    p += rowSize - width * 3;
  }

  if (boxes && boxes.length > 0) {
    const thickness = 2;
    const colorB = 0,
      colorG = 255,
      colorR = 0;

    const FONT = {
      A: [2, 5, 7, 5, 5],
      B: [6, 5, 6, 5, 6],
      C: [3, 4, 4, 4, 3],
      D: [6, 5, 5, 5, 6],
      E: [7, 4, 6, 4, 7],
      F: [7, 4, 6, 4, 4],
      G: [3, 4, 5, 5, 3],
      H: [5, 5, 7, 5, 5],
      I: [7, 2, 2, 2, 7],
      J: [1, 1, 1, 5, 2],
      K: [5, 6, 4, 6, 5],
      L: [4, 4, 4, 4, 7],
      M: [5, 7, 5, 5, 5],
      N: [5, 6, 5, 3, 5],
      O: [2, 5, 5, 5, 2],
      P: [6, 5, 6, 4, 4],
      Q: [2, 5, 5, 6, 3],
      R: [6, 5, 6, 5, 5],
      S: [3, 4, 2, 1, 6],
      T: [7, 2, 2, 2, 2],
      U: [5, 5, 5, 5, 3],
      V: [5, 5, 5, 5, 2],
      W: [5, 5, 5, 7, 5],
      X: [5, 5, 2, 5, 5],
      Y: [5, 5, 2, 2, 2],
      Z: [7, 1, 2, 4, 7],
      0: [2, 5, 5, 5, 2],
      1: [2, 6, 2, 2, 7],
      2: [6, 1, 2, 4, 7],
      3: [6, 1, 2, 1, 6],
      4: [5, 5, 7, 1, 1],
      5: [7, 4, 6, 1, 6],
      6: [3, 4, 6, 5, 2],
      7: [7, 1, 2, 2, 2],
      8: [2, 5, 2, 5, 2],
      9: [2, 5, 3, 1, 6],
      '.': [0, 0, 0, 0, 2],
      '%': [5, 1, 2, 4, 5],
      ' ': [0, 0, 0, 0, 0],
      '-': [0, 0, 7, 0, 0],
      ':': [0, 2, 0, 2, 0],
      '[': [6, 4, 4, 4, 6],
      ']': [3, 1, 1, 1, 3],
    };

    const removeAccents = str => {
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
                if (
                  finalX >= 0 &&
                  finalX < width &&
                  finalY >= 0 &&
                  finalY < height
                ) {
                  const idx = 54 + finalY * rowSize + finalX * 3;
                  buffer[idx] = 255;
                  buffer[idx + 1] = 255;
                  buffer[idx + 2] = 255;
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
            buffer[idx] = 0;
            buffer[idx + 1] = 80;
            buffer[idx + 2] = 0;
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
        const topY = by + t;
        const botY = by + bh - 1 - t;
        const leftX = bx + t;
        const rightX = bx + bw - 1 - t;
        for (let x = bx; x < bx + bw; x++) {
          if (x >= 0 && x < width) {
            if (topY >= 0 && topY < height) {
              const idx = 54 + topY * rowSize + x * 3;
              buffer[idx] = colorB;
              buffer[idx + 1] = colorG;
              buffer[idx + 2] = colorR;
            }
            if (botY >= 0 && botY < height) {
              const idx = 54 + botY * rowSize + x * 3;
              buffer[idx] = colorB;
              buffer[idx + 1] = colorG;
              buffer[idx + 2] = colorR;
            }
          }
        }
        for (let y = by; y < by + bh; y++) {
          if (y >= 0 && y < height) {
            if (leftX >= 0 && leftX < width) {
              const idx = 54 + y * rowSize + leftX * 3;
              buffer[idx] = colorB;
              buffer[idx + 1] = colorG;
              buffer[idx + 2] = colorR;
            }
            if (rightX >= 0 && rightX < width) {
              const idx = 54 + y * rowSize + rightX * 3;
              buffer[idx] = colorB;
              buffer[idx + 1] = colorG;
              buffer[idx + 2] = colorR;
            }
          }
        }
      }

      if (labelsVi) {
        let labelName = 'ID ' + box.labelIdx;
        if (labelsVi[box.labelIdx]) {
          labelName = labelsVi[box.labelIdx];
        }
        const scoreStr = Math.round(box.score * 100) + '%';
        const textStr =
          '[' + box.labelIdx + '] ' + removeAccents(labelName) + ' ' + scoreStr;

        const textScale = 2;
        const textH = 5 * textScale + 4;
        let textY = by - textH;
        if (textY < 0) textY = by;

        drawText(textStr, Math.max(0, bx), textY, textScale);
      }
    }
  }

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  for (let i = 0; i < fileSize; i += 3) {
    const b1 = buffer[i];
    const b2 = i + 1 < fileSize ? buffer[i + 1] : 0;
    const b3 = i + 2 < fileSize ? buffer[i + 2] : 0;
    b64 += chars[b1 >> 2];
    b64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    b64 += i + 1 < fileSize ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    b64 += i + 2 < fileSize ? chars[b3 & 63] : '=';
  }
  return 'data:image/bmp;base64,' + b64;
}
