import { calculateIoU, getBoxCenters } from '../spatialProcessor/geometryUtils'

const IOU_MATCH = 0.2;
const CONFIRM_HITS = 2;
const MAX_MISSES = 3;
const HISTORY_LEN = 5;
const STALE_MS = 2000;
const EMERGENCY_AREA_RATIO = 0.15;
const GROWTH_RATIO = 1.15;
const CROSS_MOVE_RATIO = 0.09;
const MIN_MOTION_FRAMES = 2;


const pushHistory = (tr) => {
  'worklet';
  tr.history.push({
    area: tr.width * tr.height,
    cx: getBoxCenters(tr).cx,
  });
  if (tr.history.length > HISTORY_LEN) tr.history.shift();
};

const computeMotion = (tr, yoloSize) => {
  'worklet';
  if (tr.history.length < MIN_MOTION_FRAMES) return 'Tĩnh';

  const first = tr.history[0];
  const last = tr.history[tr.history.length - 1];

  if (first.area > 0 && last.area / first.area > GROWTH_RATIO) {
    return 'Đang tiến lại gần !';
  }

  const moveX = last.cx - first.cx;
  const dynamicCrossMove = yoloSize * CROSS_MOVE_RATIO;
  
  if (Math.abs(moveX) > dynamicCrossMove) {
    return moveX > 0 ? 'Cắt ngang sang phải' : 'Cắt ngang sang trái';
  }

  return 'Tĩnh';
};

export const updateTracks = (detections, now, labelsVi, whitelist, yoloSize) => {
  'worklet';

  if (!globalThis.__tracks || now - (globalThis.__tracksTime || 0) > STALE_MS) {
    globalThis.__tracks = [];
    globalThis.__trackSeq = 0;
  }
  globalThis.__tracksTime = now;

  const tracks = globalThis.__tracks;
  const frameArea = yoloSize * yoloSize;

  const pairs = [];
  for (let t = 0; t < tracks.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      if (tracks[t].labelIdx !== detections[d].labelIdx) continue;
      const s = calculateIoU(tracks[t], detections[d]);
      if (s >= IOU_MATCH) pairs.push({ t: t, d: d, s: s });
    }
  }
  pairs.sort((a, b) => b.s - a.s);

  const usedTrack = new Array(tracks.length).fill(false);
  const usedDet = new Array(detections.length).fill(false);

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (usedTrack[p.t] || usedDet[p.d]) continue;
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
    pushHistory(tr);
  }

  for (let t = tracks.length - 1; t >= 0; t--) {
    if (usedTrack[t]) continue;
    tracks[t].misses += 1;
    if (tracks[t].misses > MAX_MISSES) tracks.splice(t, 1);
  }

  for (let d = 0; d < detections.length; d++) {
    if (usedDet[d]) continue;
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
      motion: 'Tĩnh',
      isEmergency: false,
    };
    pushHistory(tr);
    tracks.push(tr);
  }

  const result = [];
  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i];

    if (tr.misses > 0) continue;

    const areaRatio = (tr.width * tr.height) / frameArea;
    const isEmergency = areaRatio > EMERGENCY_AREA_RATIO;

    if (whitelist.indexOf(tr.labelIdx) === -1) continue;

    if (tr.hits < CONFIRM_HITS && !isEmergency) continue;

    tr.isEmergency = isEmergency;
    tr.motion = computeMotion(tr, yoloSize);
    
    result.push(tr);
  }

  return result;
};