const { contextBridge, ipcRenderer } = require('electron')

/**
 * Expose Electron API to renderer process
 * All communication goes through IPC for security
 * 
 * To add new APIs:
 * 1. Add the API method here
 * 2. Register the corresponding handler in ipcHandlers.js
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Get application info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Web server control
  webServer: {
    start: (port) => ipcRenderer.invoke('web-server:start', port),
    stop: () => ipcRenderer.invoke('web-server:stop'),
    getStatus: () => ipcRenderer.invoke('web-server:status')
  },
  
  // ============ 文件操作 ============
  file: {
    // 选择文件
    select: (options) => ipcRenderer.invoke('file:select', options),
    // 选择输出目录
    selectOutputDir: () => ipcRenderer.invoke('file:selectOutputDir'),
    // 解析文档
    parse: (filePath, ruleId) => ipcRenderer.invoke('file:parse', filePath, ruleId)
  },
  
  // ============ 规则管理 ============
  rule: {
    // 获取所有规则
    list: () => ipcRenderer.invoke('rule:list'),
    // 获取规则
    get: (id) => ipcRenderer.invoke('rule:get', id),
    // 保存规则
    save: (rule) => ipcRenderer.invoke('rule:save', rule),
    // 删除规则
    delete: (id) => ipcRenderer.invoke('rule:delete', id),
    // 导出规则
    export: (ids) => ipcRenderer.invoke('rule:export', ids),
    // 导入规则
    import: (jsonStr) => ipcRenderer.invoke('rule:import', jsonStr)
  },
  
  // ============ 历史记录 ============
  history: {
    // 获取历史记录列表
    list: (limit) => ipcRenderer.invoke('history:list', limit),
    // 获取解析结果
    get: (id) => ipcRenderer.invoke('history:get', id),
    // 删除历史记录
    delete: (id) => ipcRenderer.invoke('history:delete', id),
    // 导出为JSON
    export: (id) => ipcRenderer.invoke('history:export', id)
  },
  
  // ============ 批量处理 ============
  batch: {
    // 创建批量任务
    create: (filePaths, ruleId, outputDir) => ipcRenderer.invoke('batch:create', filePaths, ruleId, outputDir),
    // 开始批量任务
    start: (taskId) => ipcRenderer.invoke('batch:start', taskId),
    // 取消批量任务
    cancel: (taskId) => ipcRenderer.invoke('batch:cancel', taskId),
    // 重试失败文件
    retry: (taskId, fileId) => ipcRenderer.invoke('batch:retry', taskId, fileId),
    // 获取任务状态
    getStatus: (taskId) => ipcRenderer.invoke('batch:status', taskId),
    // 获取所有活动任务
    getActiveTasks: () => ipcRenderer.invoke('batch:activeTasks'),
    // 清理任务
    cleanup: (taskId) => ipcRenderer.invoke('batch:cleanup', taskId),
    // 监听进度事件
    onProgress: (callback) => {
      const handler = (event, data) => callback(data)
      ipcRenderer.on('batch:progress', handler)
      return () => ipcRenderer.removeListener('batch:progress', handler)
    }
  },
  
  // ============ 文档裁剪 ============
  crop: {
    // 裁剪文档
    document: (inputPath, settings, outputPath) => ipcRenderer.invoke('crop:document', inputPath, settings, outputPath),
    // 获取 PDF 页面信息
    getPdfInfo: (filePath) => ipcRenderer.invoke('crop:getPdfInfo', filePath),
    // 验证裁剪设置
    validateSettings: (settings) => ipcRenderer.invoke('crop:validateSettings', settings)
  }
})
