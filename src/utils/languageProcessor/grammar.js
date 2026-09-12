import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';

export const ALIAS_MAP = {
  'cái ly': 'cái cốc',
  'cái tách': 'cái cốc',
  'cái chén': 'cái bát',
  'cái muỗng': 'cái thìa',
  'cái dĩa': 'cái đĩa',
  'kiếng': 'kính',
  'cái nón': 'cái mũ',
  'nón bảo hiểm': 'mũ bảo hiểm',
  'giỏ xách': 'túi xách',
  'cây dù': 'cái ô',
  'xe gắn máy': 'xe máy',
  'xe honda': 'xe máy',
  'xe hơi': 'xe ô tô',
  'bốn bánh': 'xe ô tô',
  'trái banh': 'quả bóng',
  'trái táo': 'quả táo',
  'trái cam': 'quả cam',
  'trái chuối': 'quả chuối',
  'trái chanh': 'quả chanh',
  'sọt rác': 'thùng rác',
  'điều hòa': 'máy lạnh',
  'ghế salon': 'ghế sô pha',
  'con heo': 'con lợn',
  'tiền giấy': 'tiền',
  'tiền cắc': 'tiền',
};

export const WAKE_GRAMMAR = [
  'xin', 'chào', 'trợ', 'lý', '[unk]'
];

export const ACTION_WORDS = [
  'quét', 'nhận', 'diện', 'nhìn',
  'xem', 'đọc', 'kiểm', 'tra', 'tắt', 'ngừng',
  'dừng', 'hủy', 'bật', 'mở', 'chạy', 'có',
  'giúp', 'khởi', 'động'
];

export const FUNCTION_KEYWORDS = {
  OBSTACLE: ['vật', 'cản', 'chướng', 
    'ngại','cảnh','báo'],

  CURRENCY: ['tiền', 'tờ',
    'mệnh', 'giá', 'đồng'],

  TEXT: ['chữ', 'văn', 'bản',
    'tài', 'liệu', 'trang',
    'giấy', 'câu'],

  GENERAL: ['xung', 'quanh',
    'phía', 'trước'],

  FIND: ['tìm', 'kiếm', 'đâu'],
};

export const COMMON_WORDS = [
  'cái', 'cho', 'tôi', 'tui', 'giúp', 'mình',
  'nhé', 'nha', 'đi', 'chiếc', 'con', 'quả',
  'trái', 'ở', 'này', 'gì', 'mắt','túi'
];

export const TARGET_STOP_WORDS = [
  ...ACTION_WORDS,
  ...COMMON_WORDS,
  ...FUNCTION_KEYWORDS.OBSTACLE,
  ...FUNCTION_KEYWORDS.CURRENCY,
  ...FUNCTION_KEYWORDS.TEXT,
  ...FUNCTION_KEYWORDS.GENERAL,
  ...FUNCTION_KEYWORDS.FIND,
];

const generateGrammar = () => {
  const allSentences = [ 
    ...ACTION_WORDS,
    ...COMMON_WORDS,
    ...FUNCTION_KEYWORDS.OBSTACLE,
    ...FUNCTION_KEYWORDS.CURRENCY,
    ...FUNCTION_KEYWORDS.TEXT,
    ...FUNCTION_KEYWORDS.GENERAL,
    ...FUNCTION_KEYWORDS.FIND,
    ...OBJECT365_LABELS_VI,
    ...Object.keys(ALIAS_MAP),
    ...Object.values(ALIAS_MAP)
  ];

  const uniqueWords = new Set();

  allSentences.forEach(sentence => {
    const words = sentence.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(
        /[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g,
        '',
      );
      if (cleanWord !== '') {
        uniqueWords.add(cleanWord);
      }
    });
  });

  const grammarArray = Array.from(uniqueWords);
  grammarArray.push('[unk]');

  return grammarArray;
};

export const COMMAND_GRAMMAR = generateGrammar();
