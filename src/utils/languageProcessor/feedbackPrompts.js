export const PROMPTS = {
  system: {
    sleeping: {
      ui: 'Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)',
      tts: null,
      priority: 3,
    },
    wakingUp: { ui: 'Đã nghe! (Chuẩn bị...)', tts: null, priority: 3 },
    listening: { ui: 'Đang nghe lệnh...', tts: null, priority: 3 },
  },

  search: {
    start: item => ({
      ui: `Đang quét tìm: ${item}...`,
      tts: `Để tôi tìm ${item}.`,
      priority: 3,
    }),
    found: spatialMessage => ({
      ui: `[ĐÃ THẤY] ${spatialMessage}`,
      tts: `Tôi thấy ${spatialMessage}`,
      priority: 3,
    }),
    notFound: item => ({
      ui: `[TRỐNG] Không thấy ${item}`,
      tts: `Tôi không thấy ${item} ở quanh đây.`,
      priority: 3,
    }),
    invalid: {
      ui: 'Không rõ đồ vật cần tìm.',
      tts: 'Tôi chưa hiểu bạn muốn tìm gì.',
      priority: 3,
    },
  },

  scan: {
    start: { ui: 'Đang nhận diện phía trước...', tts: null, priority: 3 },
    result: item => ({
      ui: `Phía trước có: ${item}`,
      tts: `Phía trước có ${item}`,
      priority: 3,
    }),
    empty: {
      ui: 'Phía trước đang trống.',
      tts: 'Không gian phía trước đang trống.',
      priority: 3,
    },
  },

  error: {
    invalidCommand: {
      ui: 'Lệnh không hợp lệ.',
      tts: 'Tôi chưa hiểu lệnh này.',
      priority: 3,
    },
  },

  alert: {
    threat: message => ({
      ui: `⚠️ ${message}`,
      tts: `Chú ý! ${message}`,
      priority: 1,
    }),
    shaking: {
      ui: '⚠️ Camera không ổn định!',
      tts: 'Cảnh báo! Camera không ổn định!',
      priority: 2,
    },
    outFocus: {
      ui: '⚠️ Camera bị che!',
      tts: 'Cảnh báo! Camera bị che!',
      priority: 2,
    },
  },
};