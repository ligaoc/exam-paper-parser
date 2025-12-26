/**
 * 结构提取服务
 * 从文档文本中提取题号、分数、括号、下划线等结构化信息
 * 支持智能层级识别（基于字号 + 正则匹配）
 * 
 * 核心识别逻辑：
 * 1. 字号是决定级别的主要因素（字号大 = 级别高）
 * 2. 同字号内，按正则模式在文档中出现的顺序细分级别
 * 3. 只匹配行首第一个题号
 */

const { v4: uuidv4 } = require('uuid')

// ============================================
// 默认识别规则
// ============================================

/**
 * 默认题号识别模式（按优先级顺序）
 * 这些模式用于识别行首的题号格式
 */
const DEFAULT_QUESTION_PATTERNS = [
  /^[一二三四五六七八九十百]+[、．.]/,     // 中文数字：一、二、三、
  /^\d+[、]\s*/,                           // 阿拉伯数字+顿号：1、2、
  /^\d+[.．]\s*/,                          // 阿拉伯数字+点：1. 2.
  /^[（(]\d+[)）]\s*/,                     // 括号数字：（1）(1)
  /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/,   // 圈数字：①②③
  /^[a-z][.．)）]\s*/,                     // 小写字母：a. b. a) b)（排除大写，因为A.B.C.D.通常是选项）
  /^[ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ][.．)）、]\s*/,  // 罗马数字
]

/**
 * 兼容旧版本的 DEFAULT_PATTERNS
 */
const DEFAULT_PATTERNS = {
  // 题号模式（按优先级顺序）
  questionPatterns: DEFAULT_QUESTION_PATTERNS,
  // 分数模式
  score: [
    /[（(【\[]\s*(\d+)\s*分\s*[)）\]】]/,
    /共\s*(\d+)\s*分/,
    /(\d+)\s*分/
  ],
  // 括号模式
  bracket: [
    /[（(][^)）]*[)）]/g,
    /[【\[][^\]】]*[\]】]/g,
    /\{[^}]*\}/g
  ],
  // 下划线模式
  underline: [
    /_{2,}/g,
    /—{2,}/g,
    /＿{2,}/g
  ]
}


// ============================================
// 智能层级识别（基于字号 + 正则）
// ============================================

/**
 * 智能提取题目结构
 * 
 * 核心算法：
 * 1. 按字号分组，字号大的级别高
 * 2. 同字号内，按题号格式在文档中首次出现的顺序分配子级别
 * 3. 最终级别 = 字号基础级别 + 同字号内的子级别偏移
 * 
 * @param {Array} styledParagraphs - 带样式的段落数组（来自 docxParserService）
 * @param {Object} [rule] - 自定义规则
 * @returns {Object} { questions, levelMapping }
 */
function extractWithStyles(styledParagraphs, rule) {
  if (!styledParagraphs || styledParagraphs.length === 0) {
    return { questions: [], levelMapping: {} }
  }
  
  const patterns = rule?.patterns?.questionPatterns || DEFAULT_QUESTION_PATTERNS
  
  // ========== 第一步：按字号分组 ==========
  // sortKey = (isBold ? 1000 : 0) + fontSize
  const fontSizeGroups = new Map() // sortKey -> { paragraphs: [], patternOrder: Map }
  
  styledParagraphs.forEach((p, idx) => {
    if (!fontSizeGroups.has(p.sortKey)) {
      fontSizeGroups.set(p.sortKey, {
        sortKey: p.sortKey,
        fontSize: p.fontSize,
        isBold: p.isBold,
        paragraphs: [],
        patternOrder: new Map() // patternIndex -> subLevel (在该字号内的顺序)
      })
    }
    fontSizeGroups.get(p.sortKey).paragraphs.push({ ...p, originalIndex: idx })
  })
  
  // 按 sortKey 从大到小排序（粗体+大字号优先）
  const sortedGroups = [...fontSizeGroups.values()].sort((a, b) => b.sortKey - a.sortKey)
  
  // ========== 第二步：为每个字号组分配基础级别 ==========
  // 并记录每个字号组内的题号模式出现顺序
  let currentBaseLevel = 1
  const levelMapping = {} // 用于调试输出
  
  sortedGroups.forEach(group => {
    group.baseLevel = currentBaseLevel
    
    // 扫描该组内所有段落，记录题号模式的出现顺序
    let subLevelCounter = 0
    
    group.paragraphs.forEach(p => {
      const text = p.text.trim()
      if (!text) return
      
      // 尝试匹配题号
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
        const match = text.match(regex)
        
        if (match && match.index === 0) {
          // 匹配成功，记录该模式在此字号组内的顺序
          if (!group.patternOrder.has(i)) {
            group.patternOrder.set(i, subLevelCounter++)
          }
          break // 只匹配第一个
        }
      }
    })
    
    // 更新下一个字号组的基础级别
    // 基础级别 + 该组内的子级别数量
    const subLevelCount = group.patternOrder.size
    levelMapping[`${group.isBold ? '粗体' : ''}${group.fontSize}pt`] = {
      baseLevel: currentBaseLevel,
      subLevels: subLevelCount
    }
    
    currentBaseLevel += Math.max(1, subLevelCount)
  })
  
  // ========== 第三步：为每个段落分配最终级别 ==========
  const allQuestions = []
  
  sortedGroups.forEach(group => {
    group.paragraphs.forEach(p => {
      const text = p.text.trim()
      if (!text) return
      
      // 尝试匹配题号
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
        const match = text.match(regex)
        
        if (match && match.index === 0) {
          // 计算最终级别
          const subLevel = group.patternOrder.get(i) || 0
          const finalLevel = group.baseLevel + subLevel
          
          allQuestions.push({
            id: uuidv4(),
            level: finalLevel,
            number: match[0].trim(),
            content: text.substring(match[0].length).trim(),
            fullText: text,
            score: extractScoreFromText(text),
            paragraphIndex: p.originalIndex,
            fontSize: p.fontSize,
            isBold: p.isBold,
            sortKey: p.sortKey,
            baseLevel: group.baseLevel,
            subLevel: subLevel,
            children: []
          })
          break // 只匹配第一个
        }
      }
    })
  })
  
  // 按原始段落顺序排序
  allQuestions.sort((a, b) => a.paragraphIndex - b.paragraphIndex)
  
  // ========== 第四步：构建树形结构 ==========
  const questions = buildQuestionTree(allQuestions)
  
  return { questions, levelMapping }
}

