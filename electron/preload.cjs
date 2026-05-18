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
})
