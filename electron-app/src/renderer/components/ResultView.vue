<template>
  <div class="result-view">
    <el-card v-if="result" class="result-card">
      <template #header>
        <div class="card-header">
          <div class="file-info">
            <el-icon><Document /></el-icon>
            <span class="file-name">{{ result.fileName }}</span>
            <el-tag size="small" :type="result.fileType === 'pdf' ? 'danger' : 'primary'">
              {{ result.fileType.toUpperCase() }}
            </el-tag>
          </div>
          <div class="actions">
            <el-button size="small" @click="exportResult">
              <el-icon><Download /></el-icon>
              导出JSON
            </el-button>
          </div>
        </div>
      </template>
      
      <el-tabs v-model="activeTab">
        <!-- 题目结构 -->
        <el-tab-pane label="题目结构" name="structure">
          <div class="structure-tree">
            <el-tree
              :data="treeData"
              :props="treeProps"
              default-expand-all
              :expand-on-click-node="false"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <span class="node-number">{{ data.number }}</span>
                  <span class="node-content">{{ truncate(data.content, 50) }}</span>
                  <el-tag v-if="data.score" type="warning" size="small" class="node-score">
                    {{ data.score }}分
                  </el-tag>
                </div>
              </template>
            </el-tree>
            <el-empty v-if="!treeData.length" description="未识别到题目结构" />
          </div>
        </el-tab-pane>
        
        <!-- 分数统计 -->
        <el-tab-pane label="分数统计" name="scores">
          <div class="scores-panel">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="总题数">
                {{ totalQuestions }}
              </el-descriptions-item>
              <el-descriptions-item label="有分数的题目">
                {{ questionsWithScore }}
              </el-descriptions-item>
              <el-descriptions-item label="识别到的分数总和">
                {{ totalScore }} 分
              </el-descriptions-item>
              <el-descriptions-item label="解析耗时">
                {{ result.parseTime }} ms
              </el-descriptions-item>
            </el-descriptions>
            
            <div class="score-list">
              <h4>分数详情</h4>
              <el-table :data="scoreList" style="width: 100%" max-height="300">
                <el-table-column prop="number" label="题号" width="100" />
                <el-table-column prop="content" label="内容" show-overflow-tooltip />
                <el-table-column prop="score" label="分数" width="80">
                  <template #default="{ row }">
                    <span v-if="row.score">{{ row.score }}分</span>
                    <span v-else class="no-score">-</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>
        
        <!-- 括号识别 -->
        <el-tab-pane label="括号识别" name="brackets">
          <div class="brackets-panel">
            <el-statistic title="识别到的括号数量" :value="result.brackets?.length || 0" />
            <el-table :data="result.brackets || []" style="width: 100%; margin-top: 20px" max-height="400">
              <el-table-column prop="index" label="位置" width="80" />
              <el-table-column prop="content" label="内容" show-overflow-tooltip />
              <el-table-column prop="type" label="类型" width="100">
                <template #default="{ row }">
                  {{ getBracketTypeName(row.type) }}
                </template>
              </el-table-column>
              <el-table-column prop="hasScore" label="含分数" width="80">
                <template #default="{ row }">
                  <el-tag v-if="row.hasScore" type="success" size="small">是</el-tag>
                  <el-tag v-else type="info" size="small">否</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        
        <!-- 下划线识别 -->
        <el-tab-pane label="下划线识别" name="underlines">
          <div class="underlines-panel">
            <el-statistic title="识别到的下划线数量" :value="result.underlines?.length || 0" />
            <el-table :data="result.underlines || []" style="width: 100%; margin-top: 20px" max-height="400">
              <el-table-column prop="index" label="位置" width="80" />
              <el-table-column prop="length" label="长度" width="80" />
              <el-table-column prop="type" label="类型" width="120">
                <template #default="{ row }">
                  {{ getUnderlineTypeName(row.type) }}
                </template>
              </el-table-column>
              <el-table-column prop="content" label="内容" show-overflow-tooltip />
            </el-table>
          </div>
        </el-tab-pane>
        
        <!-- 页眉页脚 -->
        <el-tab-pane label="页眉页脚" name="headers">
          <div class="headers-panel">
            <div class="section">
              <h4>页眉</h4>
              <div v-if="result.headers?.length" class="header-list">
                <div v-for="(header, index) in result.headers" :key="index" class="header-item">
                  {{ header }}
                </div>
              </div>
              <el-empty v-else description="未识别到页眉" :image-size="60" />
            </div>
            <el-divider />
            <div class="section">
              <h4>页脚</h4>
              <div v-if="result.footers?.length" class="footer-list">
                <div v-for="(footer, index) in result.footers" :key="index" class="footer-item">
                  {{ footer }}
                </div>
              </div>
              <el-empty v-else description="未识别到页脚" :image-size="60" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
    
    <el-empty v-else description="请先选择并解析文件" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Download } from '@element-plus/icons-vue'

