/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  platform: string
  versions: { node: string; chrome: string; electron: string }
  selectFolder: () => Promise<string | null>
  getFolderFiles: (folderPath: string) => Promise<{ success: boolean; files?: Array<{ name: string; path: string; isDirectory: boolean; size: number }>; error?: string }>
  processLocales: (data: any, standardFile: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
  processPcLocales: (data: any, standardFile: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
  selectSaveFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>
  exportExcelToFolder: (data: any, folderPath: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  processMissingLocales: (data: string, zhFilePath: string, secondRefFilePath?: string) => Promise<{ success: boolean; results?: any[]; error?: string }>
  processPcMissingLocales: (data: string, zhFilePath: string, secondRefFilePath?: string) => Promise<{ success: boolean; results?: any[]; error?: string }>
  exportMissingExcel: (results: any[], folderPath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
  saveTitleKeys: (data: string) => Promise<{ success: boolean; error?: string }>
  getTitleKeys: () => Promise<{ success: boolean; data?: any; error?: string }>
  getDesktopPath: () => Promise<{ success: boolean; path?: string; error?: string }>
  selectJsonFile: () => Promise<string | null>
  selectTargetFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
  mergeLocaleFile: (tempData: string, type: string, filePath: string) => Promise<{ success: boolean; error?: string }>
  getLangMap: (type: string) => Promise<{ success: boolean; data?: any; error?: string }>
  saveLangMap: (data: string, type: string) => Promise<{ success: boolean; error?: string }>
  batchAddLocale: (dirPath: string, excludePattern: string, targetProperty: string, objectsToAdd: string, type: string) => Promise<{ success: boolean; message?: string; error?: string }>
  batchAddLocalePc: (dirPath: string, excludePattern: string, targetProperty: string, objectsToAdd: string, type: string) => Promise<{ success: boolean; message?: string; error?: string }>
  batchAddLocaleAdmin: (localesPath: string, targetProperty: string, objectsToAdd: string, type: string) => Promise<{ success: boolean; message?: string; error?: string }>
  getAdminLocales: (localesPath: string) => Promise<{ success: boolean; languages?: string[]; error?: string }>
  extractAdminLocales: (localesPath: string) => Promise<{ success: boolean; error?: string }>
  getSyncLangMap: () => Promise<{ success: boolean; data?: any; error?: string }>
  saveSyncLangMap: (data: string) => Promise<{ success: boolean; error?: string }>
  syncLocaleKey: (params: any) => Promise<{ success: boolean; results?: any[]; error?: string }>
  getProjectPaths: () => Promise<{ success: boolean; data?: { h5: string; pc: string; admin: string }; error?: string }>
  saveProjectPaths: (data: string) => Promise<{ success: boolean; error?: string }>
  // 自动模式
  getAutoModeConfig: () => Promise<{ success: boolean; data?: any; error?: string }>
  saveAutoModeConfig: (data: string) => Promise<{ success: boolean; error?: string }>
  autoCloneProject: (projectType: string) => Promise<{ success: boolean; localPath?: string; error?: string }>
  onAutoModeLog: (callback: (data: { type: 'stdout' | 'stderr'; data: string; projectType: string }) => void) => void
  onAutoModeProgress: (callback: (data: { step: string; percent: number; projectType: string }) => void) => void
  removeAutoModeListeners: () => void
  // 自动更新
  checkForUpdate: () => Promise<{
    hasUpdate: boolean
    currentVersion?: string
    remoteVersion?: string
    releaseNotes?: string
    releaseDate?: string
    error?: string
  }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<{ success: boolean }>
  getAppVersion: () => Promise<string>
  onUpdateAvailable: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => void
  onUpdateProgress: (callback: (progress: { bytesPerSecond: number; percent: number; transferred: number; total: number }) => void) => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void
  onUpdateError: (callback: (error: { message: string }) => void) => void
  removeUpdateListeners: () => void
}

interface Window {
  electronAPI?: ElectronAPI
}