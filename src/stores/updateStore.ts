import { defineStore } from 'pinia'
import { ref } from 'vue'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

export const useUpdateStore = defineStore('update', () => {
  const status = ref<UpdateStatus>('idle')
  const currentVersion = ref('')
  const remoteVersion = ref('')
  const releaseNotes = ref('')
  const downloadProgress = ref(0)
  const errorMessage = ref('')

  function reset() {
    status.value = 'idle'
    remoteVersion.value = ''
    releaseNotes.value = ''
    downloadProgress.value = 0
    errorMessage.value = ''
  }

  async function checkUpdate() {
    if (status.value === 'checking' || status.value === 'downloading') return

    status.value = 'checking'
    errorMessage.value = ''

    try {
      // 获取当前版本
      currentVersion.value = await window.electronAPI!.getAppVersion()

      const result = await window.electronAPI!.checkForUpdate()

      if (result.error) {
        status.value = 'error'
        errorMessage.value = result.error
        return
      }

      if (result.hasUpdate) {
        status.value = 'available'
        remoteVersion.value = result.remoteVersion || ''
        releaseNotes.value = result.releaseNotes || ''
      } else {
        status.value = 'idle'
      }
    } catch (e: any) {
      status.value = 'error'
      errorMessage.value = e.message || '检查更新失败'
    }
  }

  async function downloadUpdate() {
    if (status.value !== 'available') return

    status.value = 'downloading'
    downloadProgress.value = 0

    try {
      const result = await window.electronAPI!.downloadUpdate()
      if (!result.success) {
        status.value = 'error'
        errorMessage.value = result.error || '下载失败'
      }
    } catch (e: any) {
      status.value = 'error'
      errorMessage.value = e.message || '下载更新失败'
    }
  }

  function installUpdate() {
    if (status.value !== 'downloaded') return
    window.electronAPI!.installUpdate()
  }

  function dismiss() {
    reset()
  }

  // 监听主进程推送的更新事件
  function setupListeners() {
    window.electronAPI!.onUpdateAvailable((info) => {
      status.value = 'available'
      remoteVersion.value = info.version
      releaseNotes.value = info.releaseNotes || ''
    })

    window.electronAPI!.onUpdateProgress((progress) => {
      downloadProgress.value = Math.round(progress.percent)
    })

    window.electronAPI!.onUpdateDownloaded(() => {
      status.value = 'downloaded'
      downloadProgress.value = 100
    })

    window.electronAPI!.onUpdateError((error) => {
      status.value = 'error'
      errorMessage.value = error.message
    })
  }

  function cleanupListeners() {
    window.electronAPI!.removeUpdateListeners()
  }

  return {
    status,
    currentVersion,
    remoteVersion,
    releaseNotes,
    downloadProgress,
    errorMessage,
    checkUpdate,
    downloadUpdate,
    installUpdate,
    dismiss,
    setupListeners,
    cleanupListeners
  }
})
