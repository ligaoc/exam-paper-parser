<template>
  <el-dialog v-model="dialogVisible" title="Web 服务设置" width="450px" @close="$emit('update:visible', false)">
    <div class="server-settings">
      <el-form label-width="100px">
        <el-form-item label="服务状态">
          <el-tag :type="serverStatus.running ? 'success' : 'info'">
            {{ serverStatus.running ? '运行中' : '已停止' }}
          </el-tag>
        </el-form-item>
        <el-form-item label="端口号">
          <el-input-number 
            v-model="serverPort" 
            :min="1024" 
            :max="65535" 
            :disabled="serverStatus.running"
          />
        </el-form-item>
        <el-form-item label="操作">
          <el-button 
            v-if="!serverStatus.running" 
            type="primary" 
            @click="startServer"
            :loading="serverLoading"
          >
            启动服务
          </el-button>
          <el-button 
            v-else 
            type="danger" 
            @click="stopServer"
            :loading="serverLoading"
          >
            停止服务
          </el-button>
        </el-form-item>
        <el-form-item v-if="serverStatus.running && serverStatus.addresses.length > 0" label="访问地址">
          <div class="server-addresses">
            <div v-for="addr in serverStatus.addresses" :key="addr" class="address-item">
              <el-link type="primary" :href="addr" target="_blank">{{ addr }}</el-link>
              <el-button size="small" text @click="copyAddress(addr)">复制</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="serverStatus.error" label="错误">
          <el-text type="danger">{{ serverStatus.error }}</el-text>
        </el-form-item>
      </el-form>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { webServer } from '../api/electron.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(false)
const serverPort = ref(3000)
const serverLoading = ref(false)
const serverStatus = ref({
  running: false,
  port: 3000,
  addresses: [],
  error: null
})

watch(() => props.visible, (val) => {
  dialogVisible.value = val
  if (val) {
    refreshServerStatus()
  }
})

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

const refreshServerStatus = async () => {
  try {
    const status = await webServer.getStatus()
    serverStatus.value = status
    serverPort.value = status.port
  } catch (error) {
    console.error('Failed to get server status:', error)
  }
}

const startServer = async () => {
  serverLoading.value = true
  try {
    const status = await webServer.start(serverPort.value)
    serverStatus.value = status
    if (status.running) {
      ElMessage.success('Web 服务已启动')
    } else if (status.error) {
      ElMessage.error(status.error)
    }
  } catch (error) {
    ElMessage.error('启动失败: ' + (error.message || error))
  } finally {
    serverLoading.value = false
  }
}

const stopServer = async () => {
  serverLoading.value = true
  try {
    const status = await webServer.stop()
    serverStatus.value = status
    ElMessage.success('Web 服务已停止')
  } catch (error) {
    ElMessage.error('停止失败: ' + (error.message || error))
  } finally {
    serverLoading.value = false
  }
}

const copyAddress = (addr) => {
  navigator.clipboard.writeText(addr)
  ElMessage.success('已复制到剪贴板')
}

onMounted(() => {
  refreshServerStatus()
})
</script>

<style scoped>
.server-settings {
  padding: 10px 0;
}

.server-addresses {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.address-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
