<template>
  <div class="crop-settings">
    <div class="panel-header">
      <h3>文档裁剪</h3>
    </div>

    <div class="crop-layout">
      <!-- 左侧：设置区域 -->
      <div class="settings-panel">
        <!-- 文件选择 -->
        <div class="file-section">
          <div class="section-title">选择文件</div>
          <div class="file-input">
            <button class="btn btn-primary" @click="selectFile" :disabled="isProcessing">
              <span class="icon">📁</span> 选择文件
            </button>
            <span class="file-name" v-if="selectedFile">{{ selectedFile.name }}</span>
            <span class="file-hint" v-else>支持 .pdf, .docx 格式</span>
          </div>
        </div>

        <!-- 边距设置 -->
        <div class="margin-section">
          <div class="section-title">边距设置 (mm)</div>
          <div class="margin-inputs">
            <div class="margin-row">
              <div class="margin-input">
                <label>上</label>
                <input 
                  type="number" 
                  v-model.number="settings.top" 
                  min="0" 
                  max="500"
                  :disabled="isProcessing"
                />
              </div>
              <div class="margin-input">
                <label>下</label>
                <input 
                  type="number" 
                  v-model.number="settings.bottom" 
                  min="0" 
                  max="500"
                  :disabled="isProcessing"
                />
              </div>
            </div>
            <div class="margin-row">
              <div class="margin-input">
                <label>左</label>
                <input 
                  type="number" 
                  v-model.number="settings.left" 
                  min="0" 
                  max="500"
                  :disabled="isProcessing"
                />
              </div>
              <div class="margin-input">
                <label>右</label>
                <input 
                  type="number" 
                  v-model.number="settings.right" 
                  min="0" 
                  max="500"
                  :disabled="isProcessing"
                />
              </div>
            </div>
          </div>
          
          <!-- 快捷设置 -->
          <div class="quick-settings">
            <button class="btn btn-sm" @click="setAllMargins(0)" :disabled="isProcessing">
              清除
            </button>
            <button class="btn btn-sm" @click="setAllMargins(10)" :disabled="isProcessing">
              10mm
            </button>
            <button class="btn btn-sm" @click="setAllMargins(20)" :disabled="isProcessing">
              20mm
            </button>
            <button class="btn btn-sm" @click="setAllMargins(25)" :disabled="isProcessing">
              25mm
            </button>
          </div>
        </div>

        <!-- 输出设置 -->
        <div class="output-section">
          <div class="section-title">输出设置</div>
          <div class="output-options">
            <div class="option-row">
              <label>输出目录:</label>
              <div class="output-path">
                <input 
                  type="text" 
                  v-model="outputDir" 
                  placeholder="默认与源文件相同目录"
                  :disabled="isProcessing"
                />
                <button class="btn btn-sm" @click="selectOutputDir" :disabled="isProcessing">
                  浏览
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button 
            class="btn btn-primary btn-lg"
            @click="startCrop"
            :disabled="!canCrop || isProcessing"
          >
            <span v-if="isProcessing" class="spinner"></span>
            <span v-else class="icon">✂️</span>
            {{ isProcessing ? '处理中...' : '开始裁剪' }}
          </button>
        </div>

        <!-- 结果提示 -->
        <div class="result-message" v-if="resultMessage">
          <div :class="['message', resultMessage.type]">
            <span class="icon">{{ resultMessage.type === 'success' ? '✓' : '✗' }}</span>
            {{ resultMessage.text }}
          </div>
          <button 
            v-if="resultMessage.type === 'success' && resultMessage.path"
            class="btn btn-link"
            @click="openOutputFolder"
          >
            打开输出目录
          </button>
        </div>
      </div>

      <!-- 右侧：预览区域 -->
      <div class="preview-panel">
        <CropPreview
          :preview-image="previewData.image"
          :preview-html="previewData.html"
          :page-width="previewData.width"
          :page-height="previewData.height"
          :file-type="previewData.fileType"
          :crop-settings="settings"
          :headers="previewData.headers"
          :footers="previewData.footers"
          :margins="previewData.margins"
          @preview-error="onPreviewError"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, reactive, watch } from 'vue'
import CropPreview from './CropPreview.vue'

