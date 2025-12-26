/**
 * 结构提取服务
 * 从文档文本中提取题号、分数、括号、下划线等结构化信息
 */

const { v4: uuidv4 } = require('uuid')

/**
 * 默认识别模式
 */
const DEFAULT_PATTERNS = {
  // 一级题号：中文数字或阿拉伯数字开头
  level1: [
    /^[一二三四五六七八九十]+[、．.]/,
    /^\d+[、．.]\s*/
  ],
  // 二级题号
  level2: [
    /^\d+[.．]\s*/,
    /^[（(]\d+[)）]\s*/,
    /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/
  ],
  // 三级题号
  level3: [
    /^[（(]\d+[)）]\s*/,
    /^[a-z][.．)]\s*/i,
    /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/
  ],
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

/**
 * 从文本中提取结构化信息
 * @param {string} text - 文档文本
 * @param {Object} rule - 识别规则
 * @returns {Object} 提取结果
 */
function extract(text, rule) {
  const patterns = rule?.patterns || DEFAULT_PATTERNS
  
  // 提取题号和构建树形结构
  const questions = extractQuestions(text, patterns)
  
  // 提取分数并关联到题目
  associateScores(questions, text, patterns)
  
  // 提取括号
  const brackets = extractBrackets(text, patterns)
  
  // 提取下划线
  const underlines = extractUnderlines(text, patterns)
  
  return {
    questions,
    brackets,
    underlines
  }
}

/**
 * 提取题号并构建树形结构
 * @param {string} text - 文档文本
 * @param {Object} patterns - 识别模式
 */
function extractQuestions(text, patterns) {
  const lines = text.split('\n')
  const questions = []
  const stack = [] // 用于构建层级关系
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // 检测题号级别
    const detection = detectQuestionLevel(line, patterns)
    
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
      
      // 根据级别构建树形结构
      if (detection.level === 1) {
        // 一级题目直接添加到根
        questions.push(question)
        stack.length = 0
        stack.push(question)
      } else if (detection.level === 2) {
        // 二级题目添加到最近的一级题目下
        const parent = findParent(stack, 1)
        if (parent) {
          parent.children.push(question)
        } else {
          // 没有父级，作为独立题目
          questions.push(question)
        }
        // 更新栈
        while (stack.length > 0 && stack[stack.length - 1].level >= 2) {
          stack.pop()
        }
        stack.push(question)
      } else if (detection.level === 3) {
        // 三级题目添加到最近的二级题目下
        const parent = findParent(stack, 2)
        if (parent) {
          parent.children.push(question)
        } else {
          // 没有二级父级，尝试添加到一级
          const level1Parent = findParent(stack, 1)
          if (level1Parent) {
            level1Parent.children.push(question)
          } else {
            questions.push(question)
          }
        }
      }
    }
  }
  
  return questions
}

/**
 * 检测行的题号级别
 * @param {string} line - 文本行
 * @param {Object} patterns - 识别模式
 */
function detectQuestionLevel(line, patterns) {
  // 检测一级题号
  for (const pattern of getPatterns(patterns.level1)) {
    const match = line.match(pattern)
    if (match) {
      return {
        level: 1,
        number: match[0].trim(),
        content: line.substring(match[0].length).trim()
      }
    }
  }
  
  // 检测二级题号
  for (const pattern of getPatterns(patterns.level2)) {
    const match = line.match(pattern)
    if (match) {
      // 避免将一级题号误判为二级
      // 检查是否是行首的独立编号
      if (match.index === 0) {
        return {
          level: 2,
          number: match[0].trim(),
          content: line.substring(match[0].length).trim()
        }
      }
    }
  }
  
  // 检测三级题号
  for (const pattern of getPatterns(patterns.level3)) {
    const match = line.match(pattern)
    if (match && match.index === 0) {
      return {
        level: 3,
        number: match[0].trim(),
        content: line.substring(match[0].length).trim()
      }
    }
  }
  
  return null
}

/**
 * 在栈中查找指定级别的父节点
 * @param {Array} stack - 节点栈
 * @param {number} level - 目标级别
 */
function findParent(stack, level) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].level === level) {
      return stack[i]
    }
  }
  return null
}

/**
 * 将分数关联到题目
 * @param {Array} questions - 题目列表
 * @param {string} text - 文档文本
 * @param {Object} patterns - 识别模式
 */
