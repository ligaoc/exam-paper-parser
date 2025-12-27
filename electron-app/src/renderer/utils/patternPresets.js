/**
 * 模式预设库
 * 提供用户友好的预设模式，用于替代直接输入正则表达式
 */

/**
 * 题号模式预设（通用，不绑定特定级别）
 */
const questionPresets = [
  {
    id: 'chinese_dun',
    label: '中文数字+顿号',
    regex: '^[一二三四五六七八九十百]+[、]',
    examples: ['一、', '二、', '三、', '十、', '十一、'],
    category: 'question'
  },
  {
    id: 'chinese_dot',
    label: '中文数字+点号',
    regex: '^[一二三四五六七八九十百]+[．.]',
    examples: ['一．', '二．', '三.', '十．'],
    category: 'question'
  },
  {
    id: 'arabic_dun',
    label: '阿拉伯数字+顿号',
    regex: '^\\d+[、]',
    examples: ['1、', '2、', '3、', '10、'],
    category: 'question'
  },
  {
    id: 'arabic_dot',
    label: '阿拉伯数字+点号',
    regex: '^\\d+[.．]',
    examples: ['1.', '2.', '3．', '10.'],
    category: 'question'
  },
  {
    id: 'arabic_paren_half',
    label: '阿拉伯数字+半角括号',
    regex: '^[(]\\d+[)]',
    examples: ['(1)', '(2)', '(3)', '(10)'],
    category: 'question'
  },
  {
    id: 'arabic_paren_full',
    label: '阿拉伯数字+全角括号',
    regex: '^[（]\\d+[）]',
    examples: ['（1）', '（2）', '（3）', '（10）'],
    category: 'question'
  },
  {
    id: 'circle_number',
    label: '圈数字',
    regex: '^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]',
    examples: ['①', '②', '③', '④', '⑤'],
    category: 'question'
  },
  {
    id: 'letter_dot',
    label: '小写字母+点号',
    regex: '^[a-z][.．]',
    examples: ['a.', 'b.', 'c．', 'd.'],
    category: 'question'
  },
  {
    id: 'letter_paren',
    label: '小写字母+括号',
    regex: '^[a-z][)）]',
    examples: ['a)', 'b)', 'c）', 'd)'],
    category: 'question'
  },
  {
    id: 'roman',
    label: '罗马数字',
    regex: '^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+[、．.]*',
    examples: ['Ⅰ、', 'Ⅱ、', 'Ⅲ．', 'Ⅳ'],
    category: 'question'
  },
  {
    id: 'upper_letter_dot',
    label: '大写字母+点号',
    regex: '^[A-Z][.．]',
    examples: ['A.', 'B.', 'C．', 'D.'],
    category: 'question'
  },
  {
    id: 'upper_letter_paren',
    label: '大写字母+括号',
    regex: '^[A-Z][)）]',
    examples: ['A)', 'B)', 'C）', 'D)'],
    category: 'question'
  }
]

/**
 * 分数模式预设
 */
const scorePresets = [
  {
    id: 'score_bracket',
    label: '括号内分数',
    regex: '[（(【\\[]\\s*(\\d+)\\s*分\\s*[)）\\]】]',
    examples: ['(5分)', '（10分）', '[5分]', '【10分】'],
    category: 'score'
  },
  {
    id: 'score_total',
    label: '共X分格式',
    regex: '共\\s*(\\d+)\\s*分',
    examples: ['共5分', '共10分', '共 15 分'],
    category: 'score'
  },
  {
    id: 'score_simple',
    label: '简单分数',
    regex: '(\\d+)\\s*分',
    examples: ['5分', '10分', '15 分'],
    category: 'score'
  },
  {
    id: 'score_each',
    label: '每小题X分',
    regex: '每小题\\s*(\\d+)\\s*分',
    examples: ['每小题2分', '每小题 3 分'],
    category: 'score'
  }
]


/**
 * 括号模式预设
 */
const bracketPresets = [
  {
    id: 'bracket_round',
    label: '圆括号',
    regex: '[（(][^)）]*[)）]',
    examples: ['(答案)', '（内容）', '(A)'],
    category: 'bracket'
  },
  {
    id: 'bracket_square',
    label: '方括号',
    regex: '[【\\[][^\\]】]*[\\]】]',
    examples: ['[答案]', '【内容】', '[A]'],
    category: 'bracket'
  },
  {
    id: 'bracket_curly',
    label: '花括号',
    regex: '\\{[^}]*\\}',
    examples: ['{答案}', '{内容}'],
    category: 'bracket'
  }
]

/**
 * 下划线模式预设
 */
const underlinePresets = [
  {
    id: 'underline_underscore',
    label: '下划线',
    regex: '_{2,}',
    examples: ['____', '________'],
    category: 'underline'
  },
  {
    id: 'underline_dash',
    label: '破折号',
    regex: '—{2,}',
    examples: ['————', '——————'],
    category: 'underline'
  },
  {
    id: 'underline_fullwidth',
    label: '全角下划线',
    regex: '＿{2,}',
    examples: ['＿＿＿＿', '＿＿＿＿＿＿'],
    category: 'underline'
  }
]

/**
 * 忽略模式预设
 * 用于过滤不应被识别为题目的说明性文字
 */
