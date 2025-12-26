<template>
  <div class="pattern-editor">
    <div v-for="(pattern, index) in modelValue" :key="index" class="pattern-item">
      <el-input 
        v-model="modelValue[index]" 
        placeholder="输入正则表达式"
        @input="emitUpdate"
      >
        <template #prepend>{{ index + 1 }}</template>
        <template #append>
          <el-button @click="removePattern(index)" :icon="Delete" />
        </template>
      </el-input>
    </div>
    <el-button type="primary" text @click="addPattern">
      <el-icon><Plus /></el-icon>
      添加模式
    </el-button>
    <div class="pattern-hint">
      <el-icon><InfoFilled /></el-icon>
      <span>使用正则表达式定义匹配模式，例如：^\\d+[、．.] 匹配以数字开头的题号</span>
    </div>
  </div>
</template>

<script setup>
import { Delete, Plus, InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

function addPattern() {
  const newPatterns = [...props.modelValue, '']
  emit('update:modelValue', newPatterns)
}

function removePattern(index) {
  const newPatterns = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', newPatterns)
}

function emitUpdate() {
  emit('update:modelValue', [...props.modelValue])
}
</script>

<style scoped>
.pattern-editor {
  padding: 10px 0;
}

.pattern-item {
  margin-bottom: 10px;
}

.pattern-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
</style>
