// import lvisJson from './lvis_labels.json';
// import lvisJsonVi from './lvis_labels_vi.json';

// export const COCO_LABELS = [];
// export const COCO_LABELS_VI = [];

// for (let i = 0; i <= 4584; i++) {
//   COCO_LABELS.push(lvisJson[i.toString()]);
// }

// for (let i = 0; i <= 4584; i++) {
//   COCO_LABELS_VI.push(lvisJsonVi[i.toString()]);
// } 

export const COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

export const COCO_LABELS_VI = [
  'người', 'xe đạp', 'xe ô tô', 'xe máy', 'máy bay', 'xe buýt', 'tàu hỏa', 'xe tải', 'tàu thuyền', 'đèn giao thông',
  'trụ cứu hỏa', 'biển báo dừng', 'cột thu phí đỗ xe', 'băng ghế dài', 'con chim', 'con mèo', 'con chó', 'con ngựa', 'con cừu', 'con bò',
  'con voi', 'con gấu', 'ngựa vằn', 'hươu cao cổ', 'ba lô', 'cây dù', 'túi xách', 'cà vạt', 'vali', 'đĩa ném',
  'ván trượt tuyết đôi', 'tấm trượt tuyết', 'quả bóng', 'con diều', 'gậy bóng chày', 'găng tay bóng chày', 'ván trượt', 'ván lướt sóng',
  'vợt tennis', 'chai nước', 'ly thủy tinh', 'cái cốc', 'cái nĩa', 'con dao', 'cái thìa', 'cái bát', 'quả chuối', 'quả táo',
  'bánh mì kẹp', 'quả cam', 'súp lơ xanh', 'củ cà rốt', 'bánh mì xúc xích', 'bánh pizza', 'bánh donut', 'bánh ngọt', 'cái ghế', 'ghế sofa',
  'chậu cây', 'cái giường', 'bàn ăn', 'bồn cầu', 'tivi', 'laptop', 'chuột máy tính', 'cái điều khiển', 'bàn phím', 'điện thoại',
  'lò vi sóng', 'lò nướng', 'máy nướng bánh mì', 'bồn rửa', 'tủ lạnh', 'quyển sách', 'đồng hồ', 'lọ hoa', 'cái kéo', 'gấu bông',
  'máy sấy tóc', 'bàn chải đánh răng'
];

export const OBSTACLE_WHITELIST =
[
  'người', 'xe đạp', 'xe ô tô', 'xe máy', 'xe buýt', 'xe tải',
  'trụ cứu hỏa', 'biển báo dừng', 'cột thu phí đỗ xe', 'băng ghế dài', 'cây dù',
  'con chó', 'con bò', 
  'cái ghế', 'ghế sofa', 'chậu cây', 'cái giường', 'bàn ăn', 'bồn cầu', 'tivi', 'tủ lạnh', 'lò nướng'
];