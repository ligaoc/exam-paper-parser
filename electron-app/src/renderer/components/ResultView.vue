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
        <!-- 完整内容 -->
        <el-tab-pane label="完整内容" name="fullContent">
          <div class="full-content-panel">
            <div class="content-stats">
              <el-tag type="info">{{ contentBlockStats.paragraphs }} 个段落</el-tag>
              <el-tag type="success">{{ contentBlockStats.tables }} 个表格</el-tag>
              <el-tag type="warning">{{ contentBlockStats.images }} 张图片</el-tag>
            </div>
            <div v-if="result.contentBlocks?.length" class="content-blocks">
              <template v-for="(block, index) in result.contentBlocks" :key="index">
                <!-- 段落 -->
                <div v-if="block.type === 'paragraph'" class="content-paragraph">
                  {{ block.content }}
                </div>
                <!-- 表格 -->
                <div v-else-if="block.type === 'table'" class="content-table">
                  <div class="content-table-wrapper" v-html="block.content.html"></div>
                </div>
                <!-- 图片 -->
                <div v-else-if="block.type === 'image'" class="content-image">
                  <img :src="block.content.dataUrl" :alt="'图片 ' + (block.content.position + 1)" />
                </div>
              </template>
            </div>
            <el-empty v-else description="未解析到内容" />
          </div>
        </el-tab-pane>
        
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
            <!-- 总体统计 -->
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
            
            <!-- 按级别统计 -->
            <div v-if="levelStats.length > 0" class="level-stats">
              <h4>按级别统计</h4>
              <el-table :data="levelStats" style="width: 100%" size="small">
                <el-table-column prop="levelName" label="级别" width="120" />
                <el-table-column prop="totalCount" label="题目数" width="100" />
                <el-table-column prop="withScoreCount" label="有分数题目" width="120" />
                <el-table-column prop="totalScore" label="分数总和" width="100">
                  <template #default="{ row }">
                    {{ row.totalScore }} 分
                  </template>
                </el-table-column>
              </el-table>
            </div>
            
            <!-- 分数详情（树形结构） -->
            <div class="score-list">
              <h4>分数详情</h4>
              <el-tree
                v-if="treeData.length"
                :data="treeData"
                :props="{ children: 'children', label: 'number' }"
                default-expand-all
                :expand-on-click-node="false"
              >
                <template #default="{ node, data }">
                  <div class="score-tree-node">
                    <span class="node-number">{{ data.number }}</span>
                    <span class="node-content">{{ truncate(data.content, 40) }}</span>
                    <el-tag v-if="data.score" type="warning" size="small">{{ data.score }}分</el-tag>
                    <el-tag type="info" size="small">{{ data.level }}级</el-tag>
                  </div>
                </template>
              </el-tree>
              <el-empty v-else description="未识别到题目" :image-size="60" />
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
        
        <!-- 表格识别 -->
        <el-tab-pane label="表格识别" name="tables">
          <div class="tables-panel">
            <el-statistic title="识别到的表格数量" :value="result.tables?.length || 0" />
            <div v-if="result.tables?.length" class="tables-list">
              <div v-for="(table, index) in result.tables" :key="table.id" class="table-item">
                <div class="table-header">
                  <span class="table-title">表格 {{ index + 1 }}</span>
                  <el-tag size="small">{{ table.rowCount }}行 × {{ table.colCount }}列</el-tag>
                </div>
                <div class="table-content" v-html="table.html"></div>
              </div>
            </div>
            <el-empty v-else description="未识别到表格" :image-size="100" />
          </div>
        </el-tab-pane>
        
        <!-- 图片识别 -->
        <el-tab-pane label="图片识别" name="images">
          <div class="images-panel">
            <el-statistic title="识别到的图片数量" :value="result.images?.length || 0" />
            <div v-if="result.images?.length" class="images-list">
              <div v-for="(image, index) in result.images" :key="image.id" class="image-item">
                <div class="image-header">
                  <span class="image-title">图片 {{ index + 1 }}</span>
                  <el-tag size="small">{{ image.fileName }}</el-tag>
                </div>
                <div class="image-content">
                  <img :src="image.dataUrl" :alt="'图片 ' + (index + 1)" />
                </div>
              </div>
            </div>
            <el-empty v-else description="未识别到图片" :image-size="100" />
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

