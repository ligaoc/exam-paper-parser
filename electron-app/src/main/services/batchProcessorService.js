/**
 * 批量处理服务
 * 支持同时处理多个文档，最多3个并发
 */

const { v4: uuidv4 } = require('uuid')
const path = require('path')
const EventEmitter = require('events')

// 最大并发数
const MAX_CONCURRENT = 3

// 任务状态
const TaskStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  CANCELLED: 'cancelled'
}

// 文件状态
const FileStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
}

// 事件发射器，用于通知进度
const emitter = new EventEmitter()

// 当前运行的任务
const activeTasks = new Map()

/**
 * 创建批量处理任务
 * @param {string[]} filePaths - 文件路径数组
 * @param {string} ruleId - 规则ID（可选）
 * @param {string} outputDir - 输出目录（可选）
 * @returns {Object} 任务信息
 */
function createTask(filePaths, ruleId = null, outputDir = null) {
  const taskId = uuidv4()
  
  const files = filePaths.map(filePath => ({
    id: uuidv4(),
    name: path.basename(filePath),
    path: filePath,
    type: path.extname(filePath).toLowerCase().slice(1),
    status: FileStatus.PENDING,
    error: null,
    result: null
  }))
  
  const task = {
    id: taskId,
    files: files,
    ruleId: ruleId,
    outputDir: outputDir,
    status: TaskStatus.IDLE,
    progress: 0,
    completedCount: 0,
    errorCount: 0,
    results: [],
    errors: [],
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null
  }
  
  activeTasks.set(taskId, task)
  
  return {
    id: taskId,
    fileCount: files.length,
    status: task.status
  }
}

/**
 * 开始批量处理任务
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} 任务结果
 */
async function startTask(taskId) {
  const task = activeTasks.get(taskId)
  if (!task) {
    throw new Error(`任务不存在: ${taskId}`)
  }
  
  if (task.status === TaskStatus.RUNNING) {
    throw new Error('任务正在运行中')
  }
  
  task.status = TaskStatus.RUNNING
  task.startedAt = new Date().toISOString()
  
  // 延迟加载解析服务
  const docxParser = require('./docxParserService')
  const pdfParser = require('./pdfParserService')
  const structureExtractor = require('./structureExtractorService')
  const databaseService = require('./databaseService')
  
  // 获取规则
  const rule = task.ruleId 
    ? databaseService.getRule(task.ruleId) 
    : databaseService.getDefaultRule()
  
  // 创建处理队列
  const pendingFiles = [...task.files]
  const processingFiles = []
  
  // 处理单个文件
  const processFile = async (file) => {
    file.status = FileStatus.PROCESSING
    emitProgress(task)
    
    try {
      const ext = file.type
      let content = null
      let headers = []
      let footers = []
      
      // 根据文件类型选择解析器
      if (ext === 'docx' || ext === 'doc') {
        const result = await docxParser.parse(file.path)
        content = result.text
        headers = result.headers || []
        footers = result.footers || []
      } else if (ext === 'pdf') {
        const result = await pdfParser.parse(file.path)
        content = result.text
      } else {
        throw new Error(`不支持的文件格式: ${ext}`)
      }
      
      // 提取结构
      const startTime = Date.now()
      const extracted = structureExtractor.extract(content, rule)
      const parseTime = Date.now() - startTime
      
      // 构建结果
      const parseResult = {
        id: uuidv4(),
        fileName: file.name,
        filePath: file.path,
        fileType: ext,
        structure: extracted.questions,
        headers: headers,
        footers: footers,
        brackets: extracted.brackets,
        underlines: extracted.underlines,
        ruleId: rule?.id,
        parseTime: parseTime
      }
      
      // 保存结果
      databaseService.saveResult(parseResult)
      
      file.status = FileStatus.COMPLETED
      file.result = parseResult
      task.results.push(parseResult)
      task.completedCount++
      
    } catch (error) {
      file.status = FileStatus.ERROR
      file.error = error.message
      task.errorCount++
      task.errors.push({
        fileId: file.id,
        fileName: file.name,
        message: error.message,
        canRetry: true
      })
    }
    
    emitProgress(task)
  }
  
  // 并发处理
  const processNext = async () => {
    // 检查是否已取消
    if (task.status === TaskStatus.CANCELLED) {
      return
    }
    
    // 如果有待处理文件且并发数未满
    while (pendingFiles.length > 0 && processingFiles.length < MAX_CONCURRENT) {
      const file = pendingFiles.shift()
      processingFiles.push(file)
      
      // 异步处理文件
      processFile(file).then(() => {
        // 从处理中列表移除
        const index = processingFiles.indexOf(file)
        if (index > -1) {
          processingFiles.splice(index, 1)
        }
        // 继续处理下一个
        processNext()
      })
    }
  }
  
  // 返回 Promise，等待所有文件处理完成
  return new Promise((resolve) => {
    const checkComplete = setInterval(() => {
      if (task.status === TaskStatus.CANCELLED) {
        clearInterval(checkComplete)
        resolve(getTaskResult(task))
        return
      }
      
      if (pendingFiles.length === 0 && processingFiles.length === 0) {
        clearInterval(checkComplete)
        
        // 更新任务状态
        task.completedAt = new Date().toISOString()
        if (task.errorCount === 0) {
          task.status = TaskStatus.COMPLETED
        } else if (task.completedCount > 0) {
          task.status = TaskStatus.PARTIAL
        } else {
          task.status = TaskStatus.COMPLETED
        }
        task.progress = 100
        
        emitProgress(task)
        resolve(getTaskResult(task))
      }
    }, 100)
    
    // 开始处理
    processNext()
  })
}

/**
 * 取消批量处理任务
 * @param {string} taskId - 任务ID
 */
