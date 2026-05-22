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
  selectSaveFolder: () => ipcRenderer.invoke('select-save-folder'),
  exportExcelToFolder: (data, folderPath) => ipcRenderer.invoke('export-excel-to-folder', { data, folderPath }),
  processMissingLocales: (data, zhFilePath, secondRefFilePath) => ipcRenderer.invoke('process-missing-locales', data, zhFilePath, secondRefFilePath),
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
  processPcLocales: (data, standardCode) => ipcRenderer.invoke('process-pc-locales', data, standardCode),
  processPcMissingLocales: (data, zhCode, secondRefCode) => ipcRenderer.invoke('process-pc-missing-locales', data, zhCode, secondRefCode),
})
