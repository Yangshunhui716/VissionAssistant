export const PROMPTS = {
  system: {
    sleeping: { ui: 'Đang ngủ...\n(Gọi "Xin chào" / "Trợ lý")', tts: 'Tôi đang ngủ! Gọi "Xin chào" hoặc "Trợ lý" để đánh thức', priority: 7 },
    wakingUp: { ui: 'Đã thức! Đang chuẩn bị nghe lệnh...', tts: null, priority: 3 },
    listening: { ui: 'Đang nghe lệnh...', tts: 'Tôi đang nghe lệnh...', priority: 3 },
  },

  obstacle: {
    on: { ui: 'Đã BẬT nhận diện vật cản', tts: 'Đã bật nhận diện vật cản! Hãy gọi tôi dậy nếu cần sử dụng chức năng khác', priority: 7 },
    off: { ui: 'Đã TẮT nhận diện vật cản', tts: 'Đã tắt nhận diện vật cản! Hãy gọi tôi dậy nếu cần sử dụng chức năng', priority: 4 },
    tmpOff: { ui: 'Tạm thời TẮT nhận diện vật cản', tts: 'Tạm thời tắt nhận diện vật cản', priority: 3 },
    threat: message => ({ ui: null, tts: `Chú ý! ${message}`, priority: 1 }),
  },

  find: {
    start: item => ({ ui: `Đang tìm ${item}...`, tts: `Tôi đang tìm ${item}.`, priority: 5 }),
    found: spatialMessage => ({ ui: `Đã tìm thấy ${spatialMessage}`, tts: `Tôi đã thấy ${spatialMessage}`, priority: 6 }),
    notFound: item => ({ ui: `Không tìm thấy ${item}`, tts: `Tôi không thấy ${item} ở quanh đây`, priority: 6 }),
    invalid: { ui: 'Không rõ đồ vật cần tìm', tts: 'Tôi chưa nghe rõ đồ vật cần tìm', priority: 5 },
  },

  scan: {
    start: { ui: 'Đang nhận diện phía trước...', tts: 'Tôi đang nhận diện vật thể phía trước', priority: 5 },
    result: item => ({ ui: `Phía trước có ${item}`, tts: `Phía trước có ${item}`, priority: 6 }),
    empty: { ui: 'Phía trước đang trống', tts: 'Tôi không thấy vật thể nào ở phía trước', priority: 6 },
  },

  currency: {
    start: { ui: 'Đang nhận diện mệnh giá tiền...', tts: 'Tôi đang nhận diện mệnh giá tiền', priority: 5 },
    result: money => ({ ui: `${money}`, tts: `Các mệnh giá hiện đang có là ${money}`, priority: 6 }),
    empty: { ui: 'Không nhận diện được mệnh giá', tts: 'Tôi không nhận diện được mệnh giá tiền', priority: 6 },
  },

  text: {
    start: { ui: 'Đang đọc văn bản phía trước...', tts: 'Tôi đang đọc văn bản phía trước', priority: 5 },
    result: text => ({ ui: `${text}`, tts: `Nội dung văn bản là ${text}`, priority: 6 }),
    empty: { ui: 'Không nhận diện được văn bản', tts: 'Tôi không thấy văn bản nào ở phía trước', priority: 6 },
  },

  error: {
    invalidCommand: { ui: 'Lệnh không hợp lệ', tts: 'Tôi chưa hiểu lệnh này', priority: 4 },
  },

  alert: {
    shaking: { ui: 'Camera rung lắc!', tts: 'Cảnh báo! Camera không ổn định!', priority: 2 },
    frameQuality: reason => ({ ui: `${reason}`, tts: `Cảnh báo! ${reason}`, priority: 2 }),
  },
};