function associateScores(questions, text, patterns) {
  const lines = text.split('\n')
  
  // 递归处理所有题目
  function processQuestion(question) {
    // 在题目所在行查找分数
    const line = lines[question.lineIndex] || ''
    const score = extractScoreFromLine(line, patterns)
    if (score !== null) {
      question.score = score
    }
    
    // 处理子题目
    for (const child of question.children) {
      processQuestion(child)
    }
  }
  
  for (const question of questions) {
    processQuestion(question)
  }
}

/**
 * 从行中提取分数
 * @param {string} line - 文本行
 * @param {Object} patterns - 识别模式
 */
function extractScoreFromLine(line, patterns) {
  for (const pattern of getPatterns(patterns.score)) {
    const regex = new RegExp(pattern.source, pattern.flags || '')
    const match = line.match(regex)
    if (match) {
      // 提取数字
      const numMatch = match[0].match(/\d+/)
      if (numMatch) {
        return parseInt(numMatch[0], 10)
      }
    }
  }
  return null
}

/**
 * 提取所有括号
 * @param {string} text - 文档文本
 * @param {Object} patterns - 识别模式
 */
function extractBrackets(text, patterns) {
  const brackets = []
  const bracketPatterns = getPatterns(patterns.bracket)
  
  for (const pattern of bracketPatterns) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const content = match[0]
      const type = detectBracketType(content)
      const hasScore = /\d+\s*分/.test(content)
      
      brackets.push({
        index: match.index,
        content: content,
        type: type,
        hasScore: hasScore,
        scoreValue: hasScore ? extractScoreValue(content) : null
      })
    }
  }
  
  // 按位置排序并去重
  brackets.sort((a, b) => a.index - b.index)
  return deduplicateByIndex(brackets)
}

/**
 * 检测括号类型
 * @param {string} bracket - 括号内容
 */
function detectBracketType(bracket) {
  if (bracket.startsWith('（') || bracket.startsWith('）')) return 'chinese'
  if (bracket.startsWith('(') || bracket.startsWith(')')) return 'small'
  if (bracket.startsWith('[') || bracket.startsWith(']')) return 'medium'
  if (bracket.startsWith('{') || bracket.startsWith('}')) return 'large'
  if (bracket.startsWith('【') || bracket.startsWith('】')) return 'square'
  return 'unknown'
}

/**
 * 从括号内容中提取分数值
 * @param {string} content - 括号内容
 */
function extractScoreValue(content) {
  const match = content.match(/(\d+)\s*分/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * 提取所有下划线
 * @param {string} text - 文档文本
 * @param {Object} patterns - 识别模式
 */
function extractUnderlines(text, patterns) {
  const underlines = []
  const underlinePatterns = getPatterns(patterns.underline)
  
  for (const pattern of underlinePatterns) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const content = match[0]
      const type = detectUnderlineType(content)
      
      underlines.push({
        index: match.index,
        length: content.length,
        type: type,
        content: content
      })
    }
  }
  
  // 按位置排序并去重
  underlines.sort((a, b) => a.index - b.index)
  return deduplicateByIndex(underlines)
}

/**
 * 检测下划线类型
 * @param {string} underline - 下划线内容
 */
function detectUnderlineType(underline) {
  if (underline.includes('_')) return 'english'
  if (underline.includes('—')) return 'chinese_dash'
  if (underline.includes('＿')) return 'chinese_underline'
  return 'unknown'
}

/**
 * 按索引去重
 * @param {Array} items - 项目列表
 */
function deduplicateByIndex(items) {
  const seen = new Set()
  return items.filter(item => {
    if (seen.has(item.index)) return false
    seen.add(item.index)
    return true
  })
}

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

/**
 * 检测题号（用于单独调用）
 * @param {string} text - 文本
 */
function detectQuestionNumbers(text) {
  const lines = text.split('\n')
  const matches = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const detection = detectQuestionLevel(line, DEFAULT_PATTERNS)
    if (detection) {
      matches.push({
        lineIndex: i,
        ...detection
      })
    }
  }
  
  return matches
}

/**
 * 检测分数（用于单独调用）
 * @param {string} text - 文本
 */
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
  extract,
  extractQuestions,
  extractBrackets,
  extractUnderlines,
  detectQuestionNumbers,
  detectScores,
  detectQuestionLevel,
  DEFAULT_PATTERNS
}
