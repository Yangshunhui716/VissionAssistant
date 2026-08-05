export function getProminentObject(parsedDetections, cocoLabelsVi) {
  'worklet';
  
  let prominentName = null;
  let maxWeight = 0;
  const FRAME_CENTER = 160;

  for (let i = 0; i < parsedDetections.length; i++) {
    const obj = parsedDetections[i];
    const area = obj.width * obj.height;
    const objCenterX = obj.x + (obj.width / 2);
    const objCenterY = obj.y + (obj.height / 2);

    const distToCenter = Math.sqrt(
      Math.pow(objCenterX - FRAME_CENTER, 2) + Math.pow(objCenterY - FRAME_CENTER, 2)
    );

    const weight = area / (distToCenter + 10); 

    if (weight > maxWeight) {
      maxWeight = weight;
      prominentName = cocoLabelsVi[obj.labelIdx];
    }
  }

  return prominentName;
}