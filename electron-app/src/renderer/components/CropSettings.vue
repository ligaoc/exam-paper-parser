<template>
  <div class="crop-settings">
    <div class="panel-header">
      <h3>文档裁剪</h3>
    </div>

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

    <!-- 页面信息 -->
    <div class="page-info" v-if="pageInfo">
      <div class="section-title">页面信息</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">页数:</span>
          <span class="value">{{ pageInfo.pageCount }}</span>
        </div>
        <div class="info-item" v-if="pageInfo.pages && pageInfo.pages[0]">
          <span class="label">尺寸:</span>
          <span class="value">
            {{ pageInfo.pages[0].width.toFixed(1) }} × {{ pageInfo.pages[0].height.toFixed(1) }} mm
          </span>
        </div>
      </div>
    </div>

    <!-- 边距设置 -->
    <div class="margin-section">
      <div class="section-title">边距设置 (mm)</div>
      <div class="margin-preview">
        <div class="preview-box">
          <div class="margin-input top">
            <input 
              type="number" 
              v-model.number="settings.top" 
              min="0" 
              max="500"
              :disabled="isProcessing"
            />
            <span class="label">上</span>
          </div>
          <div class="margin-row">
            <div class="margin-input left">
              <input 
                type="number" 
                v-model.number="settings.left" 
                min="0" 
                max="500"
                :disabled="isProcessing"
              />
              <span class="label">左</span>
            </div>
            <div class="page-preview">
              <div class="page-content">
                <div class="content-lines">
                  <div class="line"></div>
                  <div class="line"></div>
                  <div class="line short"></div>
                  <div class="line"></div>
                  <div class="line short"></div>
                </div>
              </div>
            </div>
            <div class="margin-input right">
              <input 
                type="number" 
                v-model.number="settings.right" 
                min="0" 
                max="500"
                :disabled="isProcessing"
              />
              <span class="label">右</span>
            </div>
          </div>
          <div class="margin-input bottom">
            <input 
              type="number" 
              v-model.number="settings.bottom" 
              min="0" 
              max="500"
              :disabled="isProcessing"
            />
            <span class="label">下</span>
          </div>
        </div>
      </div>
      
      <!-- 快捷设置 -->
      <div class="quick-settings">
        <button class="btn btn-sm" @click="setAllMargins(0)" :disabled="isProcessing">
          清除边距
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
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'CropSettings',
  setup() {
    const selectedFile = ref(null)
    const pageInfo = ref(null)
    const isProcessing = ref(false)
    const resultMessage = ref(null)
    const outputDir = ref('')
    
    const settings = ref({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
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
          
          // 如果是 PDF，获取页面信息
          if (ext === 'pdf') {
            try {
              pageInfo.value = await window.electronAPI.crop.getPdfInfo(filePath)
            } catch (error) {
              console.error('获取页面信息失败:', error)
              pageInfo.value = null
            }
          } else {
            pageInfo.value = null
          }
        }
      } catch (error) {
        console.error('选择文件失败:', error)
        resultMessage.value = {
          type: 'error',
          text: '选择文件失败: ' + error.message
        }
      }
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
        // 验证设置
        const validation = await window.electronAPI.crop.validateSettings(settings.value)
        if (!validation.valid) {
          resultMessage.value = {
            type: 'error',
            text: validation.errors.join('; ')
          }
          return
        }
        
        // 生成输出路径
        let outputPath = null
        if (outputDir.value) {
          const ext = selectedFile.value.type
          const baseName = selectedFile.value.name.replace(/\.[^.]+$/, '')
          outputPath = `${outputDir.value}/${baseName}_cropped.${ext}`
        }
        
        // 执行裁剪
        const result = await window.electronAPI.crop.document(
          selectedFile.value.path,
          settings.value,
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
        // 使用 shell 打开文件所在目录
        const dir = resultMessage.value.path.replace(/[/\\][^/\\]+$/, '')
        // 这里可以通过 IPC 调用 shell.openPath
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
      canCrop,
      selectFile,
      selectOutputDir,
      setAllMargins,
      startCrop,
      openOutputFolder
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
  gap: 24px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
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
}

.file-name {
  color: #333;
  font-weight: 500;
}

.file-hint {
  color: #999;
  font-size: 12px;
}

.page-info {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
}

.info-grid {
  display: flex;
  gap: 24px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-item .label {
  color: #666;
}

.info-item .value {
  color: #333;
  font-weight: 500;
}

.margin-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
}

.margin-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.margin-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.margin-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.margin-input input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}

.margin-input input:focus {
  border-color: #1890ff;
  outline: none;
}

.margin-input .label {
  font-size: 12px;
  color: #999;
}

.page-preview {
  width: 120px;
  height: 160px;
  background: white;
  border: 2px solid #d9d9d9;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-content {
  width: 80%;
  height: 80%;
}

.content-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
}

.line.short {
  width: 60%;
}

.quick-settings {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.output-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.option-row label {
  color: #666;
  white-space: nowrap;
}

.output-path {
  flex: 1;
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
