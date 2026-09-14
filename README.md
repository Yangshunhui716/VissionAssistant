# VissionAssistant

VissionAssistant là ứng dụng trợ lý thị giác trên thiết bị di động, được phát triển nhằm hỗ trợ người khiếm thị nhận biết môi trường xung quanh bằng trí tuệ nhân tạo trên thiết bị (Edge AI).

Ứng dụng sử dụng camera, các mô hình AI, nhận dạng giọng nói và phản hồi bằng giọng nói, rung để hỗ trợ người dùng trong quá trình di chuyển và tương tác với môi trường.

## Chức năng chính

- **Nhận diện vật cản:** Phát hiện vật cản phía trước và đưa ra cảnh báo dựa trên vị trí, kích thước, chuyển động và khoảng cách tương đối.
- **Nhận diện đồ vật:** Phát hiện và nhận diện các đối tượng trong môi trường.
- **Tìm kiếm đồ vật:** Tìm kiếm một đồ vật cụ thể theo yêu cầu của người dùng.
- **Nhận diện tiền Việt Nam:** Nhận diện mệnh giá và số lượng tiền Việt Nam.
- **Nhận diện văn bản:** Nhận diện văn bản từ hình ảnh camera và đọc kết quả cho người dùng.
- **Điều khiển bằng giọng nói:** Sử dụng giọng nói để kích hoạt và điều khiển các chức năng.
- **Phản hồi đa phương thức:** Cung cấp thông tin thông qua giọng nói và rung.

## Công nghệ sử dụng

| Công nghệ | Vai trò |
|---|---|
| React Native | Phát triển ứng dụng di động |
| Vision Camera | Thu nhận khung hình camera |
| YOLO26n | Nhận diện vật thể và tiền Việt Nam |
| MiDaS | Ước lượng chiều sâu đơn ảnh |
| LiteRT / TensorFlow Lite | Thực thi mô hình AI trên thiết bị |
| OpenCV | Tiền xử lý hình ảnh |
| Google ML Kit | Nhận diện văn bản |
| VOSK | Nhận dạng giọng nói tiếng Việt |
| React Native TTS | Chuyển văn bản thành giọng nói |
| React Native Sensors | Thu nhận dữ liệu cảm biến |
| Fuse.js | So khớp gần đúng câu lệnh |
| React Native Paper | Xây dựng giao diện |

## Yêu cầu môi trường

- Node.js >= 22.11.0
- React Native 0.86.0
- React 19.2.3
- Android Studio
- Android SDK
- Thiết bị Android hoặc Android Emulator

## Cài đặt

git clone https://github.com/Yangshunhui716/VissionAssistant.git
cd VissionAssistant
npm install

- Khởi động Metro: npm start

- Chạy ứng dụng Android: npm run android



GitHub: https://github.com/Yangshunhui716/VissionAssistant