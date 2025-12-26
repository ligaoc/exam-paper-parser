/**
 * 规则引擎服务
 * 管理识别规则的创建、更新、删除、导入导出
 */

const { v4: uuidv4 } = require('uuid')

let databaseService = null

/**
 * 初始化规则引擎
 * @param {Object} dbService - 数据库服务实例
 */
function init(dbService) {
  databaseService = dbService
}

/**
 * 获取数据库服务
 */
function getDb() {
  if (!databaseService) {
    databaseService = require('./databaseService')
  }
  return databaseService
}

/**
 * 创建新规则
 * @param {Object} ruleData - 规则数据
 * @returns {Object} 创建的规则
 */
function createRule(ruleData) {
  const db = getDb()
  
  const rule = {
    id: uuidv4(),
    name: ruleData.name || '未命名规则',
    description: ruleData.description || '',
    patterns: validatePatterns(ruleData.patterns),
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  db.saveRule(rule)
  return db.getRule(rule.id)
}

/**
 * 更新规则
 * @param {string} id - 规则ID
 * @param {Object} updates - 更新数据
 * @returns {Object} 更新后的规则
 */
function updateRule(id, updates) {
  const db = getDb()
  const existing = db.getRule(id)
  
  if (!existing) {
    throw new Error('规则不存在')
  }
  
  // 默认规则不能修改为非默认
  if (existing.isDefault && updates.isDefault === false) {
    throw new Error('不能取消默认规则的默认状态')
  }
  
  const rule = {
    ...existing,
    name: updates.name !== undefined ? updates.name : existing.name,
    description: updates.description !== undefined ? updates.description : existing.description,
    patterns: updates.patterns ? validatePatterns(updates.patterns) : existing.patterns,
    updatedAt: new Date().toISOString()
  }
  
  db.saveRule(rule)
  return db.getRule(id)
}

/**
 * 删除规则
 * @param {string} id - 规则ID
 */
function deleteRule(id) {
  const db = getDb()
  const rule = db.getRule(id)
  
  if (!rule) {
    throw new Error('规则不存在')
  }
  
  if (rule.isDefault) {
    throw new Error('不能删除默认规则')
  }
  
  db.deleteRule(id)
}

/**
 * 获取规则
 * @param {string} id - 规则ID
 * @returns {Object|null} 规则对象
 */
function getRule(id) {
  const db = getDb()
  return db.getRule(id)
}

/**
 * 获取所有规则
 * @returns {Array} 规则列表
 */
function getAllRules() {
  const db = getDb()
  return db.getRules()
}

/**
 * 获取默认规则
 * @returns {Object|null} 默认规则
 */
function getDefaultRule() {
  const db = getDb()
  return db.getDefaultRule()
}

/**
 * 设置默认规则
 * @param {string} id - 规则ID
 */
function setDefaultRule(id) {
  const db = getDb()
  const rule = db.getRule(id)
  
  if (!rule) {
    throw new Error('规则不存在')
  }
  
  // 取消当前默认规则
  const currentDefault = db.getDefaultRule()
  if (currentDefault && currentDefault.id !== id) {
    currentDefault.isDefault = false
    db.saveRule(currentDefault)
  }
  
  // 设置新的默认规则
  rule.isDefault = true
  db.saveRule(rule)
}

/**
 * 导出规则
 * @param {Array} ids - 要导出的规则ID列表
 * @returns {string} JSON字符串
 */
function exportRules(ids) {
  const db = getDb()
  const rules = ids.map(id => db.getRule(id)).filter(Boolean)
  
  // 导出时移除ID和默认状态，以便导入时重新生成
  const exportData = rules.map(rule => ({
    name: rule.name,
    description: rule.description,
    patterns: rule.patterns
  }))
  
  return JSON.stringify(exportData, null, 2)
}

/**
 * 导入规则
 * @param {string} jsonStr - JSON字符串
 * @returns {Array} 导入的规则列表
 */
function importRules(jsonStr) {
  let data
  try {
    data = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error('无效的JSON格式')
  }
  
  if (!Array.isArray(data)) {
    data = [data]
  }
  
  const imported = []
  for (const ruleData of data) {
    try {
      const rule = createRule(ruleData)
      imported.push(rule)
    } catch (e) {
      console.warn('导入规则失败:', e.message)
    }
  }
  
  return imported
}

/**
 * 验证并规范化模式配置
 * @param {Object} patterns - 模式配置
 * @returns {Object} 规范化后的模式配置
 */
function validatePatterns(patterns) {
  if (!patterns || typeof patterns !== 'object') {
    return getDefaultPatterns()
  }
  
  const validated = {
    level1: validatePatternArray(patterns.level1),
    level2: validatePatternArray(patterns.level2),
    level3: validatePatternArray(patterns.level3),
    score: validatePatternArray(patterns.score),
    bracket: validatePatternArray(patterns.bracket),
    underline: validatePatternArray(patterns.underline)
  }
  
  return validated
}

/**
 * 验证模式数组
 * @param {Array} arr - 模式数组
 * @returns {Array} 验证后的数组
 */
function validatePatternArray(arr) {
  if (!Array.isArray(arr)) return []
  
  return arr.filter(pattern => {
    if (typeof pattern !== 'string') return false
    try {
      new RegExp(pattern)
      return true
    } catch (e) {
      console.warn('无效的正则表达式:', pattern)
      return false
    }
  })
}

/**
 * 获取默认模式配置
 * @returns {Object} 默认模式配置
 */
function getDefaultPatterns() {
  return {
    level1: [
      '^[一二三四五六七八九十]+[、．.]',
      '^\\d+[、．.]'
    ],
    level2: [
      '^\\d+[.．]',
      '^[（(]\\d+[)）]',
      '^[①②③④⑤⑥⑦⑧⑨⑩]'
    ],
    level3: [
      '^[（(]\\d+[)）]',
      '^[a-z][.．)]',
      '^[①②③④⑤⑥⑦⑧⑨⑩]'
    ],
    score: [
      '[（(【\\[]\\s*(\\d+)\\s*分\\s*[)）\\]】]',
      '共\\s*(\\d+)\\s*分',
      '(\\d+)\\s*分'
    ],
    bracket: [
      '[（(][^)）]*[)）]',
      '[【\\[][^\\]】]*[\\]】]',
      '\\{[^}]*\\}'
    ],
    underline: [
      '_{2,}',
      '—{2,}',
      '＿{2,}'
    ]
  }
}

/**
 * 复制规则
 * @param {string} id - 源规则ID
 * @param {string} newName - 新规则名称
 * @returns {Object} 新规则
 */
function copyRule(id, newName) {
  const db = getDb()
  const source = db.getRule(id)
  
  if (!source) {
    throw new Error('源规则不存在')
  }
  
  return createRule({
    name: newName || `${source.name} (副本)`,
    description: source.description,
    patterns: JSON.parse(JSON.stringify(source.patterns))
  })
}

module.exports = {
  init,
  createRule,
  updateRule,
  deleteRule,
  getRule,
  getAllRules,
  getDefaultRule,
  setDefaultRule,
  exportRules,
  importRules,
  copyRule,
  getDefaultPatterns,
  validatePatterns
}
