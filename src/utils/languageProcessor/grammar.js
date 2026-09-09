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

const BASE_COMMAND_WORDS = [
  'tìm', 'kiếm', 'quét', 'nhận', 'diện', 'nhìn', 'xem', 'ở', 'đâu', 'có', 'gì', 
  'phía', 'trước', 'mắt', 'xung', 'quanh',
  'cái', 'cho', 'tôi', 'tui', 'giúp', 'mình', 'nhé', 'nha', 'đi', 'chiếc', 'con', 'quả', 'trái',
  'kiểm', 'tra', 'túi', 'tiền', 'tờ', 'này', 'mệnh', 'giá', 'đồng', 
  'chữ', 'văn', 'bản', 'đọc', 'tài', 'liệu', 'trang', 'giấy', 'câu',
  'tắt', 'ngừng', 'dừng', 'hủy', 'bật', 'mở', 'chạy', 'cảnh', 'báo', 'vật', 'cản', 'chướng', 'ngại'
];

const generateGrammar = () => {
  const allSentences = [...BASE_COMMAND_WORDS, ...OBJECT365_LABELS_VI, ...Object.keys(ALIAS_MAP)];
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
