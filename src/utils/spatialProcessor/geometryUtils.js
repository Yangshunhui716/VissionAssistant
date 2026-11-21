export const calculateIoU = (a, b) => {
  'worklet';
  const interX = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const interY = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const intersection = interX * interY;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
};

/**
 * Tính toán chỉ số Distance-IoU (DIoU) giữa 2 bounding box
 * Kế thừa nguyên lý từ Zheng et al. (AAAI 2020) [SRC-11].
 * DIoU = IoU - (rho^2 / c^2)
 *
 * @param {object} a - Bounding box A {x, y, width, height, cx?, cy?}
 * @param {object} b - Bounding box B {x, y, width, height, cx?, cy?}
 * @returns {number} - Giá trị DIoU trong khoảng [-1.0, 1.0]
 */
export const calculateDIoU = (a, b) => {
  'worklet';
  const interX = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const interY = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const intersection = interX * interY;
  const union = a.width * a.height + b.width * b.height - intersection;
  const iou = union > 0 ? intersection / union : 0;

  // Tọa độ tâm của hộp bao A và B
  const cxA = a.cx !== undefined ? a.cx : a.x + a.width / 2;
  const cyA = a.cy !== undefined ? a.cy : a.y + a.height / 2;
  const cxB = b.cx !== undefined ? b.cx : b.x + b.width / 2;
  const cyB = b.cy !== undefined ? b.cy : b.y + b.height / 2;

  // Khoảng cách bình phương Euclidean giữa hai tâm (rho^2)
  const dX = cxA - cxB;
  const dY = cyA - cyB;
  const rho2 = dX * dX + dY * dY;

  // Hộp bao nhỏ nhất chứa cả 2 hộp (Smallest enclosing box C)
  const encX1 = Math.min(a.x, b.x);
  const encY1 = Math.min(a.y, b.y);
  const encX2 = Math.max(a.x + a.width, b.x + b.width);
  const encY2 = Math.max(a.y + a.height, b.y + b.height);

  const encW = encX2 - encX1;
  const encH = encY2 - encY1;
  const c2 = encW * encW + encH * encH;

  if (c2 <= 0) {
    return iou;
  }

  return iou - rho2 / c2;
};

export const getBoxCenters = box => {
  'worklet';
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    bottomY: box.y + box.height,
  };
};