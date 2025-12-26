const { ipcMain, app, dialog } = require('electron')

/**
 * IPC Handlers Registration
 * 
 * This file centralizes all IPC handler registrations.
 * To add a new handler:
 * 1. Create a handler function or import a service
 * 2. Register it with ipcMain.handle('channel-name', handler)
 * 3. Expose the corresponding API in preload.js
 */

// ============ Database Service ============

let databaseService = null

async function getDatabaseService() {
  if (!databaseService) {
    databaseService = require('./services/databaseService')
    await databaseService.initDatabase()
  }
  return databaseService
}

// ============ Example Handler ============

// Get application info - demonstrates basic IPC pattern
ipcMain.handle('get-app-info', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }
})

// ============ Web Server Handlers ============

let webServerService = null

function getWebServerService() {
  if (!webServerService) {
    const { getWebServerService: getService } = require('./services/webServerService')
    webServerService = getService()
  }
  return webServerService
}

// Start web server
ipcMain.handle('web-server:start', async (event, port) => {
  try {
    const service = getWebServerService()
    return await service.start(port)
  } catch (error) {
    throw new Error(error.message || '服务器启动失败')
  }
})

// Stop web server
ipcMain.handle('web-server:stop', async () => {
  try {
    const service = getWebServerService()
    await service.stop()
    return service.getStatus()
  } catch (error) {
    throw new Error(error.message || '服务器停止失败')
  }
})

// Get web server status
ipcMain.handle('web-server:status', async () => {
  try {
    const service = getWebServerService()
    return service.getStatus()
  } catch (error) {
    throw new Error(error.message || '获取状态失败')
  }
})

// ============ Add Your Custom Handlers Below ============

// ============ 文件选择 ============

