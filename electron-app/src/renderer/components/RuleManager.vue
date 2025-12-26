<template>
  <div class="rule-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>识别规则管理</span>
          <div class="header-actions">
            <el-button type="primary" size="small" @click="showCreateDialog">
              <el-icon><Plus /></el-icon>
              新建规则
            </el-button>
            <el-upload
              :show-file-list="false"
              accept=".json"
              :before-upload="importRules"
            >
              <el-button size="small">
                <el-icon><Upload /></el-icon>
                导入
              </el-button>
            </el-upload>
          </div>
        </div>
      </template>
      
      <el-table :data="rules" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="规则名称" min-width="150">
          <template #default="{ row }">
            <div class="rule-name">
              <span>{{ row.name }}</span>
              <el-tag v-if="row.isDefault" type="success" size="small">默认</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button size="small" @click="editRule(row)">编辑</el-button>
            <el-button size="small" @click="exportRule(row)">导出</el-button>
            <el-button 
              v-if="!row.isDefault" 
              type="danger" 
              size="small" 
              @click="deleteRule(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEditing ? '编辑规则' : '新建规则'"
      width="700px"
    >
      <el-form :model="currentRule" label-width="100px">
        <el-form-item label="规则名称">
          <el-input v-model="currentRule.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="currentRule.description" 
            type="textarea" 
            :rows="2"
            placeholder="请输入规则描述"
          />
        </el-form-item>
        
        <el-divider content-position="left">识别模式配置</el-divider>
        
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="一级题号模式" name="level1">
            <PatternEditor v-model="currentRule.patterns.level1" />
          </el-collapse-item>
          <el-collapse-item title="二级题号模式" name="level2">
            <PatternEditor v-model="currentRule.patterns.level2" />
          </el-collapse-item>
          <el-collapse-item title="三级题号模式" name="level3">
            <PatternEditor v-model="currentRule.patterns.level3" />
          </el-collapse-item>
          <el-collapse-item title="分数模式" name="score">
            <PatternEditor v-model="currentRule.patterns.score" />
          </el-collapse-item>
          <el-collapse-item title="括号模式" name="bracket">
            <PatternEditor v-model="currentRule.patterns.bracket" />
          </el-collapse-item>
          <el-collapse-item title="下划线模式" name="underline">
            <PatternEditor v-model="currentRule.patterns.underline" />
          </el-collapse-item>
        </el-collapse>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload } from '@element-plus/icons-vue'
import PatternEditor from './PatternEditor.vue'

const rules = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const activeCollapse = ref(['level1'])

const currentRule = reactive({
  id: null,
  name: '',
  description: '',
  patterns: {
    level1: [],
    level2: [],
    level3: [],
    score: [],
    bracket: [],
    underline: []
  }
})

onMounted(() => {
  loadRules()
})

// 加载规则列表
async function loadRules() {
  loading.value = true
  try {
    rules.value = await window.electronAPI.rule.list()
  } catch (error) {
    ElMessage.error('加载规则失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 显示创建对话框
function showCreateDialog() {
  isEditing.value = false
  resetCurrentRule()
  dialogVisible.value = true
}

// 编辑规则
function editRule(rule) {
  isEditing.value = true
  Object.assign(currentRule, {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    patterns: JSON.parse(JSON.stringify(rule.patterns))
  })
  dialogVisible.value = true
}

// 保存规则
async function saveRule() {
  if (!currentRule.name.trim()) {
    ElMessage.warning('请输入规则名称')
    return
  }
  
  try {
    await window.electronAPI.rule.save({
      id: currentRule.id,
      name: currentRule.name,
      description: currentRule.description,
      patterns: currentRule.patterns
    })
    
    ElMessage.success(isEditing.value ? '规则已更新' : '规则已创建')
    dialogVisible.value = false
    loadRules()
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

// 删除规则
async function deleteRule(rule) {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则 "${rule.name}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    await window.electronAPI.rule.delete(rule.id)
    ElMessage.success('删除成功')
    loadRules()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 导出规则
async function exportRule(rule) {
  try {
    const json = await window.electronAPI.rule.export([rule.id])
    
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rule_${rule.name}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 导入规则
async function importRules(file) {
  try {
    const text = await file.text()
    const imported = await window.electronAPI.rule.import(text)
    
    ElMessage.success(`成功导入 ${imported.length} 条规则`)
    loadRules()
  } catch (error) {
    ElMessage.error('导入失败: ' + error.message)
  }
  return false // 阻止默认上传行为
}

// 重置当前规则
function resetCurrentRule() {
  Object.assign(currentRule, {
    id: null,
    name: '',
    description: '',
    patterns: {
      level1: ['^[一二三四五六七八九十]+[、．.]', '^\\d+[、．.]'],
      level2: ['^\\d+[.．]', '^[（(]\\d+[)）]'],
      level3: ['^[（(]\\d+[)）]', '^[a-z][.．)]'],
      score: ['[（(【\\[]\\s*(\\d+)\\s*分\\s*[)）\\]】]', '(\\d+)\\s*分'],
      bracket: ['[（(][^)）]*[)）]', '[【\\[][^\\]】]*[\\]】]'],
      underline: ['_{2,}', '—{2,}']
    }
  })
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<style scoped>
.rule-manager {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.rule-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
