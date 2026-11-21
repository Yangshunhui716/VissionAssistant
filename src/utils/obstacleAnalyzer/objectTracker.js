import {
  calculateIoU,
  calculateDIoU,
  getBoxCenters,
} from '../spatialProcessor/geometryUtils';

/**
 * Dự báo vị trí hộp bao ở khung hình hiện tại theo mô hình vận tốc không đổi (Constant Velocity Model - CVM)
 * Kế thừa nguyên lý từ SORT (Bewley et al., IEEE ICIP 2016).
 *
 * @param {object} tr - Đối tượng track hiện tại
 * @param {number} now - Dấu thời gian hiện tại (ms)
 * @returns {object} - Hộp bao dự báo (predicted bounding box)
 */
export const predictTrackPosition = (tr, now) => {
  'worklet';

  const dt = tr.lastTimestamp ? Math.max(0, now - tr.lastTimestamp) : 0;

  // Dự báo vị trí nếu có vận tốc hợp lệ và khoảng thời gian khả dĩ (dưới 1500ms)
  if (dt > 0 && dt <= 1500 && (tr.vx !== undefined || tr.vy !== undefined)) {
    const vx = tr.vx || 0;
    const vy = tr.vy || 0;

    const currCx = tr.cx ?? (tr.x + tr.width / 2);
    const currCy = tr.cy ?? (tr.y + tr.height / 2);

    const predCx = currCx + vx * dt;
    const predCy = currCy + vy * dt;

    return {
      x: predCx - tr.width / 2,
      y: predCy - tr.height / 2,
      width: tr.width,
      height: tr.height,
      cx: predCx,
      cy: predCy,
    };
  }

  // Fallback về vị trí hiện tại nếu chưa có dữ liệu vận tốc
  return {
    x: tr.x,
    y: tr.y,
    width: tr.width,
    height: tr.height,
    cx: tr.cx ?? (tr.x + tr.width / 2),
    cy: tr.cy ?? (tr.y + tr.height / 2),
  };
};

const pushHistory = (tr, historyLen) => {
  'worklet';

  tr.history.push({
    area: tr.width * tr.height,
    cx: getBoxCenters(tr).cx,
  });

  if (tr.history.length > historyLen) {
    tr.history.shift();
  }
};

const computeMotion = (tr, yoloBounds, obstacleConfig) => {
  'worklet';

  if (tr.history.length < obstacleConfig.MIN_MOTION_FRAMES) {
    return 'Trạng thái tĩnh';
  }

  const first = tr.history[0];
  const last = tr.history[tr.history.length - 1];

  const growthRatio = obstacleConfig.GROWTH_RATIO || 1.25;
  const shrinkRatio = obstacleConfig.SHRINK_RATIO || 0.8;

  if (first.area > 0) {
    const areaRatio = last.area / first.area;
    if (areaRatio > growthRatio) {
      return 'Đang tiến lại gần !';
    }
    if (areaRatio < shrinkRatio) {
      return 'Đang lùi xa';
    }
  }

  const moveX = last.cx - first.cx;

  const dynamicCrossMove = yoloBounds.newW * obstacleConfig.CROSS_MOVE_RATIO;

  if (Math.abs(moveX) > dynamicCrossMove) {
    return moveX > 0 ? 'Cắt ngang sang phải' : 'Cắt ngang sang trái';
  }

  return 'Trạng thái tĩnh';
};

