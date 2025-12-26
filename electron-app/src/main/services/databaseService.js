/**
 * 数据库服务 - 使用 sql.js (SQLite in WebAssembly)
 * 用于存储解析结果、识别规则和历史记录
 */

const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

let db = null
let SQL = null

/**
 * 获取数据库文件路径
 */
function getDbPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'exam-parser.db')
}

/**
 * 初始化数据库
 */
async function initDatabase() {
  if (db) return db

  // 初始化 sql.js
  SQL = await initSqlJs()
  
  const dbPath = getDbPath()
  
  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 创建表
  createTables()
  
  return db
}

/**
 * 创建数据库表
 */
function createTables() {
  // 解析结果表
  db.run(`
    CREATE TABLE IF NOT EXISTS parse_results (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      structure_json TEXT NOT NULL,
      headers_json TEXT,
      footers_json TEXT,
      brackets_json TEXT,
      underlines_json TEXT,
      rule_id TEXT,
      parse_time INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 识别规则表
  db.run(`
    CREATE TABLE IF NOT EXISTS parse_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      patterns_json TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 批量任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS batch_tasks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      completed_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT
    )
  `)

  // 插入默认规则（如果不存在）
  insertDefaultRule()
  
  // 保存数据库
  saveDatabase()
}

/**
 * 插入默认识别规则
 */
function insertDefaultRule() {
  const result = db.exec("SELECT COUNT(*) as count FROM parse_rules WHERE is_default = 1")
  const count = result[0]?.values[0]?.[0] || 0
  
  if (count === 0) {
    const defaultRule = {
      id: 'default-rule',
      name: '默认规则',
      description: '适用于大多数试卷的默认识别规则',
      patterns: {
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
      },
      is_default: 1
    }
    
    db.run(
      `INSERT INTO parse_rules (id, name, description, patterns_json, is_default) VALUES (?, ?, ?, ?, ?)`,
      [defaultRule.id, defaultRule.name, defaultRule.description, JSON.stringify(defaultRule.patterns), 1]
    )
  }
}

/**
 * 保存数据库到文件
 */
function saveDatabase() {
  if (!db) return
  
  const data = db.export()
  const buffer = Buffer.from(data)
  const dbPath = getDbPath()
  
  // 确保目录存在
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(dbPath, buffer)
}

// ==================== 解析结果 CRUD ====================

/**
 * 保存解析结果
 */
function saveResult(result) {
  db.run(
    `INSERT OR REPLACE INTO parse_results 
     (id, file_name, file_path, file_type, structure_json, headers_json, footers_json, brackets_json, underlines_json, rule_id, parse_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.id,
      result.fileName,
      result.filePath,
      result.fileType,
      JSON.stringify(result.structure),
      JSON.stringify(result.headers || []),
      JSON.stringify(result.footers || []),
      JSON.stringify(result.brackets || []),
      JSON.stringify(result.underlines || []),
      result.ruleId || null,
      result.parseTime || 0
    ]
  )
  saveDatabase()
}

/**
 * 获取解析结果
 */
function getResult(id) {
  const result = db.exec(`SELECT * FROM parse_results WHERE id = ?`, [id])
  if (result.length === 0 || result[0].values.length === 0) return null
  
  const row = result[0].values[0]
  const columns = result[0].columns
  return rowToResult(columns, row)
}

/**
 * 获取历史记录
 */
function getHistory(limit = 50) {
  const result = db.exec(
    `SELECT * FROM parse_results ORDER BY created_at DESC LIMIT ?`,
    [limit]
  )
  if (result.length === 0) return []
  
  const columns = result[0].columns
  return result[0].values.map(row => rowToResult(columns, row))
}

/**
 * 删除解析结果
 */
function deleteResult(id) {
  db.run(`DELETE FROM parse_results WHERE id = ?`, [id])
  saveDatabase()
}

/**
 * 将数据库行转换为结果对象
 */
function rowToResult(columns, row) {
  const obj = {}
  columns.forEach((col, i) => {
    obj[col] = row[i]
  })
  
  return {
    id: obj.id,
    fileName: obj.file_name,
    filePath: obj.file_path,
    fileType: obj.file_type,
    structure: JSON.parse(obj.structure_json || '[]'),
    headers: JSON.parse(obj.headers_json || '[]'),
    footers: JSON.parse(obj.footers_json || '[]'),
    brackets: JSON.parse(obj.brackets_json || '[]'),
    underlines: JSON.parse(obj.underlines_json || '[]'),
    ruleId: obj.rule_id,
    parseTime: obj.parse_time,
    createdAt: obj.created_at
  }
}

// ==================== 规则 CRUD ====================

/**
 * 保存规则
 */
function saveRule(rule) {
  db.run(
    `INSERT OR REPLACE INTO parse_rules 
     (id, name, description, patterns_json, is_default, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [
      rule.id,
      rule.name,
      rule.description || '',
      JSON.stringify(rule.patterns),
      rule.isDefault ? 1 : 0
    ]
  )
  saveDatabase()
}

/**
 * 获取所有规则
 */
function getRules() {
  const result = db.exec(`SELECT * FROM parse_rules ORDER BY is_default DESC, created_at DESC`)
  if (result.length === 0) return []
  
  const columns = result[0].columns
  return result[0].values.map(row => rowToRule(columns, row))
}

/**
 * 获取规则
 */
function getRule(id) {
  const result = db.exec(`SELECT * FROM parse_rules WHERE id = ?`, [id])
  if (result.length === 0 || result[0].values.length === 0) return null
  
  const columns = result[0].columns
  return rowToRule(columns, result[0].values[0])
}

/**
 * 获取默认规则
 */
function getDefaultRule() {
  const result = db.exec(`SELECT * FROM parse_rules WHERE is_default = 1 LIMIT 1`)
  if (result.length === 0 || result[0].values.length === 0) return null
  
  const columns = result[0].columns
  return rowToRule(columns, result[0].values[0])
}

/**
 * 删除规则
 */
function deleteRule(id) {
  db.run(`DELETE FROM parse_rules WHERE id = ? AND is_default = 0`, [id])
  saveDatabase()
}

/**
 * 将数据库行转换为规则对象
 */
function rowToRule(columns, row) {
  const obj = {}
  columns.forEach((col, i) => {
    obj[col] = row[i]
  })
  
  return {
    id: obj.id,
    name: obj.name,
    description: obj.description,
    patterns: JSON.parse(obj.patterns_json || '{}'),
    isDefault: obj.is_default === 1,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at
  }
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  saveDatabase,
  // 解析结果
  saveResult,
  getResult,
  getHistory,
  deleteResult,
  // 规则
  saveRule,
  getRules,
  getRule,
  getDefaultRule,
  deleteRule
}
