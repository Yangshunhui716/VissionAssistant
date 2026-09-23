import { OBJECT365_LABELS_VI } from '../recognitionProcessor/labels';

export const SYNONYM_MAP = {
  'cái ly': 'cái cốc',
  'cái tách': 'cái cốc',
  'cái ca': 'cái cốc',
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
  'chai nước': 'cái chai',

  'sách tay': 'xách tay',
  'sách tây': 'xách tay',
  'sách tài': 'xách tay',
  'mái tính': 'máy tính',
  'mì vi': 'ti vi',
  'bảng hiểm': 'bàn phím',
  'chày nước': 'chai nước',
  'chai nướng': 'chai nước',
  'dài nước': 'chai nước',
  'cải dài': 'cái chai',
};

export const ALIAS_MAP = {
  'tách': 'tắt',
  'vợt': 'vật',
  'kèn': 'cản',
  'kẻ': 'cản',
  'cảnh': 'cản',
  'dừng diện': 'nhận diện',
  'nhìn diện': 'nhận diện',
  'súp': 'giúp',
  'diếp': 'giúp',
  'dục':'giúp',
  'chứa': 'trước',
  'trượt': 'trước',
  'tiền': 'tìm',
  'xì': 'tìm',
  'vằn': 'văn',
  'bảng': 'bản',
  'bàng': 'bản',
  'đầu': 'đâu',
  'kìm': 'tìm'
}

export const WAKE_GRAMMAR = [
  'xin', 'chào', 'trợ', 'lý', 'chú', 'ý', 'cảnh', 'báo', 
  '[unk]'
];

export const ACTION_WORDS = [
  'quét', 'nhận', 'diện', 'nhìn',
  'xem', 'đọc', 'kiểm', 'tra', 'tắt', 'ngừng',
  'dừng', 'hủy', 'bật', 'mở', 'chạy', 
  'giúp', 'khởi', 'động', 'xác', 'định'
];

export const FUNCTION_KEYWORDS = {
  OBSTACLE: ['cản', 'chướng', 
    'ngại','cảnh','báo'],

  CURRENCY: ['tiền','tệ', 'tờ',
    'mệnh', 'giá', 'đồng'],

  TEXT: ['chữ', 'văn', 'bản',
    'tài', 'liệu', 'trang',
    'giấy', 'câu'],

  GENERAL: ['đồ', 'xung', 'quanh',
    'phía', 'trước'],

  FIND: ['tìm', 'kiếm', 'đâu'],
};

export const COMMON_WORDS = [
  'cho', 'tôi', 'tui', 'giúp', 'mình',
  'nhé', 'nha', 'đi', 'ở', 'này', 'có', 'gì', 'mắt',
]

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