function cancelTask(taskId) {
  const task = activeTasks.get(taskId)
  if (!task) {
    throw new Error(`任务不存在: ${taskId}`)
  }
  
  if (task.status !== TaskStatus.RUNNING) {
    return false
  }
  
  task.status = TaskStatus.CANCELLED
  task.completedAt = new Date().toISOString()
  
  emitProgress(task)
  return true
}

/**
 * 重试失败的文件
 * @param {string} taskId - 任务ID
 * @param {string} fileId - 文件ID（可选，不传则重试所有失败文件）
 */
async function retryFailed(taskId, fileId = null) {
  const task = activeTasks.get(taskId)
  if (!task) {
    throw new Error(`任务不存在: ${taskId}`)
  }
  
  // 找到需要重试的文件
  const filesToRetry = task.files.filter(f => {
    if (f.status !== FileStatus.ERROR) return false
    if (fileId && f.id !== fileId) return false
    return true
  })
  
  if (filesToRetry.length === 0) {
    return { retried: 0 }
  }
  
  // 重置文件状态
  filesToRetry.forEach(f => {
    f.status = FileStatus.PENDING
    f.error = null
  })
  
  // 从错误列表中移除
  task.errors = task.errors.filter(e => {
    return !filesToRetry.some(f => f.id === e.fileId)
  })
  task.errorCount = task.errors.length
  
  // 重新开始任务
  task.status = TaskStatus.RUNNING
  
  // 延迟加载解析服务
  const docxParser = require('./docxParserService')
  const pdfParser = require('./pdfParserService')
  const structureExtractor = require('./structureExtractorService')
  const databaseService = require('./databaseService')
  
  const rule = task.ruleId 
    ? databaseService.getRule(task.ruleId) 
    : databaseService.getDefaultRule()
  
  // 处理重试文件
  for (const file of filesToRetry) {
    file.status = FileStatus.PROCESSING
    emitProgress(task)
    
    try {
      const ext = file.type
      let content = null
      let headers = []
      let footers = []
      
      if (ext === 'docx' || ext === 'doc') {
        const result = await docxParser.parse(file.path)
        content = result.text
        headers = result.headers || []
        footers = result.footers || []
      } else if (ext === 'pdf') {
        const result = await pdfParser.parse(file.path)
        content = result.text
      } else {
        throw new Error(`不支持的文件格式: ${ext}`)
      }
      
      const startTime = Date.now()
      const extracted = structureExtractor.extract(content, rule)
      const parseTime = Date.now() - startTime
      
      const parseResult = {
        id: uuidv4(),
        fileName: file.name,
        filePath: file.path,
        fileType: ext,
        structure: extracted.questions,
        headers: headers,
        footers: footers,
        brackets: extracted.brackets,
        underlines: extracted.underlines,
        ruleId: rule?.id,
        parseTime: parseTime
      }
      
      databaseService.saveResult(parseResult)
      
      file.status = FileStatus.COMPLETED
      file.result = parseResult
      task.results.push(parseResult)
      task.completedCount++
      
    } catch (error) {
      file.status = FileStatus.ERROR
      file.error = error.message
      task.errorCount++
      task.errors.push({
        fileId: file.id,
        fileName: file.name,
        message: error.message,
        canRetry: true
      })
    }
    
    emitProgress(task)
  }
  
  // 更新任务状态
  if (task.errorCount === 0) {
    task.status = TaskStatus.COMPLETED
  } else if (task.completedCount > 0) {
    task.status = TaskStatus.PARTIAL
  }
  task.progress = 100
  
  emitProgress(task)
  
  return { retried: filesToRetry.length }
}

/**
 * 获取任务状态
 * @param {string} taskId - 任务ID
 */
function getTaskStatus(taskId) {
  const task = activeTasks.get(taskId)
  if (!task) {
    return null
  }
  
  return getTaskResult(task)
}

/**
 * 获取任务结果对象
 */
function getTaskResult(task) {
  const totalFiles = task.files.length
  const completedFiles = task.files.filter(f => 
    f.status === FileStatus.COMPLETED || f.status === FileStatus.ERROR
  ).length
  
  return {
    id: task.id,
    status: task.status,
    progress: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0,
    fileCount: totalFiles,
    completedCount: task.completedCount,
    errorCount: task.errorCount,
    files: task.files.map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
      error: f.error
    })),
    results: task.results,
    errors: task.errors,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt
  }
}

/**
 * 发送进度事件
 */
function emitProgress(task) {
  const result = getTaskResult(task)
  emitter.emit('progress', result)
}

/**
 * 监听进度事件
 * @param {Function} callback - 回调函数
 */
function onProgress(callback) {
  emitter.on('progress', callback)
  return () => emitter.off('progress', callback)
}

/**
 * 清理已完成的任务
 * @param {string} taskId - 任务ID（可选，不传则清理所有已完成任务）
 */
function cleanupTask(taskId = null) {
  if (taskId) {
    const task = activeTasks.get(taskId)
    if (task && task.status !== TaskStatus.RUNNING) {
      activeTasks.delete(taskId)
      return true
    }
    return false
  }
  
  // 清理所有非运行中的任务
  let cleaned = 0
  for (const [id, task] of activeTasks) {
    if (task.status !== TaskStatus.RUNNING) {
      activeTasks.delete(id)
      cleaned++
    }
  }
  return cleaned
}

/**
 * 获取所有活动任务
 */
function getActiveTasks() {
  return Array.from(activeTasks.values()).map(getTaskResult)
}

module.exports = {
  createTask,
  startTask,
  cancelTask,
  retryFailed,
  getTaskStatus,
  onProgress,
  cleanupTask,
  getActiveTasks,
  TaskStatus,
  FileStatus,
  MAX_CONCURRENT
}
