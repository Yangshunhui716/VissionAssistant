export const AI_PROMPTS = {
  system: {
    sleeping: { ui: 'Đang ngủ... (Gọi "Vi sần" hoặc Chạm giữ)', tts: null, priority: 3 },
    wakingUp: { ui: 'Đã nghe! (Chuẩn bị...)', tts: null, priority: 3 },
    listening: { ui: 'Đang nghe lệnh...', tts: null, priority: 3 },
  },
  
  search: {
    start: (item) => ({ ui: `Đang quét tìm: ${item}...`, tts: `Để tôi tìm ${item}.`, priority: 2 }),
    found: (spatialMessage) => ({ ui: `[ĐÃ THẤY] ${spatialMessage}`, tts: `Tôi thấy ${spatialMessage}`, priority: 2 }),
    notFound: (item) => ({ ui: `[TRỐNG] Không thấy ${item}`, tts: `Tôi không thấy ${item} ở quanh đây.`, priority: 2 }),
    invalid: { ui: "Không rõ đồ vật cần tìm.", tts: "Tôi chưa hiểu bạn muốn tìm gì.", priority: 2 }
  },
  
  scan: {
    start: { ui: "Đang nhận diện phía trước...", tts: null, priority: 2 },
    result: (item) => ({ ui: `Phía trước có: ${item}`, tts: `Phía trước có ${item}`, priority: 2 }),
    empty: { ui: "Phía trước đang trống.", tts: "Không gian phía trước đang trống.", priority: 2 }
  },
  
  error: {
    invalidCommand: { ui: "Lệnh không hợp lệ.", tts: "Tôi chưa hiểu lệnh này.", priority: 2 }
  },

  threat: {
    alert: (message) => ({ ui: `⚠️ ${message}`, tts: `Chú ý, ${message}`, priority: 1 })
  }
};