const ignorePresets = [
  {
    id: 'ignore_answer_card',
    label: '答题卡相关说明',
    pattern: '答案.*答题卡',
    type: 'regex',
    examples: ['试题的答案书写在答题卡上', '答案写在答题卡上'],
    category: 'ignore'
  },
  {
    id: 'ignore_no_write_on_paper',
    label: '禁止在试卷作答',
    pattern: '不得在试题卷上.*作答',
    type: 'regex',
    examples: ['不得在试题卷上直接作答', '不得在试题卷上作答'],
    category: 'ignore'
  },
  {
    id: 'ignore_attention',
    label: '注意事项标题',
    pattern: '注意事项',
    type: 'keyword',
    examples: ['注意事项', '注意事项：'],
    category: 'ignore'
  },
  {
    id: 'ignore_read_before',
    label: '作答前阅读提示',
    pattern: '作答前.*阅读',
    type: 'regex',
    examples: ['作答前认真阅读答题卡上的注意事项', '作答前请阅读'],
    category: 'ignore'
  },
  {
    id: 'ignore_exam_end',
    label: '考试结束说明',
    pattern: '考试结束.*监考',
    type: 'regex',
    examples: ['考试结束，由监考人员将试题卷和答题卡一并收回'],
    category: 'ignore'
  },
  {
    id: 'ignore_exam_time',
    label: '考试时间说明',
    pattern: '考试时间.*分钟',
    type: 'regex',
    examples: ['考试时间60分钟', '考试时间90分钟'],
    category: 'ignore'
  },
  {
    id: 'ignore_total_score',
    label: '满分说明',
    pattern: '满分.*分',
    type: 'regex',
    examples: ['满分100分', '满分150分'],
    category: 'ignore'
  },
  {
    id: 'ignore_may_use_calculator',
    label: '计算器使用说明',
    pattern: '可能用到.*相对原子质量',
    type: 'regex',
    examples: ['可能用到的相对原子质量'],
    category: 'ignore'
  },
  {
    id: 'ignore_relative_atomic_mass',
    label: '相对原子质量数据',
    pattern: '^[A-Z][a-z]?[：:=-]\\s*\\d+',
    type: 'regex',
    examples: ['H-1', 'C:12', 'O=16', 'Na：23'],
    category: 'ignore'
  },
  {
    id: 'ignore_answer_sheet_number',
    label: '答题卡填涂提示',
    pattern: '填涂.*答题卡',
    type: 'regex',
    examples: ['请将答案填涂在答题卡上', '用2B铅笔填涂答题卡'],
    category: 'ignore'
  }
]

/**
 * 所有预设的映射表（用于快速查找）
 */
const allPresets = [
  ...questionPresets,
  ...scorePresets,
  ...bracketPresets,
  ...underlinePresets,
  ...ignorePresets
]

/**
 * 正则到预设的映射（用于反向查找）
 */
const regexToPresetMap = new Map()
allPresets.forEach(preset => {
  regexToPresetMap.set(preset.regex, preset)
})

/**
 * 获取题号模式预设
 * @returns {Array} 题号模式预设列表
 */
export function getQuestionPresets() {
  return [...questionPresets]
}

/**
 * 获取分数模式预设
 * @returns {Array} 分数模式预设列表
 */
export function getScorePresets() {
  return [...scorePresets]
}

/**
 * 获取括号模式预设
 * @returns {Array} 括号模式预设列表
 */
export function getBracketPresets() {
  return [...bracketPresets]
}

/**
 * 获取下划线模式预设
 * @returns {Array} 下划线模式预设列表
 */
export function getUnderlinePresets() {
  return [...underlinePresets]
}

/**
 * 获取忽略模式预设
 * @returns {Array} 忽略模式预设列表
 */
export function getIgnorePresets() {
  return [...ignorePresets]
}

/**
 * 根据类别获取预设
 * @param {string} category - 类别: 'question' | 'score' | 'bracket' | 'underline' | 'ignore'
 * @returns {Array} 对应类别的预设列表
 */
export function getPresetsByCategory(category) {
  switch (category) {
    case 'question':
      return getQuestionPresets()
    case 'score':
      return getScorePresets()
    case 'bracket':
      return getBracketPresets()
    case 'underline':
      return getUnderlinePresets()
    case 'ignore':
      return getIgnorePresets()
    default:
      return []
  }
}

/**
 * 根据正则表达式查找预设
 * @param {string} regex - 正则表达式字符串
 * @returns {Object|null} 匹配的预设，未找到返回 null
 */
export function findPresetByRegex(regex) {
  if (!regex || typeof regex !== 'string') {
    return null
  }
  return regexToPresetMap.get(regex) || null
}

/**
 * 验证正则表达式是否有效
 * @param {string} pattern - 正则表达式字符串
 * @returns {boolean} 是否有效
 */
export function validateRegex(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return false
  }
  try {
    new RegExp(pattern)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 获取所有预设
 * @returns {Array} 所有预设列表
 */
export function getAllPresets() {
  return [...allPresets]
}

export default {
  getQuestionPresets,
  getScorePresets,
  getBracketPresets,
  getUnderlinePresets,
  getIgnorePresets,
  getPresetsByCategory,
  findPresetByRegex,
  validateRegex,
  getAllPresets
}