export const updateTracks = (
  detections,
  now,
  whitelist,
  yoloBounds,
  obstacleConfig,
) => {
  'worklet';

  if (
    !globalThis.__tracks ||
    now - (globalThis.__tracksTime || 0) > obstacleConfig.STALE_MS
  ) {
    globalThis.__tracks = [];
    globalThis.__trackSeq = 0;
  }

  globalThis.__tracksTime = now;

  const tracks = globalThis.__tracks;
  const frameArea = yoloBounds.newW * yoloBounds.newH;

  // Bước 1: Dự báo vị trí cho toàn bộ tracks hiện có theo mô hình CVM (SORT Prediction Step)
  const predictedBoxes = new Array(tracks.length);
  for (let t = 0; t < tracks.length; t++) {
    predictedBoxes[t] = predictTrackPosition(tracks[t], now);
  }

  // Bước 2: Ghép cặp đối sánh Distance-IoU (DIoU - AAAI 2020) giữa Hộp Bao Dự Báo và Detections mới
  const diouThreshold =
    obstacleConfig.DIOU_MATCH !== undefined
      ? obstacleConfig.DIOU_MATCH
      : -0.1;

  const pairs = [];
  for (let t = 0; t < tracks.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      if (tracks[t].labelIdx !== detections[d].labelIdx) {
        continue;
      }
      const s = calculateDIoU(predictedBoxes[t], detections[d]);
      if (s >= diouThreshold) {
        pairs.push({ t, d, s });
      }
    }
  }

  pairs.sort((a, b) => b.s - a.s);
  const usedTrack = new Array(tracks.length).fill(false);
  const usedDet = new Array(detections.length).fill(false);

  // Bước 3: Cập nhật vị trí & Làm mượt vector vận tốc EMA cho các cặp ghép thành công
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];

    if (usedTrack[p.t] || usedDet[p.d]) {
      continue;
    }

    usedTrack[p.t] = true;
    usedDet[p.d] = true;

    const tr = tracks[p.t];
    const det = detections[p.d];

    const prevCx = tr.cx ?? (tr.x + tr.width / 2);
    const prevCy = tr.cy ?? (tr.y + tr.height / 2);
    const currCx = det.x + det.width / 2;
    const currCy = det.y + det.height / 2;
    const dt = tr.lastTimestamp ? Math.max(1, now - tr.lastTimestamp) : 0;

    // Tính vận tốc tuyến tính tức thời (pixel/ms) và lọc mượt EMA (alpha = 0.7)
    if (dt > 0 && dt <= 1500) {
      const dX = currCx - prevCx;
      const dY = currCy - prevCy;
      // Motion Deadband: Lọc nhiễu dịch chuyển nhỏ dưới 1.5 pixel do rung tay camera
      const instVx = Math.abs(dX) > 1.5 ? dX / dt : 0;
      const instVy = Math.abs(dY) > 1.5 ? dY / dt : 0;
      const alpha = 0.7; // Trọng số ưu tiên vận tốc mới nhất
      tr.vx =
        tr.vx !== undefined ? alpha * instVx + (1 - alpha) * tr.vx : instVx;
      tr.vy =
        tr.vy !== undefined ? alpha * instVy + (1 - alpha) * tr.vy : instVy;
    } else {
      tr.vx = 0;
      tr.vy = 0;
    }

    tr.x = det.x;
    tr.y = det.y;
    tr.width = det.width;
    tr.height = det.height;
    tr.cx = currCx;
    tr.cy = currCy;
    tr.score = det.score;
    tr.hits += 1;
    tr.misses = 0;
    tr.lastTimestamp = now;

    pushHistory(tr, obstacleConfig.HISTORY_LEN);
  }

  // Bước 4: Tăng số frame bỏ lỡ cho track không ghép cặp được & Track Coasting
  for (let t = tracks.length - 1; t >= 0; t--) {
    if (usedTrack[t]) {
      continue;
    }
    tracks[t].misses += 1;
    if (tracks[t].misses > obstacleConfig.MAX_MISSES) {
      tracks.splice(t, 1);
      continue;
    }

    // Cơ chế Track Coasting: Cập nhật vị trí dự báo CVM khi track đã xác nhận chỉ vừa trượt 1 frame
    if (
      tracks[t].misses === 1 &&
      tracks[t].hits >= obstacleConfig.CONFIRM_HITS
    ) {
      const pred = predictedBoxes[t];
      tracks[t].x = pred.x;
      tracks[t].y = pred.y;
      tracks[t].cx = pred.cx;
      tracks[t].cy = pred.cy;
    }
  }

  // Bước 5: Khởi tạo track mới cho các phát hiện chưa được ghép cặp
  for (let d = 0; d < detections.length; d++) {
    if (usedDet[d]) {
      continue;
    }
    const det = detections[d];
    const currCx = det.x + det.width / 2;
    const currCy = det.y + det.height / 2;

    const tr = {
      id: ++globalThis.__trackSeq,
      labelIdx: det.labelIdx,
      x: det.x,
      y: det.y,
      width: det.width,
      height: det.height,
      cx: currCx,
      cy: currCy,
      vx: 0,
      vy: 0,
      lastTimestamp: now,
      score: det.score,
      hits: 1,
      misses: 0,
      history: [],
      motion: 'Trạng thái tĩnh',
      isEmergency: false,
    };
    pushHistory(tr, obstacleConfig.HISTORY_LEN);
    tracks.push(tr);
  }

  const result = [];

  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i];
    // Cho phép track duy trì kết quả nếu vừa trượt 1 frame (coasting) và đã được xác nhận (hits >= CONFIRM_HITS)
    const isCoasting =
      tr.misses === 1 && tr.hits >= obstacleConfig.CONFIRM_HITS;
    if (tr.misses > 0 && !isCoasting) {
      continue;
    }

    const areaRatio = (tr.width * tr.height) / frameArea;
    const isEmergency = areaRatio > obstacleConfig.EMERGENCY_AREA_RATIO;

    if (whitelist.indexOf(tr.labelIdx) === -1) {
      continue;
    }

    if (tr.hits < obstacleConfig.CONFIRM_HITS && !isEmergency) {
      continue;
    }

    tr.isEmergency = isEmergency;
    tr.motion = computeMotion(tr, yoloBounds, obstacleConfig);

    result.push(tr);
  }

  return result;
};