const props = defineProps({
  result: {
    type: Object,
    default: null
  }
})

const activeTab = ref('structure')

// 树形数据
const treeData = computed(() => {
  if (!props.result?.structure) return []
  return props.result.structure
})

const treeProps = {
  children: 'children',
  label: 'number'
}

// 统计数据
const totalQuestions = computed(() => {
  return countQuestions(props.result?.structure || [])
})

const questionsWithScore = computed(() => {
  return countQuestionsWithScore(props.result?.structure || [])
})

const totalScore = computed(() => {
  return sumScores(props.result?.structure || [])
})

const scoreList = computed(() => {
  return flattenQuestions(props.result?.structure || [])
})

// 递归计算题目数量
function countQuestions(questions) {
  let count = 0
  for (const q of questions) {
    count++
    if (q.children) {
      count += countQuestions(q.children)
    }
  }
  return count
}

// 递归计算有分数的题目数量
function countQuestionsWithScore(questions) {
  let count = 0
  for (const q of questions) {
    if (q.score) count++
    if (q.children) {
      count += countQuestionsWithScore(q.children)
    }
  }
  return count
}

// 递归计算分数总和
function sumScores(questions) {
  let sum = 0
  for (const q of questions) {
    if (q.score) sum += q.score
    if (q.children) {
      sum += sumScores(q.children)
    }
  }
  return sum
}

// 扁平化题目列表
function flattenQuestions(questions, result = []) {
  for (const q of questions) {
    result.push({
      number: q.number,
      content: q.content,
      score: q.score
    })
    if (q.children) {
      flattenQuestions(q.children, result)
    }
  }
  return result
}

// 截断文本
function truncate(text, length) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

// 获取括号类型名称
function getBracketTypeName(type) {
  const names = {
    'chinese': '中文括号',
    'small': '小括号',
    'medium': '中括号',
    'large': '大括号',
    'square': '方括号'
  }
  return names[type] || type
}

// 获取下划线类型名称
function getUnderlineTypeName(type) {
  const names = {
    'english': '英文下划线',
    'chinese_dash': '中文破折号',
    'chinese_underline': '中文下划线'
  }
  return names[type] || type
}

// 导出结果
async function exportResult() {
  if (!props.result) return
  
  try {
    const json = await window.electronAPI.history.export(props.result.id)
    
    // 创建下载
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.result.fileName.replace(/\.[^.]+$/, '')}_result.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}
</script>

<style scoped>
.result-view {
  width: 100%;
}

.result-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  font-weight: 500;
}

.structure-tree {
  padding: 10px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.node-number {
  font-weight: 500;
  color: #409eff;
  min-width: 40px;
}

.node-content {
  color: #606266;
  flex: 1;
}

.node-score {
  margin-left: auto;
}

.scores-panel,
.brackets-panel,
.underlines-panel,
.headers-panel {
  padding: 10px 0;
}

.score-list {
  margin-top: 20px;
}

.score-list h4 {
  margin-bottom: 10px;
  color: #303133;
}

.no-score {
  color: #c0c4cc;
}

.section h4 {
  margin-bottom: 10px;
  color: #303133;
}

.header-item,
.footer-item {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
}
</style>
