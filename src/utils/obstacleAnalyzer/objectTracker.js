/**
 * objectTracker.js
 * Thay thế cho: timeVoting.js + motionTracker.js
 *
 * Theo dõi từng VẬT THỂ riêng biệt (instance) thay vì từng LỚP (class).
 * Mỗi track có id, lịch sử riêng, và trạng thái động/tĩnh riêng.
 *
 * Đặt tại: utils/obstacleAnalyzer/objectTracker.js
 */

// ---------------------------------------------------------------------------
// CẤU HÌNH
// ---------------------------------------------------------------------------

/**
 * QUAN TRỌNG: phải khớp với không gian tọa độ mà parseYoloOutput trả về.
 *   - Nếu log ra dạng  110  45   -> giữ nguyên 320
 *   - Nếu log ra dạng  0.34 0.12 -> đổi thành 1
 * Mọi ngưỡng bên dưới đều suy ra từ hằng số này nên chỉ cần sửa 1 chỗ.
 */
export const FRAME_SIZE = 320;

const IOU_MATCH = 0.3;              // IoU tối thiểu để coi là cùng một vật
const CONFIRM_HITS = 2;             // số frame phải thấy liên tiếp mới tin
const MAX_MISSES = 3;               // số frame mất dấu trước khi xoá track
const HISTORY_LEN = 5;              // độ dài lịch sử mỗi track
const STALE_MS = 2000;              // quá lâu không cập nhật -> reset sạch

const EMERGENCY_AREA_RATIO = 0.30;  // vật chiếm >30% khung -> bỏ qua CONFIRM_HITS
const GROWTH_RATIO = 1.15;          // diện tích tăng 15% -> đang tiến lại gần
const CROSS_MOVE = FRAME_SIZE * 0.09; // dịch ngang -> đang cắt ngang

// ---------------------------------------------------------------------------
// HÀM PHỤ
// ---------------------------------------------------------------------------

function iou(a, b) {
  'worklet';
  const interX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const inter = interX * interY;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function pushHistory(tr) {
  'worklet';
  tr.history.push({
    area: tr.width * tr.height,
    cx: tr.x + tr.width / 2,
  });
  if (tr.history.length > HISTORY_LEN) tr.history.shift();
}

function computeMotion(tr) {
  'worklet';
  if (tr.history.length < 3) return 'Tĩnh';

  const first = tr.history[0];
  const last = tr.history[tr.history.length - 1];

  // Ưu tiên "tiến lại gần" vì đây là tín hiệu nguy hiểm nhất
  if (first.area > 0 && last.area / first.area > GROWTH_RATIO) {
    return 'Đang tiến lại gần !';
  }

  const moveX = last.cx - first.cx;
  if (Math.abs(moveX) > CROSS_MOVE) {
    return moveX > 0 ? 'Cắt ngang sang phải' : 'Cắt ngang sang trái';
  }

  return 'Tĩnh';
}

// ---------------------------------------------------------------------------
// HÀM CHÍNH
// ---------------------------------------------------------------------------

/**
 * @param {Array}  detections   kết quả từ parseYoloOutput()
 * @param {number} now          Date.now()
 * @param {Array}  cocoLabelsVi COCO_LABELS_VI
 * @param {Array}  whitelist    OBSTACLE_WHITELIST
 * @returns {Array} các track đã xác nhận, đã lọc whitelist, có sẵn .motion và .id
 */
export function updateTracks(detections, now, cocoLabelsVi, whitelist) {
  'worklet';

  const g = globalThis;

  // Reset nếu camera vừa bị ngắt quãng lâu (tránh so với dữ liệu cũ)
  if (!g.__tracks || now - (g.__tracksTime || 0) > STALE_MS) {
    g.__tracks = [];
    g.__trackSeq = 0;
  }
  g.__tracksTime = now;

  const tracks = g.__tracks;
  const frameArea = FRAME_SIZE * FRAME_SIZE;

  // --- 1. Ghép track cũ với detection mới bằng IoU (greedy, cao trước) -----
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

  // --- 2. Track không ghép được -> tăng misses, xoá nếu quá hạn ------------
  //     (làm TRƯỚC khi thêm track mới để chỉ số usedTrack còn đúng)
  for (let t = tracks.length - 1; t >= 0; t--) {
    if (usedTrack[t]) continue;
    tracks[t].misses += 1;
    if (tracks[t].misses > MAX_MISSES) tracks.splice(t, 1);
  }

  // --- 3. Detection không ghép được -> tạo track mới ----------------------
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

  // --- 4. Lọc ra kết quả trả về -------------------------------------------
  const result = [];
  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i];

    // chỉ trả về vật đang thực sự nhìn thấy ở frame này
    if (tr.misses > 0) continue;

    const areaRatio = (tr.width * tr.height) / frameArea;
    const isEmergency = areaRatio > EMERGENCY_AREA_RATIO;

    // vật cản áp sát thì bỏ qua bộ lọc thời gian
    if (tr.hits < CONFIRM_HITS && !isEmergency) continue;

    const name = cocoLabelsVi[tr.labelIdx];
    if (whitelist.indexOf(name) === -1) continue;

    tr.isEmergency = isEmergency;
    tr.motion = computeMotion(tr);
    result.push(tr);
  }

  return result;
}