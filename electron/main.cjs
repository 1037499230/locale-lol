const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { processLocales, convertToExcel, processMissingLocales, generateMissingExcel } = require('./localeProcessor.cjs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('get-folder-files', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath)
    const fileList = files.map(file => {
      const filePath = path.join(folderPath, file)
      const stats = fs.statSync(filePath)
      return {
        name: file,
        path: filePath,
        isDirectory: stats.isDirectory(),
        size: stats.size
      }
    })
    return { success: true, files: fileList }
  } catch (error) {
    console.error('读取文件夹失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('process-locales', async (event, data, standardFile) => {
  try {
    const result = processLocales(data, standardFile)
    const cleanData = result.map(item => {
      const cleanItem = {}
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          cleanItem[key] = item[key] === undefined || item[key] === null ? '' : String(item[key])
        }
      }
      return cleanItem
    })
    return { success: true, data: cleanData }
  } catch (error) {
    console.error('处理多语言失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('select-save-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] }
  }
  return { success: false, canceled: true }
})

ipcMain.handle('export-excel-to-folder', async (event, { data, folderPath }) => {
  try {
    const fileName = `combined-locales-${Date.now()}.xlsx`
    const filePath = path.join(folderPath, fileName)
    
    convertToExcel(data, filePath)
    return { success: true, filePath }
  } catch (error) {
    console.error('导出 Excel 失败:', error)
    return { success: false, error: error.message }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})