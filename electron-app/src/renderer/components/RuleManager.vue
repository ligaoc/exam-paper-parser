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
      width="750px"
      top="5vh"
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
        
        <el-divider content-position="left">题号级别配置</el-divider>
        
        <!-- 动态题号级别 -->
        <div class="levels-section">
          <div 
            v-for="(level, index) in currentRule.patterns.levels" 
            :key="index"
            class="level-item"
          >
            <div class="level-header">
              <span class="level-title">{{ level.name }}</span>
              <el-button 
                v-if="currentRule.patterns.levels.length > 1"
                type="danger" 
                text 
                size="small"
                @click="removeLevel(index)"
              >
                <el-icon><Delete /></el-icon>
                删除级别
              </el-button>
            </div>
            
            <!-- 题号模式 -->
            <div class="level-section">
              <span class="section-label">题号模式</span>
              <PatternSelector 
                v-model="level.patterns" 
                category="question"
              />
            </div>
            
            <!-- 分数模式（级别专属） -->
            <div class="level-section">
              <span class="section-label">分数模式</span>
              <PatternSelector 
                v-model="level.scorePatterns" 
                category="score"
              />
            </div>
          </div>
          
          <el-button type="primary" text @click="addLevel">
            <el-icon><Plus /></el-icon>
            添加题号级别
          </el-button>
        </div>
        
        <el-divider content-position="left">其他模式配置</el-divider>
        
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="括号模式" name="bracket">
            <PatternSelector 
              v-model="currentRule.patterns.bracket" 
              category="bracket"
            />
          </el-collapse-item>
          <el-collapse-item title="下划线模式" name="underline">
            <PatternSelector 
              v-model="currentRule.patterns.underline" 
              category="underline"
            />
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
import { Plus, Upload, Delete } from '@element-plus/icons-vue'
import PatternSelector from './PatternSelector.vue'

const rules = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const activeCollapse = ref(['bracket'])

// 中文数字映射
const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

const currentRule = reactive({
  id: null,
  name: '',
  description: '',
  patterns: {
    levels: [
      { name: '一级题号', patterns: [], scorePatterns: [] },
      { name: '二级题号', patterns: [], scorePatterns: [] },
      { name: '三级题号', patterns: [], scorePatterns: [] }
    ],
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
  
  // 迁移旧格式数据
  const patterns = migratePatterns(rule.patterns)
  
  Object.assign(currentRule, {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    patterns: JSON.parse(JSON.stringify(patterns))
  })
  dialogVisible.value = true
}

// 迁移旧格式数据到新格式
function migratePatterns(oldPatterns) {
  // 如果已经是新格式（有 levels 数组且包含 scorePatterns），直接返回
  if (oldPatterns.levels && 
      Array.isArray(oldPatterns.levels) && 
      oldPatterns.levels.length > 0 &&
      oldPatterns.levels[0].scorePatterns !== undefined) {
    // 确保没有全局 score 字段
    const { score, ...rest } = oldPatterns
    return rest
  }
  
  // 如果有 levels 但没有 scorePatterns，需要迁移
  if (oldPatterns.levels && Array.isArray(oldPatterns.levels)) {
    const globalScorePatterns = oldPatterns.score || []
    const newLevels = oldPatterns.levels.map(level => ({
      name: level.name,
      patterns: level.patterns || [],
      scorePatterns: level.scorePatterns || [...globalScorePatterns]
    }))
    
    return {
      levels: newLevels,
      bracket: oldPatterns.bracket || [],
      underline: oldPatterns.underline || []
    }
  }
  
  // 转换最旧格式（level1/level2/level3）到新格式
  const globalScorePatterns = oldPatterns.score || []
  return {
    levels: [
      { name: '一级题号', patterns: oldPatterns.level1 || [], scorePatterns: [...globalScorePatterns] },
      { name: '二级题号', patterns: oldPatterns.level2 || [], scorePatterns: [...globalScorePatterns] },
      { name: '三级题号', patterns: oldPatterns.level3 || [], scorePatterns: [...globalScorePatterns] }
    ],
    bracket: oldPatterns.bracket || [],
    underline: oldPatterns.underline || []
  }
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

// 添加题号级别
function addLevel() {
  const levelCount = currentRule.patterns.levels.length
  const levelName = levelCount < 10 
    ? `${chineseNumbers[levelCount]}级题号` 
    : `${levelCount + 1}级题号`
  
  currentRule.patterns.levels.push({
    name: levelName,
    patterns: [],
    scorePatterns: []
  })
}

// 删除题号级别
function removeLevel(index) {
  if (currentRule.patterns.levels.length <= 1) {
    ElMessage.warning('至少需要保留一个题号级别')
    return
  }
  currentRule.patterns.levels.splice(index, 1)
}

// 重置当前规则
function resetCurrentRule() {
  Object.assign(currentRule, {
    id: null,
    name: '',
    description: '',
    patterns: {
      levels: [
        { name: '一级题号', patterns: [], scorePatterns: [] },
        { name: '二级题号', patterns: [], scorePatterns: [] },
        { name: '三级题号', patterns: [], scorePatterns: [] }
      ],
      bracket: [],
      underline: []
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

.levels-section {
  padding: 0 10px;
}

.level-item {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.level-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.level-section {
  margin-bottom: 12px;
}

.level-section:last-child {
  margin-bottom: 0;
}

.section-label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
  font-weight: 500;
}
</style>
