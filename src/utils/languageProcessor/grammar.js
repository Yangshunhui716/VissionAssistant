import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';

export const ALIAS_MAP = {
  "ly": "cái cốc",
  "tách": "cái cốc",
  "chén": "cái bát",
  "muỗng": "cái thìa",
  "trái banh": "quả bóng",
  "cái ô": "cây dù",
  "xe gắn máy": "xe máy",
  "xe honda": "xe máy",
  "xe hơi": "xe ô tô",
  "bốn bánh": "xe ô tô"
};

export const WAKE_GRAMMAR = [
  "xin", "chào", "trợ", "lý", "ơi", "cảnh", "báo", "chú", "ý", "[unk]"
];

const BASE_COMMAND_WORDS = [
  "tìm", "kiếm", "quét", "nhận", "diện", "nhìn", "ở", "đâu", "có", "gì", "phía", "trước",
  "mắt","cái", "cho", "tôi", "tui", "giúp", "mình", "nhé", "nha", "đi", "chiếc",
  "con", "quả", "kiểm", "tra", "túi", "tiền", "tờ", "mệnh", "giá", "chữ", 
  "văn", "bản", "đọc", "tắt", "ngừng", "bật", "mở", "cảnh", "báo", "vật", "cản"
];

const generateGrammar = () => {
  const allSentences = [
    ...BASE_COMMAND_WORDS,
    ...OBJECT365_LABELS_VI,
  ];
  const uniqueWords = new Set();

  allSentences.forEach(sentence => {
    const words = sentence.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
      if (cleanWord !== '') {
        uniqueWords.add(cleanWord);
      }
    });
  });

  const grammarArray = Array.from(uniqueWords);
  grammarArray.push("[unk]");

  return grammarArray;
};

export const COMMAND_GRAMMAR = generateGrammar();