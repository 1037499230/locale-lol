<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

interface LogEntry {
  type: 'stdout' | 'stderr'
  data: string
  timestamp: string
}

const props = defineProps<{
  visible: boolean
  projectType: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const logs = ref<LogEntry[]>([])
const progress = ref({ step: '', percent: 0 })
const isRunning = ref(false)
const consoleRef = ref<HTMLDivElement>()

/** 获取当前时间戳字符串 */
const getTimestamp = () => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

/** 添加一条日志 */
const addLog = (type: 'stdout' | 'stderr', data: string) => {
  logs.value.push({ type, data, timestamp: getTimestamp() })
  scrollToBottom()
}

/** 更新进度 */
const updateProgress = (step: string, percent: number) => {
  progress.value = { step, percent }
}

/** 滚动到底部 */
const scrollToBottom = async () => {
  await nextTick()
  if (consoleRef.value) {
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight
  }
}

/** 清空日志 */
const clearLogs = () => {
  logs.value = []
  progress.value = { step: '', percent: 0 }
}

/** 监听自动模式日志 */
const handleAutoModeLog = (data: { type: 'stdout' | 'stderr'; data: string; projectType: string }) => {
  if (data.projectType === props.projectType) {
    addLog(data.type, data.data)
  }
}

/** 监听自动模式进度 */
const handleAutoModeProgress = (data: { step: string; percent: number; projectType: string }) => {
  if (data.projectType === props.projectType) {
    updateProgress(data.step, data.percent)
  }
}

/** 进度条状态文本 */
const progressStatusText = () => {
  if (progress.value.percent >= 100) return 'success'
  if (progress.value.percent > 0) return ''
  return ''
}

onMounted(() => {
  window.electronAPI?.onAutoModeLog(handleAutoModeLog)
  window.electronAPI?.onAutoModeProgress(handleAutoModeProgress)
})

onUnmounted(() => {
  window.electronAPI?.removeAutoModeListeners()
})

defineExpose({ addLog, updateProgress, clearLogs, isRunning })
</script>

<template>
  <transition name="slide">
    <div v-if="visible" class="auto-mode-console">
      <!-- 标题栏 -->
      <div class="console-header">
        <span class="console-title">
          🖥️ 自动模式终端 — {{ projectType?.toUpperCase() }}
        </span>
        <div class="console-actions">
          <el-button size="small" text @click="clearLogs">清空</el-button>
          <el-button size="small" text @click="emit('close')">收起</el-button>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="progress.percent > 0" class="console-progress">
        <el-progress
          :percentage="progress.percent"
          :status="progressStatusText()"
          :stroke-width="6"
          :format="() => progress.step || `${progress.percent}%`"
        />
      </div>

      <!-- 终端输出 -->
      <div ref="consoleRef" class="console-body">
        <div v-if="logs.length === 0" class="console-empty">
          等待操作...
        </div>
        <div
          v-for="(log, index) in logs"
          :key="index"
          :class="['console-line', log.type === 'stderr' ? 'console-error' : '']"
        >
          <span class="console-time">[{{ log.timestamp }}]</span>
          <span class="console-text">{{ log.data }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.auto-mode-console {
  margin-top: 12px;
  border: 1px solid #303133;
  border-radius: 6px;
  background: #1e1e1e;
  overflow: hidden;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #303133;
}

.console-title {
  color: #67c23a;
  font-size: 13px;
  font-weight: bold;
}

.console-actions {
  display: flex;
  gap: 4px;
}

.console-progress {
  padding: 8px 12px;
  background: #252525;
}

.console-body {
  max-height: 220px;
  overflow-y: auto;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
}

.console-empty {
  color: #606266;
  font-style: italic;
}

.console-line {
  color: #dcdfe6;
  white-space: pre-wrap;
  word-break: break-all;
}

.console-error {
  color: #f56c6c;
}

.console-time {
  color: #909399;
  margin-right: 8px;
}

.console-text {
  color: inherit;
}

/* 滚动条样式 */
.console-body::-webkit-scrollbar {
  width: 6px;
}

.console-body::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.console-body::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

/* 展开/收起动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}
</style>