/**
 * 构建题目树形结构
 * @param {Array} allQuestions - 所有题目（扁平列表，已按段落顺序排序）
 * @returns {Array} 树形结构的题目列表
 */
function buildQuestionTree(allQuestions) {
  const questions = []
  const stack = [] // 用于构建层级关系
  
  for (const question of allQuestions) {
    const level = question.level
    
    // 清理栈中级别 >= 当前级别的项
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    
    if (stack.length === 0) {
      // 没有父级，添加到根
      questions.push(question)
    } else {
      // 添加到最近的父级
      const parent = stack[stack.length - 1]
      parent.children.push(question)
    }
    
    // 将当前题目压入栈
    stack.push(question)
  }
  
  return questions
}

/**
 * 从文本中提取分数
 * @param {string} text - 文本
 * @returns {number|null} 分数或 null
 */
function extractScoreFromText(text) {
  const patterns = [
    /[（(【\[]\s*(\d+)\s*分\s*[)）\]】]/,
    /共\s*(\d+)\s*分/,
    /(\d+)\s*分/
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return parseInt(match[1], 10)
    }
  }
  
  return null
}


// ============================================
// 工具函数
// ============================================

/**
 * 将模式转换为正则表达式数组
 * @param {Array} patterns - 模式数组（可能是字符串或正则）
 */
function getPatterns(patterns) {
  if (!patterns) return []
  
  return patterns.map(p => {
    if (p instanceof RegExp) return p
    if (typeof p === 'string') {
      try {
        return new RegExp(p)
      } catch (e) {
        console.warn('无效的正则表达式:', p)
        return null
      }
    }
    return null
  }).filter(Boolean)
}

// ============================================
// 兼容旧版本的函数
// ============================================

/**
 * 从文本中提取结构化信息（兼容旧版本）
 */
function extract(text, rule) {
  const patterns = rule?.patterns || DEFAULT_PATTERNS
  
  const questions = extractQuestions(text, patterns)
  associateScores(questions, text, patterns)
  const brackets = extractBrackets(text, patterns)
  const underlines = extractUnderlines(text, patterns)
  
  return {
    questions,
    brackets,
    underlines
  }
}

/**
 * 提取题号并构建树形结构（旧版本，基于纯正则）
 */
function extractQuestions(text, patterns) {
  const lines = text.split('\n')
  const questions = []
  const stack = []
  
  // 获取题号模式
  const questionPatterns = patterns.questionPatterns || DEFAULT_QUESTION_PATTERNS
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const detection = detectQuestionLevelFromPatterns(line, questionPatterns)
    
    if (detection) {
      const question = {
        id: uuidv4(),
        level: detection.level,
        number: detection.number,
        content: detection.content,
        score: null,
        lineIndex: i,
        children: []
      }
      
      // 构建树形结构
      while (stack.length > 0 && stack[stack.length - 1].level >= detection.level) {
        stack.pop()
      }
      
      if (stack.length === 0) {
        questions.push(question)
      } else {
        stack[stack.length - 1].children.push(question)
      }
      
      stack.push(question)
    }
  }
  
  return questions
}

/**
 * 检测行的题号级别（基于模式顺序）
 */
function detectQuestionLevelFromPatterns(line, questionPatterns) {
  for (let i = 0; i < questionPatterns.length; i++) {
    const pattern = questionPatterns[i]
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
    const match = line.match(regex)
    
    if (match && match.index === 0) {
      return {
        level: i + 1, // 模式顺序决定级别
        number: match[0].trim(),
        content: line.substring(match[0].length).trim()
      }
    }
  }
  
  return null
}

