<template>
  <div class="app-container">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>试卷文档解析系统</h1>
          <div class="header-actions">
            <el-button type="primary" size="small" @click="activeView = 'parse'">
              <el-icon><Document /></el-icon>
              文档解析
            </el-button>
            <el-button size="small" @click="activeView = 'batch'">
              <el-icon><Files /></el-icon>
              批量处理
            </el-button>
            <!-- 文档裁剪功能暂时隐藏
            <el-button size="small" @click="activeView = 'crop'">
              <el-icon><Scissor /></el-icon>
              文档裁剪
            </el-button>
            -->
            <el-button size="small" @click="activeView = 'history'">
              <el-icon><Clock /></el-icon>
              历史记录
            </el-button>
            <el-button size="small" @click="activeView = 'rules'">
              <el-icon><Setting /></el-icon>
              规则管理
            </el-button>
          </div>
        </div>
      </el-header>
      
      <el-main>
        <!-- 文档解析视图 -->
        <div v-if="activeView === 'parse'" class="parse-view">
          <el-row :gutter="20">
            <el-col :span="10">
              <FileImport 
                @parse-complete="onParseComplete" 
                @view-result="onViewResult"
              />
            </el-col>
            <el-col :span="14">
              <ResultView :result="currentResult" />
            </el-col>
          </el-row>
        </div>
        
        <!-- 批量处理视图 -->
        <div v-else-if="activeView === 'batch'" class="batch-view">
          <el-row :gutter="20">
            <el-col :span="12">
              <BatchPanel @view-result="onViewResult" />
            </el-col>
            <el-col :span="12">
              <ResultView :result="currentResult" />
            </el-col>
          </el-row>
        </div>
        
        <!-- 文档裁剪视图 -->
        <div v-else-if="activeView === 'crop'" class="crop-view">
          <el-row :gutter="20">
            <el-col :span="12" :offset="6">
              <CropSettings />
            </el-col>
          </el-row>
        </div>
        
        <!-- 历史记录视图 -->
        <div v-else-if="activeView === 'history'" class="history-view">
          <HistoryList @view-result="onViewResult" />
        </div>
        
        <!-- 规则管理视图 -->
        <div v-else-if="activeView === 'rules'" class="rules-view">
          <RuleManager />
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Setting, Document, Clock, Files, Scissor } from '@element-plus/icons-vue'
import FileImport from './components/FileImport.vue'
import ResultView from './components/ResultView.vue'
import HistoryList from './components/HistoryList.vue'
import RuleManager from './components/RuleManager.vue'
import BatchPanel from './components/BatchPanel.vue'
import CropSettings from './components/CropSettings.vue'

const activeView = ref('parse')
const currentResult = ref(null)

// 解析完成回调
function onParseComplete(result) {
  currentResult.value = result
}

// 查看结果回调
function onViewResult(result) {
  currentResult.value = result
  if (activeView.value !== 'batch') {
    activeView.value = 'parse'
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.el-header {
  background-color: #409eff;
  color: white;
  line-height: 60px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.el-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.el-main {
  padding: 20px;
  min-height: calc(100vh - 60px);
}

.parse-view,
.batch-view,
.crop-view,
.history-view,
.rules-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