export default {
  name: 'CropSettings',
  components: {
    CropPreview
  },
  setup() {
    const selectedFile = ref(null)
    const pageInfo = ref(null)
    const isProcessing = ref(false)
    const resultMessage = ref(null)
    const outputDir = ref('')
    const isLoadingPreview = ref(false)
    
    const settings = ref({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    })
    
    const previewData = reactive({
      image: null,
      html: null,
      width: 0,
      height: 0,
      fileType: null,
      headers: [],
      footers: [],
      margins: null
    })

    const canCrop = computed(() => {
      return selectedFile.value && !isProcessing.value
    })

    const selectFile = async () => {
      try {
        const filePaths = await window.electronAPI.file.select({ multiple: false })
        if (filePaths && filePaths.length > 0) {
          const filePath = filePaths[0]
          const name = filePath.split(/[/\\]/).pop()
          const ext = name.split('.').pop().toLowerCase()
          
          if (ext !== 'pdf' && ext !== 'docx') {
            resultMessage.value = {
              type: 'error',
              text: '只支持 .pdf 和 .docx 格式的文件'
            }
            return
          }
          
          selectedFile.value = {
            name: name,
            path: filePath,
            type: ext
          }
          
          resultMessage.value = null
          
          // 加载预览
          await loadPreview(filePath)
        }
      } catch (error) {
        console.error('选择文件失败:', error)
        resultMessage.value = {
          type: 'error',
          text: '选择文件失败: ' + error.message
        }
      }
    }
    
    const loadPreview = async (filePath) => {
      isLoadingPreview.value = true
      try {
        const result = await window.electronAPI.crop.generatePreview(filePath)
        previewData.image = result.image || null
        previewData.html = result.html || null
        previewData.width = result.width
        previewData.height = result.height
        previewData.fileType = result.fileType
        previewData.headers = result.headers || []
        previewData.footers = result.footers || []
        previewData.margins = result.margins || null
        
        // 同时更新 pageInfo 用于显示
        pageInfo.value = {
          pageCount: 1,
          pages: [{
            width: result.width,
            height: result.height
          }]
        }
      } catch (error) {
        console.error('加载预览失败:', error)
        // 清空预览数据
        previewData.image = null
        previewData.html = null
        previewData.width = 0
        previewData.height = 0
        previewData.fileType = null
        previewData.headers = []
        previewData.footers = []
        previewData.margins = null
      } finally {
        isLoadingPreview.value = false
      }
    }
    
    const onPreviewError = (message) => {
      console.error('预览错误:', message)
    }

    const selectOutputDir = async () => {
      try {
        const dir = await window.electronAPI.file.selectOutputDir()
        if (dir) {
          outputDir.value = dir
        }
      } catch (error) {
        console.error('选择目录失败:', error)
      }
    }

    const setAllMargins = (value) => {
      settings.value.top = value
      settings.value.bottom = value
      settings.value.left = value
      settings.value.right = value
    }

    const startCrop = async () => {
      if (!selectedFile.value) return
      
      isProcessing.value = true
      resultMessage.value = null
      
      try {
        const cropSettings = {
          top: Number(settings.value.top) || 0,
          bottom: Number(settings.value.bottom) || 0,
          left: Number(settings.value.left) || 0,
          right: Number(settings.value.right) || 0
        }
        
        const validation = await window.electronAPI.crop.validateSettings(cropSettings)
        if (!validation.valid) {
          resultMessage.value = {
            type: 'error',
            text: validation.errors.join('; ')
          }
          return
        }
        
        let outputPath = null
        if (outputDir.value) {
          const ext = selectedFile.value.type
          const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
          outputPath = `${outputDir.value}/${baseName}_cropped.${ext}`
        }
        
        const result = await window.electronAPI.crop.document(
          selectedFile.value.path,
          cropSettings,
          outputPath
        )
        
        resultMessage.value = {
          type: 'success',
          text: '裁剪完成！',
          path: result
        }
        
      } catch (error) {
        console.error('裁剪失败:', error)
        resultMessage.value = {
          type: 'error',
          text: '裁剪失败: ' + error.message
        }
      } finally {
        isProcessing.value = false
      }
    }

    const openOutputFolder = () => {
      if (resultMessage.value?.path) {
        const dir = resultMessage.value.path.replace(/[/\\][^/\\]+$/, '')
        console.log('打开目录:', dir)
      }
    }

    return {
      selectedFile,
      pageInfo,
      settings,
      outputDir,
      isProcessing,
      resultMessage,
      previewData,
      isLoadingPreview,
      canCrop,
      selectFile,
      selectOutputDir,
      setAllMargins,
      startCrop,
      openOutputFolder,
      onPreviewError
    }
  }
}
</script>


<style scoped>
.crop-settings {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
}

.crop-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 700px;
}

.settings-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview-panel {
  flex: 1;
  min-width: 400px;
  min-height: 700px;
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #666;
  margin-bottom: 12px;
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
  background: #f0f0f0;
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

.btn-sm {
  padding: 4px 12px;
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

.file-section .file-input {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.file-name {
  color: #333;
  font-weight: 500;
  word-break: break-all;
}

.file-hint {
  color: #999;
  font-size: 12px;
}

.margin-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.margin-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.margin-row {
  display: flex;
  gap: 12px;
}

.margin-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.margin-input label {
  font-size: 12px;
  color: #666;
}

.margin-input input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.margin-input input:focus {
  border-color: #1890ff;
  outline: none;
}

.quick-settings {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.output-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.option-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row label {
  color: #666;
  font-size: 13px;
}

.output-path {
  display: flex;
  gap: 8px;
}

.output-path input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.output-path input:focus {
  border-color: #1890ff;
  outline: none;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
}

.message.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.message.error {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.message .icon {
  font-size: 16px;
}
</style>
