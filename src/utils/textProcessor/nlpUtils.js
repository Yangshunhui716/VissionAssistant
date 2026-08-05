export function getNGrams(text) {
  const words = text.split(' ').filter(w => w.trim() !== '');
  let nGrams = [];
  for (let i = 0; i < words.length; i++) {
    let chunk = "";
    for (let j = 0; j < 3 && i + j < words.length; j++) {
      chunk += (j > 0 ? " " : "") + words[i + j];
      nGrams.push(chunk);
    }
  }
  return nGrams;
};