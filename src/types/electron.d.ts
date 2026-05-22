export {}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      versions: {
        node: string
        chrome: string
        electron: string
      }
      selectFolder: () => Promise<string | null>
      getFolderFiles: (folderPath: string) => Promise<{ success: boolean; files?: Array<{ name: string; path: string; isDirectory: boolean; size: number }>; error?: string }>
      processLocales: (data: string, standardFile?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>
      selectSaveFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>
      exportExcelToFolder: (data: any[], folderPath: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      /**
       * 处理多语言缺失项对比
       */
      processMissingLocales: (
        data: string, 
        zhFilePath: string, 
        secondRefFilePath?: string
      ) => Promise<{ 
        success: boolean
        results?: Array<{ lang: string; missing: any[]; count: number }>
        error?: string 
      }>
      /**
       * 导出缺失项 Excel
       */
      exportMissingExcel: (
        results: Array<{ lang: string; missing: any[]; count: number }>, 
        folderPath: string
      ) => Promise<{ 
        success: boolean
        files?: Array<{ lang: string; path: string }>
        error?: string 
      }>
      saveTitleKeys: (data: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      getTitleKeys: () => Promise<{ success: boolean; data?: { [key: string]: string }; error?: string }>
      getDesktopPath: () => Promise<{ success: boolean; path?: string; error?: string }>
      selectJsonFile: () => Promise<string | null>
      selectTargetFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
      mergeLocaleFile: (tempData: string, type: string, filePath: string) => Promise<{ success: boolean; error?: string }>
      getLangMap: (type?: string) => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>
      saveLangMap: (data: string, type?: string) => Promise<{ success: boolean; error?: string }>
      batchAddLocale: (dirPath: string, excludePattern: string, targetProperty: string, objectsToAdd: string, type?: string) => Promise<{ success: boolean; message?: string; error?: string }>
      processPcLocales: (data: string, standardCode?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
      processPcMissingLocales: (data: string, zhCode: string, secondRefCode?: string) => Promise<{ success: boolean; results?: Array<{ lang: string; missing: any[]; count: number }>; error?: string }>
    }
  }
}