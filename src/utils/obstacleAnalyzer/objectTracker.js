const FRAME_SIZE = 640;
const IOU_MATCH = 0.3;
const CONFIRM_HITS = 2;
const MAX_MISSES = 3;
const HISTORY_LEN = 5;
const STALE_MS = 2000;
const EMERGENCY_AREA_RATIO = 0.30;
const GROWTH_RATIO = 1.15;
const CROSS_MOVE = FRAME_SIZE * 0.09;

const iou = (a, b) => {
  'worklet';
  const interX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const inter = interX * interY;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
};

const pushHistory = (tr) => {
  'worklet';
  tr.history.push({
    area: tr.width * tr.height,
    cx: tr.x + tr.width / 2,
  });
  if (tr.history.length > HISTORY_LEN) tr.history.shift();
};

const computeMotion = (tr) => {
  'worklet';
  if (tr.history.length < 3) return 'Tĩnh';

  const first = tr.history[0];
  const last = tr.history[tr.history.length - 1];

  if (first.area > 0 && last.area / first.area > GROWTH_RATIO) {
    return 'Đang tiến lại gần !';
  }

  const moveX = last.cx - first.cx;
  if (Math.abs(moveX) > CROSS_MOVE) {
    return moveX > 0 ? 'Cắt ngang sang phải' : 'Cắt ngang sang trái';
  }

  return 'Tĩnh';
};

export const updateTracks = (detections, now, cocoLabelsVi, whitelist) => {
  'worklet';

  const g = globalThis;

  if (!g.__tracks || now - (g.__tracksTime || 0) > STALE_MS) {
    g.__tracks = [];
    g.__trackSeq = 0;
  }
  g.__tracksTime = now;

  const tracks = g.__tracks;
  const frameArea = FRAME_SIZE * FRAME_SIZE;

  const pairs = [];
  for (let t = 0; t < tracks.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      if (tracks[t].labelIdx !== detections[d].labelIdx) continue;
      const s = iou(tracks[t], detections[d]);
      if (s >= IOU_MATCH) pairs.push({ t: t, d: d, s: s });
    }
  }
  pairs.sort((a, b) => b.s - a.s);

  const usedTrack = {};
  const usedDet = {};

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
      id: ++g.__trackSeq,
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
    const name = cocoLabelsVi[tr.labelIdx];

    if (whitelist.indexOf(name) === -1) continue;

    if (tr.hits < CONFIRM_HITS && !isEmergency) continue;

    tr.isEmergency = isEmergency;
    tr.motion = computeMotion(tr);
    
    result.push(tr);
  }

  return result;
};