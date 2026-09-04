export const PROMPTS = {
  system: {
    sleeping: { ui: 'Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)', tts: null, priority: 3 },
    wakingUp: { ui: 'Đã nghe! (Chuẩn bị...)', tts: null, priority: 3 },
    listening: { ui: 'Đang nghe lệnh...', tts: null, priority: 3 },
  },

  obstacle: {
    on: { ui: 'Đã BẬT dò đường.', tts: 'Đã bật chế độ dò đường.', priority: 3 },
    off: { ui: 'Đã TẮT dò đường.', tts: 'Đã tắt chế độ dò đường. Hệ thống đang nghỉ ngơi.', priority: 3 },
  },

  search: {
    start: item => ({ ui: `Đang tìm: ${item}...`, tts: `Để tôi tìm ${item}.`, priority: 3 }),
    found: spatialMessage => ({ ui: `[ĐÃ THẤY] ${spatialMessage}`, tts: `Tôi thấy ${spatialMessage}`, priority: 3 }),
    notFound: item => ({ ui: `[TRỐNG] Không thấy ${item}`, tts: `Tôi không thấy ${item} ở quanh đây.`, priority: 3 }),
    invalid: { ui: 'Không rõ đồ vật.', tts: 'Tôi chưa hiểu bạn muốn tìm gì.', priority: 3 },
  },

  scan: {
    start: { ui: 'Đang nhận diện phía trước...', tts: null, priority: 3 },
    result: item => ({ ui: `Phía trước có: ${item}`, tts: `Phía trước có ${item}`, priority: 3 }),
    empty: { ui: 'Phía trước đang trống.', tts: 'Không gian phía trước đang trống.', priority: 3 },
  },

  currency: {
    start: { ui: 'Đang quét tiền...', tts: 'Đang mở nhận diện tiền tệ.', priority: 3 },
    result: money => ({ ui: `Phát hiện: ${money}`, tts: `Phát hiện ${money}`, priority: 3 }),
    empty: { ui: 'Không rõ mệnh giá.', tts: 'Không nhận diện được mệnh giá tiền.', priority: 3 },
  },

  text: {
    start: { ui: 'Đang quét chữ...', tts: 'Đang mở chế độ đọc văn bản.', priority: 3 },
    result: text => ({ ui: `Văn bản: ${text}`, tts: `Nội dung là: ${text}`, priority: 3 }),
    empty: { ui: 'Không thấy chữ.', tts: 'Không phát hiện thấy văn bản.', priority: 3 },
  },

  error: {
    invalidCommand: { ui: 'Lệnh không hợp lệ.', tts: 'Tôi chưa hiểu lệnh này.', priority: 3 },
  },

  alert: {
    threat: message => ({ ui: `${message}`, tts: `Chú ý! ${message}`, priority: 1 }),
    shaking: { ui: 'Camera rung lắc!', tts: 'Cảnh báo! Camera không ổn định!', priority: 2 },
    frameQuality: reason => ({ ui: `${reason}`, tts: `Cảnh báo! ${reason}`, priority: 2 }),
  },
};