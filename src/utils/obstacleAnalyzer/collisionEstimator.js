/**
 * Module Ước Lượng Thời Gian Va Chạm (Time-to-Collision - TTC Estimator)
 * Thuộc Phase 2 - Tuần 7 (Task 31)
 *
 * Cơ sở lý thuyết:
 * 1. Định lý Lee's Tau (Lee, 1976 - Perception):
 *    TTC_bbox = sqrt(A_t) / (d(sqrt(A))/dt)
 * 2. Ước lượng vận tốc tiếp cận độ sâu từ MiDaS (Ranftl et al., TPAMI 2022; Dakopoulos & Bourbakis, 2010):
 *    Z_metric ≈ K / rawDepth
 *    v_approach = -dZ/dt = (Z_{t-k} - Z_t) / Δt
 *    TTC_depth = Z_t / v_approach
 */

/**
 * Tính toán Time-to-Collision (TTC) cho một track dựa trên lịch sử BBox và độ sâu
 *
 * @param {object} tr - Đối tượng track (có history, width, height,...)
 * @param {number|null} rawDepth - Độ sâu tương đối hiện tại (từ MiDaS hoặc nội suy)
 * @param {object} obstacleConfig - Cấu hình obstacle
 * @returns {object} { ttc: number|null, vApproachBbox: number, vApproachDepth: number, threatLevel: 'CRITICAL'|'WARNING'|'SAFE' }
 */
export const calculateTTC = (tr, rawDepth = null, obstacleConfig = {}) => {
  'worklet';

  const criticalSec = obstacleConfig.TTC_CRITICAL_SECONDS || 1.5;
  const warningSec = obstacleConfig.TTC_WARNING_SECONDS || 3.0;
  const calibK = obstacleConfig.DEPTH_CALIBRATION_K || 530;

  let ttcBbox = null;
  let ttcDepth = null;
  let vApproachBbox = 0; // pixel^0.5 / s
  let vApproachDepth = 0; // m/s

  const history = tr.history || [];
  const histLen = history.length;

  // 1. Tính toán TTC từ dãn nở quang học Bounding Box (Lee's tau theory)
  if (histLen >= 2) {
    const first = history[0];
    const last = history[histLen - 1];

    const dtMs =
      last.timestamp && first.timestamp
        ? last.timestamp - first.timestamp
        : (histLen - 1) * 350; // Fallback ước tính nếu chưa có timestamp

    if (dtMs >= 150 && first.area > 0 && last.area > 0) {
      const sFirst = Math.sqrt(first.area);
      const sLast = Math.sqrt(last.area);
      const ds = sLast - sFirst;
      const dtSec = dtMs / 1000.0;

      if (ds > 0 && dtSec > 0) {
        vApproachBbox = ds / dtSec; // pixel^0.5 per second
        if (vApproachBbox > 1.0) {
          // Ngưỡng dãn nở tối thiểu để loại trừ rung động tay
          ttcBbox = sLast / vApproachBbox;
        }
      }
    }
  }

  // 2. Tính toán TTC từ độ sâu MiDaS (khi có rawDepth hợp lệ)
  if (rawDepth && rawDepth > 50) {
    const currZ = calibK / Math.max(50, rawDepth); // Mét xấp xỉ

    if (!tr.depthHistory) {
      tr.depthHistory = [];
    }
    const now =
      (history[histLen - 1] && history[histLen - 1].timestamp) || Date.now();
    tr.depthHistory.push({ z: currZ, timestamp: now });
    if (tr.depthHistory.length > 5) {
      tr.depthHistory.shift();
    }

    if (tr.depthHistory.length >= 2) {
      const dFirst = tr.depthHistory[0];
      const dLast = tr.depthHistory[tr.depthHistory.length - 1];
      const dtDepthMs = dLast.timestamp - dFirst.timestamp;

      if (dtDepthMs >= 150) {
        const dZ = dFirst.z - dLast.z; // Nếu z giảm thì dZ > 0 (đang lại gần)
        const dtSec = dtDepthMs / 1000.0;
        if (dZ > 0.05 && dtSec > 0) {
          // Tiến lại gần ít nhất 5cm
          vApproachDepth = dZ / dtSec; // m/s
          if (vApproachDepth > 0.1) {
            ttcDepth = dLast.z / vApproachDepth;
          }
        }
      }
    }
  }

  // 3. Hợp nhất (Fusion) giá trị TTC: Chọn giá trị an toàn nhất (nhỏ nhất)
  let finalTTC = null;
  if (ttcBbox !== null && ttcDepth !== null) {
    finalTTC = Math.min(ttcBbox, ttcDepth);
  } else if (ttcBbox !== null) {
    finalTTC = ttcBbox;
  } else if (ttcDepth !== null) {
    finalTTC = ttcDepth;
  }

  // 4. Phân loại Mức độ đe dọa (Threat Level)
  let threatLevel = 'SAFE';
  if (finalTTC !== null) {
    if (finalTTC <= criticalSec) {
      threatLevel = 'CRITICAL';
    } else if (finalTTC <= warningSec) {
      threatLevel = 'WARNING';
    }
  }

  return {
    ttc: finalTTC !== null ? Math.round(finalTTC * 10) / 10 : null,
    ttcBbox: ttcBbox !== null ? Math.round(ttcBbox * 10) / 10 : null,
    ttcDepth: ttcDepth !== null ? Math.round(ttcDepth * 10) / 10 : null,
    vApproachBbox: Math.round(vApproachBbox * 10) / 10,
    vApproachDepth: Math.round(vApproachDepth * 100) / 100,
    threatLevel,
  };
};
