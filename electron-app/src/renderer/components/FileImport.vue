<template>
  <div class="file-import">
    <el-card class="import-card">
      <template #header>
        <div class="card-header">
          <span>文件导入</span>
          <el-button type="primary" @click="selectFiles" :loading="loading">
            <el-icon><FolderOpened /></el-icon>
            选择文件
          </el-button>
        </div>
      </template>
      
      <!-- 规则选择器 -->
      <div class="rule-selector">
        <span class="rule-label">解析规则：</span>
        <el-select 
          v-model="selectedRuleId" 
          placeholder="选择解析规则"
          :loading="rulesLoading"
          style="width: 280px"
        >
          <el-option
            v-for="rule in rules"
            :key="rule.id"
            :label="rule.name + (rule.isDefault ? ' (默认)' : '')"
            :value="rule.id"
          >
            <div class="rule-option">
              <span>{{ rule.name }}</span>
              <el-tag v-if="rule.isDefault" type="success" size="small">默认</el-tag>
            </div>
          </el-option>
        </el-select>
        <el-button 
          type="info" 
          link 
          @click="refreshRules"
          :loading="rulesLoading"
        >
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
      
      <!-- 拖拽区域 -->
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
        @click="selectFiles"
      >
        <el-icon class="drop-icon"><Upload /></el-icon>
        <p class="drop-text">拖拽文件到此处，或点击选择文件</p>
        <p class="drop-hint">支持 .doc, .docx, .pdf 格式</p>
      </div>

      <!-- 文件列表 -->
      <div v-if="files.length > 0" class="file-list">
        <el-table :data="files" style="width: 100%">
          <el-table-column prop="name" label="文件名" min-width="180">
            <template #default="{ row }">
              <div class="file-name">
                <el-icon><Document /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="getTypeTagType(row.type)">
                {{ row.type.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ruleName" label="解析规则" width="140">
            <template #default="{ row }">
              <span v-if="row.ruleName" class="rule-name-cell">{{ row.ruleName }}</span>
              <span v-else class="rule-name-pending">待解析</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button 
                v-if="row.status === 'pending'" 
                type="primary" 
                size="small"
                @click="parseFile(row)"
                :loading="row.status === 'processing'"
              >
                解析
              </el-button>
              <el-button 
                v-if="row.status === 'completed'" 
                type="success" 
                size="small"
                @click="viewResult(row)"
              >
                查看
              </el-button>
              <el-button 
                v-if="row.status === 'error'" 
                type="warning" 
                size="small"
                @click="parseFile(row)"
              >
                重试
              </el-button>
              <el-button 
                type="danger" 
                size="small" 
                @click="removeFile(row)"
                :icon="Delete"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 批量操作 -->
      <div v-if="files.length > 0" class="batch-actions">
        <el-button type="primary" @click="parseAllFiles" :loading="loading">
          解析全部
        </el-button>
        <el-button @click="clearFiles">清空列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload, FolderOpened, Document, Delete, Refresh } from '@element-plus/icons-vue'

const emit = defineEmits(['parse-complete', 'view-result'])

const files = ref([])
const loading = ref(false)
const isDragOver = ref(false)

// 规则相关状态
const rules = ref([])
const selectedRuleId = ref(null)
const rulesLoading = ref(false)

// 组件加载时获取规则列表
onMounted(() => {
  loadRules()
})

// 加载规则列表
async function loadRules() {
  rulesLoading.value = true
  try {
    // 获取所有规则
    rules.value = await window.electronAPI.rule.list()
    
    // 获取默认规则并选中
    const defaultRule = await window.electronAPI.rule.getDefault()
    if (defaultRule) {
      selectedRuleId.value = defaultRule.id
    } else if (rules.value.length > 0) {
      // 如果没有默认规则，选中第一个
      selectedRuleId.value = rules.value[0].id
    }
  } catch (error) {
    ElMessage.error('加载规则列表失败: ' + error.message)
  } finally {
    rulesLoading.value = false
  }
}

// 刷新规则列表
async function refreshRules() {
  await loadRules()
  ElMessage.success('规则列表已刷新')
}

// 获取当前选中的规则名称
function getSelectedRuleName() {
  const rule = rules.value.find(r => r.id === selectedRuleId.value)
  return rule ? rule.name : '默认规则'
}

// 选择文件
async function selectFiles() {
  try {
    const filePaths = await window.electronAPI.file.select({ multiple: true })
    if (filePaths && filePaths.length > 0) {
      addFiles(filePaths)
    }
  } catch (error) {
    ElMessage.error('选择文件失败: ' + error.message)
  }
}

// 添加文件到列表
function addFiles(filePaths) {
  for (const filePath of filePaths) {
    // 检查是否已存在
    if (files.value.some(f => f.path === filePath)) {
      continue
    }
    
    const name = filePath.split(/[/\\]/).pop()
    const ext = name.split('.').pop().toLowerCase()
    
    // 检查文件格式
    if (!['doc', 'docx', 'pdf'].includes(ext)) {
      ElMessage.warning(`不支持的文件格式: ${name}`)
      continue
    }
    
    files.value.push({
      id: Date.now() + Math.random(),
      name,
      path: filePath,
      type: ext,
      status: 'pending',
      result: null,
      error: null,
      ruleId: null,
      ruleName: null
    })
  }
}

// 拖拽事件
function onDragOver(e) {
  isDragOver.value = true
}

function onDragLeave(e) {
  isDragOver.value = false
}

function onDrop(e) {
  isDragOver.value = false
  const droppedFiles = Array.from(e.dataTransfer.files)
  const filePaths = droppedFiles.map(f => f.path)
  addFiles(filePaths)
}

// 解析单个文件
async function parseFile(file) {
  file.status = 'processing'
  file.error = null
  
  try {
    // 使用选中的规则ID进行解析
    const result = await window.electronAPI.file.parse(file.path, selectedRuleId.value)
    file.status = 'completed'
    file.result = result
    file.ruleId = selectedRuleId.value
    file.ruleName = getSelectedRuleName()
    emit('parse-complete', result)
    ElMessage.success(`${file.name} 解析完成`)
  } catch (error) {
    file.status = 'error'
    file.error = error.message
    ElMessage.error(`${file.name} 解析失败: ${error.message}`)
  }
}

// 解析所有文件
async function parseAllFiles() {
  loading.value = true
  const pendingFiles = files.value.filter(f => f.status === 'pending' || f.status === 'error')
  
  for (const file of pendingFiles) {
    await parseFile(file)
  }
  
  loading.value = false
}

// 查看结果
function viewResult(file) {
  if (file.result) {
    emit('view-result', file.result)
  }
}

// 移除文件
function removeFile(file) {
  const index = files.value.findIndex(f => f.id === file.id)
  if (index > -1) {
    files.value.splice(index, 1)
  }
}

// 清空列表
function clearFiles() {
  files.value = []
}

// 获取类型标签样式
function getTypeTagType(type) {
  const types = {
    'docx': 'primary',
    'doc': 'primary',
    'pdf': 'danger'
  }
  return types[type] || 'info'
}

// 获取状态标签样式
function getStatusTagType(status) {
  const types = {
    'pending': 'info',
    'processing': 'warning',
    'completed': 'success',
    'error': 'danger'
  }
  return types[status] || 'info'
}

// 获取状态文本
function getStatusText(status) {
  const texts = {
    'pending': '待解析',
    'processing': '解析中',
    'completed': '已完成',
    'error': '失败'
  }
  return texts[status] || status
}
</script>

<style scoped>
.file-import {
  width: 100%;
}

.import-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rule-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 6px;
}

.rule-label {
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.rule-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.drop-zone {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.drop-icon {
  font-size: 48px;
  color: #909399;
  margin-bottom: 16px;
}

.drop-text {
  font-size: 16px;
  color: #606266;
  margin-bottom: 8px;
}

.drop-hint {
  font-size: 12px;
  color: #909399;
}

.file-list {
  margin-top: 20px;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-name-cell {
  color: #409eff;
  font-size: 13px;
}

.rule-name-pending {
  color: #909399;
  font-size: 13px;
  font-style: italic;
}

.batch-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}
</style>
