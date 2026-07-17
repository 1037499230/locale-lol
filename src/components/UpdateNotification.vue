<script setup lang="ts">
import { computed } from 'vue'
import { useUpdateStore } from '@/stores/updateStore'
import { ElMessage } from 'element-plus'

const update = useUpdateStore()

const showAvailable = computed({
  get: () => update.status === 'available',
  set: (val: boolean) => { if (!val) update.dismiss() }
})
const showDownloading = computed(() => update.status === 'downloading')
const showDownloaded = computed({
  get: () => update.status === 'downloaded',
  set: (val: boolean) => { if (!val) update.dismiss() }
})
const showError = computed({
  get: () => update.status === 'error',
  set: (val: boolean) => { if (!val) update.dismiss() }
})

function handleCheckUpdate() {
  update.checkUpdate()
}

function handleDownload() {
  update.downloadUpdate()
}

function handleInstall() {
  update.installUpdate()
}

function handleDismiss() {
  update.dismiss()
  ElMessage.info('已忽略本次更新')
}
</script>

<template>
  <!-- 有新版本可用 -->
  <el-dialog
    v-model="showAvailable"
    title="🎉 发现新版本"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
  >
    <div class="update-info">
      <p class="version-line">
        <span class="label">当前版本：</span>
        <el-tag type="info" size="small">{{ update.currentVersion }}</el-tag>
        <span class="arrow">→</span>
        <el-tag type="success" size="small">{{ update.remoteVersion }}</el-tag>
      </p>
      <div v-if="update.releaseNotes" class="release-notes">
        <p class="label">更新内容：</p>
        <div class="notes-text" v-html="update.releaseNotes"></div>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleDismiss">稍后再说</el-button>
      <el-button type="primary" @click="handleDownload">立即更新</el-button>
    </template>
  </el-dialog>

  <!-- 下载中 -->
  <el-dialog
    v-model="showDownloading"
    title="📥 正在下载更新"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    align-center
  >
    <div class="download-progress">
      <el-progress :percentage="update.downloadProgress" :stroke-width="18" striped striped-flow />
      <p class="progress-text">{{ update.downloadProgress }}%</p>
    </div>
  </el-dialog>

  <!-- 下载完成 -->
  <el-dialog
    v-model="showDownloaded"
    title="✅ 更新已就绪"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
  >
    <p>新版本 <strong>v{{ update.remoteVersion }}</strong> 已下载完成，需要重启应用以完成安装。</p>
    <template #footer>
      <el-button @click="handleDismiss">稍后重启</el-button>
      <el-button type="primary" @click="handleInstall">立即重启</el-button>
    </template>
  </el-dialog>

  <!-- 更新出错 -->
  <el-dialog
    v-model="showError"
    title="⚠️ 更新失败"
    width="420px"
    align-center
  >
    <p>{{ update.errorMessage }}</p>
    <template #footer>
      <el-button type="primary" @click="handleCheckUpdate">重试</el-button>
      <el-button @click="handleDismiss">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.update-info {
  padding: 8px 0;
}

.version-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.label {
  font-weight: 500;
  color: #606266;
}

.arrow {
  color: #e6a23c;
  font-weight: bold;
  font-size: 16px;
}

.release-notes {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.notes-text {
  color: #606266;
  line-height: 1.6;
  margin: 4px 0 0;
}

.notes-text :deep(p) {
  margin: 0 0 8px;
}

.notes-text :deep(p:last-child) {
  margin-bottom: 0;
}

.download-progress {
  padding: 16px 0;
  text-align: center;
}

.progress-text {
  margin-top: 12px;
  font-size: 14px;
  color: #909399;
}
</style>
