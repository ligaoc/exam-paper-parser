<template>
  <div class="batch-panel">
    <div class="panel-header">
      <h3>批量处理</h3>
      <div class="header-actions">
        <button class="btn btn-primary" @click="selectFiles" :disabled="isProcessing">
          <span class="icon">📁</span> 选择文件
        </button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="file-list" v-if="files.length > 0">
      <div class="file-list-header">
        <span>待处理文件 ({{ files.length }})</span>
        <button class="btn btn-sm btn-danger" @click="clearFiles" :disabled="isProcessing">
          清空
        </button>
      </div>
      <div class="file-items">
        <div 
          v-for="file in files" 
          :key="file.id" 
          class="file-item"
          :class="{ 
            'processing': file.status === 'processing',
            'completed': file.status === 'completed',
            'error': file.status === 'error'
          }"
        >
          <span class="file-icon">{{ getFileIcon(file.type) }}</span>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-status">
            <span v-if="file.status === 'pending'" class="status-pending">等待中</span>
            <span v-else-if="file.status === 'processing'" class="status-processing">
              <span class="spinner"></span> 处理中
            </span>
            <span v-else-if="file.status === 'completed'" class="status-completed">✓ 完成</span>
            <span v-else-if="file.status === 'error'" class="status-error" :title="file.error">
              ✗ 失败
            </span>
          </span>
          <button 
            v-if="file.status === 'error'" 
            class="btn btn-sm btn-link"
            @click="retryFile(file.id)"
            :disabled="isProcessing"
          >
            重试
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-icon">📄</div>
      <p>点击"选择文件"添加要批量处理的文档</p>
      <p class="hint">支持 .doc, .docx, .pdf 格式，最多同时处理 3 个文件</p>
    </div>

    <!-- 规则选择 -->
    <div class="rule-selector" v-if="files.length > 0">
      <label>使用规则：</label>
      <select v-model="selectedRuleId" :disabled="isProcessing">
        <option v-for="rule in rules" :key="rule.id" :value="rule.id">
          {{ rule.name }}{{ rule.isDefault ? ' (默认)' : '' }}
        </option>
      </select>
      <span class="current-rule-hint" v-if="selectedRuleName">
        当前: {{ selectedRuleName }}
      </span>
    </div>

    <!-- 进度条 -->
    <div class="progress-section" v-if="currentTask">
      <div class="progress-header">
        <span>处理进度</span>
        <span>{{ currentTask.completedCount + currentTask.errorCount }} / {{ currentTask.fileCount }}</span>
      </div>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: currentTask.progress + '%' }"
          :class="{ 'has-error': currentTask.errorCount > 0 }"
        ></div>
      </div>
      <div class="progress-stats">
        <span class="stat-completed">完成: {{ currentTask.completedCount }}</span>
        <span class="stat-error" v-if="currentTask.errorCount > 0">
          失败: {{ currentTask.errorCount }}
        </span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons" v-if="files.length > 0">
      <button 
        class="btn btn-primary btn-lg"
        @click="startBatch"
        :disabled="isProcessing || files.length === 0"
        v-if="!isProcessing"
      >
        <span class="icon">▶</span> 开始处理
      </button>
      <button 
        class="btn btn-danger btn-lg"
        @click="cancelBatch"
        v-else
      >
        <span class="icon">⏹</span> 取消处理
      </button>
      
      <button 
        class="btn btn-secondary"
        @click="retryAllFailed"
        v-if="hasFailedFiles && !isProcessing"
      >
        重试所有失败
      </button>
    </div>

    <!-- 处理结果 -->
    <div class="results-section" v-if="results.length > 0">
      <h4>处理结果</h4>
      <div class="results-list">
        <div 
          v-for="result in results" 
          :key="result.id" 
          class="result-item"
          @click="$emit('view-result', result)"
        >
          <span class="result-icon">📊</span>
          <span class="result-name">{{ result.fileName }}</span>
          <span class="result-info">
            {{ result.structure?.length || 0 }} 题目 | {{ result.parseTime }}ms
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'

