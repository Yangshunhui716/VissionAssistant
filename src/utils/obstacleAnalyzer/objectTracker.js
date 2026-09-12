import { calculateIoU, getBoxCenters } from '../spatialProcessor/geometryUtils';

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

  if (first.area > 0 && last.area / first.area > obstacleConfig.GROWTH_RATIO) {
    return 'Đang tiến lại gần !';
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
  const pairs = [];

  for (let t = 0; t < tracks.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      if (tracks[t].labelIdx !== detections[d].labelIdx) {
        continue;
      }
      const s = calculateIoU(tracks[t], detections[d]);
      if (s >= obstacleConfig.IOU_MATCH) {
        pairs.push({ t, d, s });
      }
    }
  }

  pairs.sort((a, b) => b.s - a.s);
  const usedTrack = new Array(tracks.length).fill(false);
  const usedDet = new Array(detections.length).fill(false);

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];

    if (usedTrack[p.t] || usedDet[p.d]) {
      continue;
    }

    usedTrack[p.t] = true;
    usedDet[p.d] = true;

    const tr = tracks[p.t];
    const det = detections[p.d];

    tr.x = det.x;
    tr.y = det.y;
    tr.width = det.width;
    tr.height = det.height;
    tr.score = det.score;
    tr.hits += 1;
    tr.misses = 0;

    pushHistory(tr, obstacleConfig.HISTORY_LEN);
  }

  for (let t = tracks.length - 1; t >= 0; t--) {
    if (usedTrack[t]) {
      continue;
    }
    tracks[t].misses += 1;
    if (tracks[t].misses > obstacleConfig.MAX_MISSES) {
      tracks.splice(t, 1);
    }
  }

  for (let d = 0; d < detections.length; d++) {
    if (usedDet[d]) {
      continue;
    }
    const det = detections[d];
    const tr = {
      id: ++globalThis.__trackSeq,
      labelIdx: det.labelIdx,
      x: det.x,
      y: det.y,
      width: det.width,
      height: det.height,
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
    if (tr.misses > 0) {
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
