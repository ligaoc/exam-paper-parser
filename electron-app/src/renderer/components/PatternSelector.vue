<template>
  <div class="pattern-selector">
    <!-- 下拉选择框 -->
    <el-select
      v-model="selectedPresetId"
      placeholder="选择模式..."
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
          <span class="preset-examples">{{ preset.examples.slice(0, 3).join(' ') }}</span>
        </div>
      </el-option>
    </el-select>

    <!-- 已选模式列表 -->
    <div class="selected-patterns">
      <el-tag
        v-for="(item, index) in selectedItems"
        :key="index"
        closable
        :type="item.isCustom ? 'warning' : 'primary'"
        @close="removePattern(index)"
        class="pattern-tag"
      >
        <span v-if="item.isCustom" class="custom-label">自定义: </span>
        <span class="pattern-display">{{ item.label }}</span>
        <span v-if="!item.isCustom" class="pattern-examples">({{ item.examples.slice(0, 2).join(' ') }})</span>
      </el-tag>
    </div>

    <!-- 自定义模式输入 -->
    <div v-if="allowCustom" class="custom-input-section">
      <el-button 
        v-if="!showCustomInput" 
        type="primary" 
        text 
        size="small"
        @click="showCustomInput = true"
      >
        <el-icon><Plus /></el-icon>
        添加自定义模式
      </el-button>
      
      <div v-else class="custom-input-row">
        <el-input
          v-model="customPattern"
          placeholder="输入正则表达式"
          size="small"
          :class="{ 'is-error': customError }"
          @keyup.enter="addCustomPattern"
        />
        <el-button type="primary" size="small" @click="addCustomPattern">添加</el-button>
        <el-button size="small" @click="cancelCustomInput">取消</el-button>
      </div>
      <div v-if="customError" class="error-message">{{ customError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getPresetsByCategory, findPresetByRegex, validateRegex } from '../utils/patternPresets'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  category: {
    type: String,
    required: true,
    validator: (value) => ['question', 'score', 'bracket', 'underline'].includes(value)
  },
  allowCustom: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])

// 状态
const selectedPresetId = ref('')
const showCustomInput = ref(false)
const customPattern = ref('')
const customError = ref('')

// 获取当前类别的可用预设
const availablePresets = computed(() => {
  return getPresetsByCategory(props.category)
})

// 将 modelValue 中的正则转换为显示项
const selectedItems = computed(() => {
  return props.modelValue.map(regex => {
    const preset = findPresetByRegex(regex)
    if (preset) {
      return {
        regex,
        label: preset.label,
        examples: preset.examples,
        isCustom: false
      }
    } else {
      return {
        regex,
        label: regex,
        examples: [],
        isCustom: true
      }
    }
  })
})

// 选择预设
function handlePresetSelect(presetId) {
  if (!presetId) return
  
  const preset = availablePresets.value.find(p => p.id === presetId)
  if (preset && !props.modelValue.includes(preset.regex)) {
    emit('update:modelValue', [...props.modelValue, preset.regex])
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
    customError.value = '请输入正则表达式'
    return
  }
  
  if (!validateRegex(customPattern.value)) {
    customError.value = '正则表达式格式错误'
    return
  }
  
  if (props.modelValue.includes(customPattern.value)) {
    customError.value = '该模式已存在'
    return
  }
  
  emit('update:modelValue', [...props.modelValue, customPattern.value])
  cancelCustomInput()
}

// 取消自定义输入
function cancelCustomInput() {
  showCustomInput.value = false
  customPattern.value = ''
  customError.value = ''
}
</script>


<style scoped>
.pattern-selector {
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

.preset-examples {
  color: #909399;
  font-size: 12px;
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

.custom-label {
  color: #e6a23c;
  font-weight: 500;
}

.pattern-display {
  margin-right: 4px;
}

.pattern-examples {
  color: #909399;
  font-size: 11px;
}

.custom-input-section {
  margin-top: 10px;
}

.custom-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.custom-input-row .el-input {
  flex: 1;
}

.error-message {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}

.is-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset;
}
</style>