// 选择文件对话框
ipcMain.handle('file:select', async (event, options = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', options.multiple ? 'multiSelections' : undefined].filter(Boolean),
    filters: [
      { name: '文档文件', extensions: ['doc', 'docx', 'pdf'] },
      { name: 'Word 文档', extensions: ['doc', 'docx'] },
      { name: 'PDF 文档', extensions: ['pdf'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  
  if (result.canceled) return []
  return result.filePaths
})

// 选择输出目录
ipcMain.handle('file:selectOutputDir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  
  if (result.canceled) return null
  return result.filePaths[0]
})

// ============ 文档解析 ============

// 解析文档
ipcMain.handle('file:parse', async (event, filePath, ruleId) => {
  try {
    // 延迟加载解析服务（将在后续任务中实现）
    const docxParser = require('./services/docxParserService')
    const pdfParser = require('./services/pdfParserService')
    const structureExtractor = require('./services/structureExtractorService')
    const db = await getDatabaseService()
    
    const ext = filePath.toLowerCase().split('.').pop()
    let content = null
    let headers = []
    let footers = []
    let tables = []
    let contentBlocks = []
    
    let images = []
    
    // 根据文件类型选择解析器
    if (ext === 'docx' || ext === 'doc') {
      const result = await docxParser.parse(filePath)
      content = result.text
      headers = result.headers || []
      footers = result.footers || []
      tables = result.tables || []
      contentBlocks = result.contentBlocks || []
      images = result.images || []
    } else if (ext === 'pdf') {
      const result = await pdfParser.parse(filePath)
      content = result.text
    } else {
      throw new Error(`不支持的文件格式: ${ext}`)
    }
    
    // 获取规则
    const rule = ruleId ? db.getRule(ruleId) : db.getDefaultRule()
    
    // 提取结构
    const startTime = Date.now()
    const extracted = structureExtractor.extract(content, rule)
    const parseTime = Date.now() - startTime
    
    // 构建结果
    const { v4: uuidv4 } = require('uuid')
    const path = require('path')
    
    const parseResult = {
      id: uuidv4(),
      fileName: path.basename(filePath),
      filePath: filePath,
      fileType: ext,
      structure: extracted.questions,
      headers: headers,
      footers: footers,
      tables: tables,
      images: images,
      contentBlocks: contentBlocks,
      brackets: extracted.brackets,
      underlines: extracted.underlines,
      ruleId: rule?.id,
      parseTime: parseTime
    }
    
    // 保存结果
    db.saveResult(parseResult)
    
    return parseResult
  } catch (error) {
    console.error('解析文档失败:', error)
    throw new Error(error.message || '解析文档失败')
  }
})

// ============ 规则管理 ============

// 获取所有规则
ipcMain.handle('rule:list', async () => {
  const db = await getDatabaseService()
  return db.getRules()
})

// 获取规则
ipcMain.handle('rule:get', async (event, id) => {
  const db = await getDatabaseService()
  return db.getRule(id)
})

// 创建/更新规则
ipcMain.handle('rule:save', async (event, rule) => {
  const db = await getDatabaseService()
  const { v4: uuidv4 } = require('uuid')
  
  if (!rule.id) {
    rule.id = uuidv4()
  }
  
  db.saveRule(rule)
  return db.getRule(rule.id)
})

// 删除规则
ipcMain.handle('rule:delete', async (event, id) => {
  const db = await getDatabaseService()
  db.deleteRule(id)
  return true
})

// 导出规则
ipcMain.handle('rule:export', async (event, ids) => {
  const db = await getDatabaseService()
  const rules = ids.map(id => db.getRule(id)).filter(Boolean)
  return JSON.stringify(rules, null, 2)
})

// 导入规则
ipcMain.handle('rule:import', async (event, jsonStr) => {
  const db = await getDatabaseService()
  const { v4: uuidv4 } = require('uuid')
  
  const rules = JSON.parse(jsonStr)
  const imported = []
  
  for (const rule of rules) {
    rule.id = uuidv4() // 生成新ID避免冲突
    rule.isDefault = false // 导入的规则不能是默认规则
    db.saveRule(rule)
    imported.push(db.getRule(rule.id))
  }
  
  return imported
})

// ============ 历史记录 ============

// 获取历史记录
ipcMain.handle('history:list', async (event, limit = 50) => {
  const db = await getDatabaseService()
  return db.getHistory(limit)
})

// 获取解析结果
ipcMain.handle('history:get', async (event, id) => {
  const db = await getDatabaseService()
  return db.getResult(id)
})

// 删除历史记录
ipcMain.handle('history:delete', async (event, id) => {
  const db = await getDatabaseService()
  db.deleteResult(id)
  return true
})

// 导出解析结果为JSON
ipcMain.handle('history:export', async (event, id) => {
  const db = await getDatabaseService()
  const result = db.getResult(id)
  if (!result) throw new Error('记录不存在')
  return JSON.stringify(result, null, 2)
})

// ============ 批量处理 ============

let batchProcessorService = null
let mainWindow = null

function getBatchProcessorService() {
  if (!batchProcessorService) {
    batchProcessorService = require('./services/batchProcessorService')
  }
  return batchProcessorService
}

// 设置主窗口引用（用于发送进度事件）
function setMainWindow(win) {
  mainWindow = win
  
  // 监听批量处理进度
  const batchService = getBatchProcessorService()
  batchService.onProgress((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('batch:progress', data)
    }
  })
}

// 创建批量任务
ipcMain.handle('batch:create', async (event, filePaths, ruleId, outputDir) => {
  try {
    const batchService = getBatchProcessorService()
    return batchService.createTask(filePaths, ruleId, outputDir)
  } catch (error) {
    throw new Error(error.message || '创建批量任务失败')
  }
})

// 开始批量任务
ipcMain.handle('batch:start', async (event, taskId) => {
  try {
    const batchService = getBatchProcessorService()
    return await batchService.startTask(taskId)
  } catch (error) {
    throw new Error(error.message || '启动批量任务失败')
  }
})

// 取消批量任务
ipcMain.handle('batch:cancel', async (event, taskId) => {
  try {
    const batchService = getBatchProcessorService()
    return batchService.cancelTask(taskId)
  } catch (error) {
    throw new Error(error.message || '取消批量任务失败')
  }
})

// 重试失败文件
ipcMain.handle('batch:retry', async (event, taskId, fileId) => {
  try {
    const batchService = getBatchProcessorService()
    return await batchService.retryFailed(taskId, fileId)
  } catch (error) {
    throw new Error(error.message || '重试失败')
  }
})

// 获取任务状态
ipcMain.handle('batch:status', async (event, taskId) => {
  try {
    const batchService = getBatchProcessorService()
    return batchService.getTaskStatus(taskId)
  } catch (error) {
    throw new Error(error.message || '获取任务状态失败')
  }
})

// 获取所有活动任务
ipcMain.handle('batch:activeTasks', async () => {
  try {
    const batchService = getBatchProcessorService()
    return batchService.getActiveTasks()
  } catch (error) {
    throw new Error(error.message || '获取活动任务失败')
  }
})

// 清理任务
ipcMain.handle('batch:cleanup', async (event, taskId) => {
  try {
    const batchService = getBatchProcessorService()
    return batchService.cleanupTask(taskId)
  } catch (error) {
    throw new Error(error.message || '清理任务失败')
  }
})

// ============ 文档裁剪 ============

let cropperService = null

function getCropperService() {
  if (!cropperService) {
    cropperService = require('./services/cropperService')
  }
  return cropperService
}

// 裁剪文档
ipcMain.handle('crop:document', async (event, inputPath, settings, outputPath) => {
  try {
    const cropper = getCropperService()
    
    // 验证设置
    const validation = cropper.validateSettings(settings)
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '))
    }
    
    return await cropper.cropDocument(inputPath, settings, outputPath)
  } catch (error) {
    throw new Error(error.message || '裁剪文档失败')
  }
})

// 获取 PDF 页面信息
ipcMain.handle('crop:getPdfInfo', async (event, filePath) => {
  try {
    const cropper = getCropperService()
    return await cropper.getPdfPageInfo(filePath)
  } catch (error) {
    throw new Error(error.message || '获取页面信息失败')
  }
})

// 验证裁剪设置
ipcMain.handle('crop:validateSettings', async (event, settings) => {
  try {
    const cropper = getCropperService()
    return cropper.validateSettings(settings)
  } catch (error) {
    throw new Error(error.message || '验证设置失败')
  }
})

// 导出 setMainWindow 函数
module.exports = { setMainWindow }
