<template>
  <div class="ignore-pattern-selector">
    <!-- 下拉选择框 -->
    <el-select
      v-model="selectedPresetId"
      placeholder="选择预设忽略模式..."
      filterable
      clearable
      @change="handlePresetSelect"
      style="width: 100%; margin-bottom: 10px;"
    >
      <el-option
        v-for="preset in availablePresets"
        :key="preset.id"
        :label="preset.label"
        :value="preset.id"
      >
        <div class="preset-option">
          <span class="preset-label">{{ preset.label }}</span>
          <el-tag size="small" :type="preset.type === 'keyword' ? 'success' : 'primary'">
            {{ preset.type === 'keyword' ? '关键词' : '正则' }}
          </el-tag>
        </div>
      </el-option>
    </el-select>

    <!-- 已选模式列表 -->
    <div class="selected-patterns">
      <el-tag
        v-for="(item, index) in modelValue"
        :key="index"
        closable
        :type="item.type === 'keyword' ? 'success' : 'primary'"
        @close="removePattern(index)"
        class="pattern-tag"
      >
        <span class="pattern-type">[{{ item.type === 'keyword' ? '关键词' : '正则' }}]</span>
        <span class="pattern-display">{{ item.pattern }}</span>
      </el-tag>
    </div>

    <!-- 自定义模式输入 -->
    <div class="custom-input-section">
      <el-button 
        v-if="!showCustomInput" 
        type="primary" 
        text 
        size="small"
        @click="showCustomInput = true"
      >
        <el-icon><Plus /></el-icon>
        添加自定义忽略模式
      </el-button>
      
      <div v-else class="custom-input-form">
        <div class="custom-input-row">
          <el-select v-model="customType" size="small" style="width: 100px;">
            <el-option label="关键词" value="keyword" />
            <el-option label="正则" value="regex" />
          </el-select>
          <el-input
            v-model="customPattern"
            :placeholder="customType === 'keyword' ? '输入要忽略的关键词' : '输入正则表达式'"
            size="small"
            :class="{ 'is-error': customError }"
            @keyup.enter="addCustomPattern"
          />
        </div>
        <div class="custom-input-actions">
          <el-button type="primary" size="small" @click="addCustomPattern">添加</el-button>
          <el-button size="small" @click="cancelCustomInput">取消</el-button>
        </div>
        <div v-if="customError" class="error-message">{{ customError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getIgnorePresets } from '../utils/patternPresets'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

// 状态
const selectedPresetId = ref('')
const showCustomInput = ref(false)
const customPattern = ref('')
const customType = ref('keyword')
const customError = ref('')

// 获取可用预设
const availablePresets = computed(() => {
  return getIgnorePresets()
})

// 选择预设
function handlePresetSelect(presetId) {
  if (!presetId) return
  
  const preset = availablePresets.value.find(p => p.id === presetId)
  if (preset) {
    // 检查是否已存在
    const exists = props.modelValue.some(item => item.pattern === preset.pattern)
    if (!exists) {
      emit('update:modelValue', [...props.modelValue, {
        pattern: preset.pattern,
        type: preset.type,
        description: preset.label
      }])
    }
  }
  
  // 清空选择框
  selectedPresetId.value = ''
}

// 移除模式
function removePattern(index) {
  const newPatterns = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', newPatterns)
}

// 添加自定义模式
function addCustomPattern() {
  customError.value = ''
  
  if (!customPattern.value.trim()) {
    customError.value = '请输入忽略模式'
    return
  }
  
  // 如果是正则类型，验证正则语法
  if (customType.value === 'regex') {
    try {
      new RegExp(customPattern.value)
    } catch (e) {
      customError.value = '正则表达式格式错误'
      return
    }
  }
  
  // 检查是否已存在
  const exists = props.modelValue.some(item => item.pattern === customPattern.value)
  if (exists) {
    customError.value = '该模式已存在'
    return
  }
  
  emit('update:modelValue', [...props.modelValue, {
    pattern: customPattern.value,
    type: customType.value,
    description: ''
  }])
  cancelCustomInput()
}

// 取消自定义输入
function cancelCustomInput() {
  showCustomInput.value = false
  customPattern.value = ''
  customType.value = 'keyword'
  customError.value = ''
}
</script>

<style scoped>
.ignore-pattern-selector {
  padding: 10px 0;
}

.preset-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.preset-label {
  font-weight: 500;
}

.selected-patterns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
  margin-bottom: 10px;
}

.pattern-tag {
  max-width: 100%;
}

.pattern-type {
  color: #909399;
  font-size: 11px;
  margin-right: 4px;
}

.pattern-display {
  margin-right: 4px;
}

.custom-input-section {
  margin-top: 10px;
}

.custom-input-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.custom-input-row .el-input {
  flex: 1;
}

.custom-input-actions {
  display: flex;
  gap: 8px;
}

.error-message {
  color: #f56c6c;
  font-size: 12px;
}

.is-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset;
}
</style>