export default {
  name: 'BatchPanel',
  emits: ['view-result'],
  setup(props, { emit }) {
    const files = ref([])
    const rules = ref([])
    const selectedRuleId = ref('')
    const currentTask = ref(null)
    const results = ref([])
    const isProcessing = ref(false)
    
    let progressUnsubscribe = null

    const hasFailedFiles = computed(() => {
      return files.value.some(f => f.status === 'error')
    })

    const selectedRuleName = computed(() => {
      const rule = rules.value.find(r => r.id === selectedRuleId.value)
      return rule ? rule.name : ''
    })

    const getFileIcon = (type) => {
      switch (type) {
        case 'doc':
        case 'docx':
          return '📘'
        case 'pdf':
          return '📕'
        default:
          return '📄'
      }
    }

    const loadRules = async () => {
      try {
        rules.value = await window.electronAPI.rule.list()
        // 获取默认规则并选中
        const defaultRule = await window.electronAPI.rule.getDefault()
        if (defaultRule) {
          selectedRuleId.value = defaultRule.id
        } else if (rules.value.length > 0) {
          selectedRuleId.value = rules.value[0].id
        }
      } catch (error) {
        console.error('加载规则失败:', error)
      }
    }

    const selectFiles = async () => {
      try {
        const filePaths = await window.electronAPI.file.select({ multiple: true })
        if (filePaths && filePaths.length > 0) {
          const newFiles = filePaths.map(path => {
            const name = path.split(/[/\\]/).pop()
            const ext = name.split('.').pop().toLowerCase()
            return {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              name: name,
              path: path,
              type: ext,
              status: 'pending',
              error: null
            }
          })
          files.value = [...files.value, ...newFiles]
        }
      } catch (error) {
        console.error('选择文件失败:', error)
      }
    }

    const clearFiles = () => {
      files.value = []
      currentTask.value = null
      results.value = []
    }

    const startBatch = async () => {
      if (files.value.length === 0) return
      
      isProcessing.value = true
      results.value = []
      
      try {
        // 创建任务
        const filePaths = files.value.map(f => f.path)
        const taskInfo = await window.electronAPI.batch.create(
          filePaths, 
          selectedRuleId.value || null,
          null
        )
        
        // 监听进度
        progressUnsubscribe = window.electronAPI.batch.onProgress((data) => {
          if (data.id === taskInfo.id) {
            currentTask.value = data
            
            // 更新文件状态
            data.files.forEach(taskFile => {
              const file = files.value.find(f => f.name === taskFile.name)
              if (file) {
                file.status = taskFile.status
                file.error = taskFile.error
              }
            })
            
            // 更新结果
            if (data.results) {
              results.value = data.results
            }
          }
        })
        
        // 开始处理
        const result = await window.electronAPI.batch.start(taskInfo.id)
        currentTask.value = result
        results.value = result.results || []
        
      } catch (error) {
        console.error('批量处理失败:', error)
        alert('批量处理失败: ' + error.message)
      } finally {
        isProcessing.value = false
        if (progressUnsubscribe) {
          progressUnsubscribe()
          progressUnsubscribe = null
        }
      }
    }

    const cancelBatch = async () => {
      if (!currentTask.value) return
      
      try {
        await window.electronAPI.batch.cancel(currentTask.value.id)
      } catch (error) {
        console.error('取消任务失败:', error)
      }
    }

    const retryFile = async (fileId) => {
      if (!currentTask.value) return
      
      isProcessing.value = true
      
      try {
        // 找到对应的任务文件ID
        const taskFile = currentTask.value.files.find(f => {
          const file = files.value.find(ff => ff.id === fileId)
          return file && f.name === file.name
        })
        
        if (taskFile) {
          await window.electronAPI.batch.retry(currentTask.value.id, taskFile.id)
        }
      } catch (error) {
        console.error('重试失败:', error)
      } finally {
        isProcessing.value = false
      }
    }

    const retryAllFailed = async () => {
      if (!currentTask.value) return
      
      isProcessing.value = true
      
      try {
        await window.electronAPI.batch.retry(currentTask.value.id)
      } catch (error) {
        console.error('重试失败:', error)
      } finally {
        isProcessing.value = false
      }
    }

    onMounted(() => {
      loadRules()
    })

    onUnmounted(() => {
      if (progressUnsubscribe) {
        progressUnsubscribe()
      }
    })

    return {
      files,
      rules,
      selectedRuleId,
      selectedRuleName,
      currentTask,
      results,
      isProcessing,
      hasFailedFiles,
      getFileIcon,
      selectFiles,
      clearFiles,
      startBatch,
      cancelBatch,
      retryFile,
      retryAllFailed
    }
  }
}
</script>


<style scoped>
.batch-panel {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #1890ff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-danger {
  background: #ff4d4f;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #ff7875;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 16px;
}

.btn-link {
  background: none;
  color: #1890ff;
  padding: 4px 8px;
}

.btn-link:hover:not(:disabled) {
  text-decoration: underline;
}

.file-list {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 500;
}

.file-items {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background: #fafafa;
}

.file-item.processing {
  background: #e6f7ff;
}

.file-item.completed {
  background: #f6ffed;
}

.file-item.error {
  background: #fff2f0;
}

.file-icon {
  font-size: 20px;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-status {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-pending {
  color: #999;
}

.status-processing {
  color: #1890ff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-completed {
  color: #52c41a;
}

.status-error {
  color: #ff4d4f;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #1890ff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 4px 0;
}

.empty-state .hint {
  font-size: 12px;
  color: #bbb;
}

.rule-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rule-selector label {
  font-weight: 500;
  color: #666;
}

.rule-selector select {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.current-rule-hint {
  font-size: 12px;
  color: #1890ff;
  margin-left: 8px;
}

.progress-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.progress-bar {
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #52c41a;
  transition: width 0.3s;
}

.progress-fill.has-error {
  background: linear-gradient(90deg, #52c41a 0%, #faad14 100%);
}

.progress-stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
}

.stat-completed {
  color: #52c41a;
}

.stat-error {
  color: #ff4d4f;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.results-section {
  border-top: 1px solid #e8e8e8;
  padding-top: 20px;
}

.results-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f6ffed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  background: #d9f7be;
}

.result-icon {
  font-size: 20px;
}

.result-name {
  flex: 1;
  font-weight: 500;
}

.result-info {
  font-size: 12px;
  color: #666;
}
</style>
