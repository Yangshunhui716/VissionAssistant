export const getDepthFromMidas = (yoloBox, depthMap) => {
  'worklet';

  const centerX = yoloBox.x + (yoloBox.width / 2);
  const centerY = yoloBox.y + (yoloBox.height / 2);

  let midasX = Math.floor((centerX / 320) * 256);
  let midasY = Math.floor((centerY / 320) * 256);

  midasX = Math.min(Math.max(midasX, 0), 255);
  midasY = Math.min(Math.max(midasY, 0), 255);

  let totalDepth = 0;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = midasX + dx;
      const py = midasY + dy;

      if (px >= 0 && px < 256 && py >= 0 && py < 256) {
        const index = (py * 256) + px;
        totalDepth += depthMap[index];
        count++;
      }
    }
  }

  return count > 0 ? (totalDepth / count) : 0;
};