const activeTab = ref('fullContent')

// 内容块统计
const contentBlockStats = computed(() => {
  const blocks = props.result?.contentBlocks || []
  return {
    paragraphs: blocks.filter(b => b.type === 'paragraph').length,
    tables: blocks.filter(b => b.type === 'table').length,
    images: blocks.filter(b => b.type === 'image').length
  }
})

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

// 中文数字映射
const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

// 按级别统计
const levelStats = computed(() => {
  const stats = new Map()
  
  function processQuestion(question) {
    const level = question.level || 1
    if (!stats.has(level)) {
      const levelName = level <= 10 ? `${chineseNumbers[level - 1]}级题号` : `${level}级题号`
      stats.set(level, {
        level,
        levelName,
        totalCount: 0,
        withScoreCount: 0,
        totalScore: 0
      })
    }
    
    const stat = stats.get(level)
    stat.totalCount++
    if (question.score) {
      stat.withScoreCount++
      stat.totalScore += question.score
    }
    
    // 递归处理子题目
    if (question.children) {
      question.children.forEach(processQuestion)
    }
  }
  
  (props.result?.structure || []).forEach(processQuestion)
  
  return [...stats.values()].sort((a, b) => a.level - b.level)
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

.level-stats {
  margin-top: 20px;
}

.level-stats h4 {
  margin-bottom: 10px;
  color: #303133;
}

.score-tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  width: 100%;
}

.score-tree-node .node-number {
  font-weight: 500;
  color: #409eff;
  min-width: 50px;
}

.score-tree-node .node-content {
  color: #606266;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.tables-panel {
  padding: 10px 0;
}

.tables-list {
  margin-top: 20px;
}

.table-item {
  margin-bottom: 24px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}

.table-title {
  font-weight: 500;
  color: #303133;
}

.table-content {
  padding: 16px;
  overflow-x: auto;
}

.table-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table-content :deep(th),
.table-content :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 8px 12px;
  text-align: left;
}

.table-content :deep(th) {
  background: #f5f7fa;
  font-weight: 500;
  color: #303133;
}

.table-content :deep(td) {
  color: #606266;
}

.table-content :deep(tr:hover td) {
  background: #f5f7fa;
}

/* 完整内容面板样式 */
.full-content-panel {
  padding: 10px 0;
}

.content-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.content-blocks {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 20px;
  max-height: 600px;
  overflow-y: auto;
}

.content-paragraph {
  margin-bottom: 12px;
  line-height: 1.8;
  color: #303133;
  text-align: justify;
}

.content-paragraph:last-child {
  margin-bottom: 0;
}

.content-table {
  margin: 16px 0;
  overflow-x: auto;
}

.content-table-wrapper {
  display: inline-block;
  min-width: 100%;
}

.content-table-wrapper :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 0;
}

.content-table-wrapper :deep(th),
.content-table-wrapper :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 8px 12px;
  text-align: left;
}

.content-table-wrapper :deep(th) {
  background: #f5f7fa;
  font-weight: 500;
  color: #303133;
}

.content-table-wrapper :deep(td) {
  color: #606266;
}

.content-table-wrapper :deep(tr:hover td) {
  background: #fafafa;
}

/* 图片面板样式 */
.images-panel {
  padding: 10px 0;
}

.images-list {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.image-item {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.image-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}

.image-title {
  font-weight: 500;
  color: #303133;
}

.image-content {
  padding: 16px;
  text-align: center;
  background: #fafafa;
}

.image-content img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 4px;
}

/* 完整内容中的图片样式 */
.content-image {
  margin: 16px 0;
  text-align: center;
}

.content-image img {
  max-width: 100%;
  max-height: 500px;
  object-fit: contain;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 8px;
  background: #fafafa;
}
</style>
