const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFolderFiles: (folderPath) => ipcRenderer.invoke('get-folder-files', folderPath),
  processLocales: (data, standardFile) => ipcRenderer.invoke('process-locales', { data, standardFile }),
  processPcLocales: (data, standardFile) => ipcRenderer.invoke('process-pc-locales', { data, standardFile }),
  selectSaveFolder: () => ipcRenderer.invoke('select-save-folder'),
  exportExcelToFolder: (data, folderPath) => ipcRenderer.invoke('export-excel-to-folder', { data, folderPath }),
  processMissingLocales: (data, zhFilePath, secondRefFilePath) => ipcRenderer.invoke('process-missing-locales', data, zhFilePath, secondRefFilePath),
  processPcMissingLocales: (data, zhFilePath, secondRefFilePath) => ipcRenderer.invoke('process-pc-missing-locales', data, zhFilePath, secondRefFilePath),
  exportMissingExcel: (results, folderPath) => ipcRenderer.invoke('export-missing-excel', results, folderPath),
  saveTitleKeys: (data) => ipcRenderer.invoke('save-title-keys', data),
  getTitleKeys: () => ipcRenderer.invoke('get-title-keys'),
  getDesktopPath: () => ipcRenderer.invoke('get-desktop-path'),
  selectJsonFile: () => ipcRenderer.invoke('select-json-file'),
  selectTargetFile: (filters) => ipcRenderer.invoke('select-target-file', filters),
  mergeLocaleFile: (tempData, type, filePath) => ipcRenderer.invoke('merge-locale-file', tempData, type, filePath),
  getLangMap: (type) => ipcRenderer.invoke('get-lang-map', type),
  saveLangMap: (data, type) => ipcRenderer.invoke('save-lang-map', data, type),
  batchAddLocale: (dirPath, excludePattern, targetProperty, objectsToAdd, type) => ipcRenderer.invoke('batch-add-locale', dirPath, excludePattern, targetProperty, objectsToAdd, type),
  batchAddLocalePc: (dirPath, excludePattern, targetProperty, objectsToAdd, type) => ipcRenderer.invoke('batch-add-locale-pc', dirPath, excludePattern, targetProperty, objectsToAdd, type),
  batchAddLocaleAdmin: (localesPath, targetProperty, objectsToAdd, type) => ipcRenderer.invoke('batch-add-locale-admin', localesPath, targetProperty, objectsToAdd, type),
  getAdminLocales: (localesPath) => ipcRenderer.invoke('get-admin-locales', localesPath),
  extractAdminLocales: (localesPath) => ipcRenderer.invoke('extract-admin-locales', localesPath),
  getSyncLangMap: () => ipcRenderer.invoke('get-sync-lang-map'),
  saveSyncLangMap: (data) => ipcRenderer.invoke('save-sync-lang-map', data),
  syncLocaleKey: (params) => ipcRenderer.invoke('sync-locale-key', params),
  getProjectPaths: () => ipcRenderer.invoke('get-project-paths'),
  saveProjectPaths: (data) => ipcRenderer.invoke('save-project-paths', data),
  // 自动模式
  getAutoModeConfig: () => ipcRenderer.invoke('get-auto-mode-config'),
  saveAutoModeConfig: (data) => ipcRenderer.invoke('save-auto-mode-config', data),
  autoCloneProject: (projectType) => ipcRenderer.invoke('auto-clone-project', projectType),
  onAutoModeLog: (callback) => ipcRenderer.on('auto-mode-log', (_event, data) => callback(data)),
  onAutoModeProgress: (callback) => ipcRenderer.on('auto-mode-progress', (_event, data) => callback(data)),
  removeAutoModeListeners: () => {
    ipcRenderer.removeAllListeners('auto-mode-log')
    ipcRenderer.removeAllListeners('auto-mode-progress')
  },
  // 自动更新
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.on('update-available', (_event, info) => callback(info))
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.removeAllListeners('update-progress')
    ipcRenderer.on('update-progress', (_event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.removeAllListeners('update-downloaded')
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info))
  },
  onUpdateError: (callback) => {
    ipcRenderer.removeAllListeners('update-error')
    ipcRenderer.on('update-error', (_event, error) => callback(error))
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-progress')
    ipcRenderer.removeAllListeners('update-downloaded')
    ipcRenderer.removeAllListeners('update-error')
  },
})