/**
 * 检测行的题号级别（兼容旧版本，使用 level1, level2 格式）
 */
function detectQuestionLevel(line, patterns) {
  // 如果有新格式的 questionPatterns，使用新逻辑
  if (patterns.questionPatterns) {
    return detectQuestionLevelFromPatterns(line, patterns.questionPatterns)
  }
  
  // 兼容旧格式 level1, level2, ...
  const levelKeys = Object.keys(patterns)
    .filter(k => k.startsWith('level'))
    .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)))
  
  for (const levelKey of levelKeys) {
    const levelPatterns = getPatterns(patterns[levelKey])
    const level = parseInt(levelKey.slice(5))
    
    for (const pattern of levelPatterns) {
      const match = line.match(pattern)
      if (match && match.index === 0) {
        return {
          level,
          number: match[0].trim(),
          content: line.substring(match[0].length).trim()
        }
      }
    }
  }
  
  return null
}

function associateScores(questions, text, patterns) {
  const lines = text.split('\n')
  
  function processQuestion(question) {
    const line = lines[question.lineIndex] || ''
    const score = extractScoreFromLine(line, patterns)
    if (score !== null) {
      question.score = score
    }
    for (const child of question.children) {
      processQuestion(child)
    }
  }
  
  for (const question of questions) {
    processQuestion(question)
  }
}

function extractScoreFromLine(line, patterns) {
  for (const pattern of getPatterns(patterns.score)) {
    const regex = new RegExp(pattern.source, pattern.flags || '')
    const match = line.match(regex)
    if (match) {
      const numMatch = match[0].match(/\d+/)
      if (numMatch) {
        return parseInt(numMatch[0], 10)
      }
    }
  }
  return null
}

function extractBrackets(text, patterns) {
  const brackets = []
  const bracketPatterns = getPatterns(patterns.bracket)
  
  for (const pattern of bracketPatterns) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    
    while ((match = regex.exec(text)) !== null) {
      brackets.push({
        index: match.index,
        content: match[0],
        type: detectBracketType(match[0]),
        hasScore: /\d+\s*分/.test(match[0]),
        scoreValue: extractScoreValue(match[0])
      })
    }
  }
  
  brackets.sort((a, b) => a.index - b.index)
  return deduplicateByIndex(brackets)
}

function detectBracketType(bracket) {
  if (bracket.startsWith('（') || bracket.startsWith('）')) return 'chinese'
  if (bracket.startsWith('(') || bracket.startsWith(')')) return 'small'
  if (bracket.startsWith('[') || bracket.startsWith(']')) return 'medium'
  if (bracket.startsWith('{') || bracket.startsWith('}')) return 'large'
  if (bracket.startsWith('【') || bracket.startsWith('】')) return 'square'
  return 'unknown'
}

function extractScoreValue(content) {
  const match = content.match(/(\d+)\s*分/)
  return match ? parseInt(match[1], 10) : null
}

function extractUnderlines(text, patterns) {
  const underlines = []
  const underlinePatterns = getPatterns(patterns.underline)
  
  for (const pattern of underlinePatterns) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    
    while ((match = regex.exec(text)) !== null) {
      underlines.push({
        index: match.index,
        length: match[0].length,
        type: detectUnderlineType(match[0]),
        content: match[0]
      })
    }
  }
  
  underlines.sort((a, b) => a.index - b.index)
  return deduplicateByIndex(underlines)
}

function detectUnderlineType(underline) {
  if (underline.includes('_')) return 'english'
  if (underline.includes('—')) return 'chinese_dash'
  if (underline.includes('＿')) return 'chinese_underline'
  return 'unknown'
}

function deduplicateByIndex(items) {
  const seen = new Set()
  return items.filter(item => {
    if (seen.has(item.index)) return false
    seen.add(item.index)
    return true
  })
}

function detectQuestionNumbers(text) {
  const lines = text.split('\n')
  const matches = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const detection = detectQuestionLevelFromPatterns(line, DEFAULT_QUESTION_PATTERNS)
    if (detection) {
      matches.push({
        lineIndex: i,
        ...detection
      })
    }
  }
  
  return matches
}

function detectScores(text) {
  const matches = []
  
  for (const pattern of getPatterns(DEFAULT_PATTERNS.score)) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const numMatch = match[0].match(/\d+/)
      if (numMatch) {
        matches.push({
          index: match.index,
          text: match[0],
          value: parseInt(numMatch[0], 10)
        })
      }
    }
  }
  
  return matches
}

module.exports = {
  // 新版智能识别
  extractWithStyles,
  
  // 兼容旧版本
  extract,
  extractQuestions,
  extractBrackets,
  extractUnderlines,
  detectQuestionNumbers,
  detectScores,
  detectQuestionLevel,
  DEFAULT_PATTERNS,
  DEFAULT_QUESTION_PATTERNS
}
