/**
 * Bộ tiện ích ghi đo dữ liệu thực nghiệm Benchmark & Xuất CSV Telemetry
 * Thuộc Phase 1 & Phase 2 - Hỗ trợ đo đạc khoa học đối chuẩn trên thiết bị thật
 *
 * Chức năng:
 * 1. recordBenchmarkTelemetry (Worklet): Trích xuất 21 cột metrics từ luồng YOLO/Tracker, lưu trữ và kích hoạt callback khi đủ 100 frames.
 * 2. buildBenchmarkCsv (JS): Chuyển đổi mảng telemetry sang định dạng CSV chuẩn, sanitize chuỗi nhãn phục vụ phân tích Excel / Python.
 */

/**
 * Trích xuất mẫu dữ liệu 21 cột và quản lý chu kỳ đo 100 frames trong Worklet
 */
export const recordBenchmarkTelemetry = (
  trackedObstacles,
  mostDangerousTarget,
  targetName,
  motionState,
  timings,
  scheduleOnRN,
  onBenchmarkProgress,
  onBenchmarkComplete,
) => {
  'worklet';

  if (!globalThis.__benchmarkActive) {
    return;
  }

  if (!globalThis.__benchmarkSamples) {
    globalThis.__benchmarkSamples = [];
  }

  const {
    dtQuality = 0,
    dtPrep = 0,
    opencvMs = 0,
    chwMs = 0,
    dtInfer = 0,
    dtParse = 0,
    dtTrack = 0,
    dtTotal = 0,
  } = timings;

  const numObjects = trackedObstacles ? trackedObstacles.length : 0;
  const trackId = mostDangerousTarget?.id ?? -1;
  const targetLabel = targetName || 'None';
  const score = mostDangerousTarget?.score
    ? Math.round(mostDangerousTarget.score * 1000) / 1000
    : 0;
  const boxX = mostDangerousTarget ? Math.round(mostDangerousTarget.x) : 0;
  const boxY = mostDangerousTarget ? Math.round(mostDangerousTarget.y) : 0;
  const boxW = mostDangerousTarget ? Math.round(mostDangerousTarget.width) : 0;
  const boxH = mostDangerousTarget ? Math.round(mostDangerousTarget.height) : 0;
  const boxX2 = boxX + boxW;
  const boxY2 = boxY + boxH;
  const motion = mostDangerousTarget?.motion || motionState || 'None';

  globalThis.__benchmarkSamples.push({
    frame: globalThis.__benchmarkSamples.length + 1,
    timestamp: Date.now(),
    quality: dtQuality,
    prep: dtPrep,
    opencv: opencvMs,
    chw: chwMs,
    infer: dtInfer,
    parse: dtParse,
    track: dtTrack,
    total: dtTotal,
    numObjects: numObjects,
    trackId: trackId,
    label: targetLabel,
    score: score,
    boxX: boxX,
    boxY: boxY,
    boxW: boxW,
    boxH: boxH,
    boxX2: boxX2,
    boxY2: boxY2,
    motion: motion,
  });

  const currentCount = globalThis.__benchmarkSamples.length;
  if (onBenchmarkProgress && scheduleOnRN) {
    scheduleOnRN(onBenchmarkProgress, currentCount);
  }

  if (currentCount >= 100) {
    globalThis.__benchmarkActive = false;
    const allSamples = globalThis.__benchmarkSamples;
    globalThis.__benchmarkSamples = [];
    if (onBenchmarkComplete && scheduleOnRN) {
      scheduleOnRN(onBenchmarkComplete, JSON.stringify(allSamples));
    }
  }
};

/**
 * Tiêu đề 21 cột chuẩn hóa cho phân tích khoa học
 */
export const BENCHMARK_CSV_HEADERS = [
  'Frame',
  'Timestamp',
  'Quality_ms',
  'Prep_ms',
  'OpenCV_ms',
  'CHW_ms',
  'YOLO_Infer_ms',
  'Parse_ms',
  'Track_ms',
  'Total_ms',
  'Num_Objects',
  'Track_ID',
  'Class_Name',
  'Confidence_Score',
  'BBox_X',
  'BBox_Y',
  'BBox_Width',
  'BBox_Height',
  'BBox_X2',
  'BBox_Y2',
  'Motion_State',
].join(',');

/**
 * Chuyển đổi danh sách mẫu telemetry sang chuỗi file CSV chuẩn hóa
 * @param {Array<Object>} samples Mảng các đối tượng sample đo được
 * @returns {string} Nội dung file CSV hoàn chỉnh
 */
export const buildBenchmarkCsv = samples => {
  const sanitize = val => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = samples.map(s =>
    [
      s.frame,
      s.timestamp,
      s.quality,
      s.prep,
      s.opencv,
      s.chw,
      s.infer,
      s.parse,
      s.track,
      s.total,
      s.numObjects ?? 0,
      s.trackId ?? -1,
      sanitize(s.label ?? 'None'),
      s.score ?? 0,
      s.boxX ?? 0,
      s.boxY ?? 0,
      s.boxW ?? 0,
      s.boxH ?? 0,
      s.boxX2 ?? 0,
      s.boxY2 ?? 0,
      sanitize(s.motion ?? 'None'),
    ].join(','),
  );

  return [BENCHMARK_CSV_HEADERS, ...rows].join('\n');
};
