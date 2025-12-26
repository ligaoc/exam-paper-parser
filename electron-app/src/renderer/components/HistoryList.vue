<template>
  <div class="history-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>历史记录</span>
          <el-button size="small" @click="loadHistory">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>
      
      <el-table :data="historyList" style="width: 100%" v-loading="loading">
        <el-table-column prop="fileName" label="文件名" min-width="200">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon><Document /></el-icon>
              <span>{{ row.fileName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="fileType" label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.fileType === 'pdf' ? 'danger' : 'primary'">
              {{ row.fileType.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="题目数" width="80">
          <template #default="{ row }">
            {{ countQuestions(row.structure) }}
          </template>
        </el-table-column>
        <el-table-column prop="parseTime" label="耗时" width="80">
          <template #default="{ row }">
            {{ row.parseTime }}ms
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="解析时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewResult(row)">
              查看
            </el-button>
            <el-button type="danger" size="small" @click="deleteRecord(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty v-if="!loading && historyList.length === 0" description="暂无历史记录" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Refresh } from '@element-plus/icons-vue'

const emit = defineEmits(['view-result'])

const historyList = ref([])
const loading = ref(false)

onMounted(() => {
  loadHistory()
})

// 加载历史记录
async function loadHistory() {
  loading.value = true
  try {
    historyList.value = await window.electronAPI.history.list(100)
  } catch (error) {
    ElMessage.error('加载历史记录失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 查看结果
function viewResult(record) {
  emit('view-result', record)
}

// 删除记录
async function deleteRecord(record) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 "${record.fileName}" 的解析记录吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    await window.electronAPI.history.delete(record.id)
    ElMessage.success('删除成功')
    loadHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 计算题目数量
function countQuestions(structure) {
  if (!structure) return 0
  let count = 0
  function traverse(items) {
    for (const item of items) {
      count++
      if (item.children) {
        traverse(item.children)
      }
    }
  }
  traverse(structure)
  return count
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.history-list {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
