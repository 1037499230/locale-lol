const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { processLocales, convertToExcel, processMissingLocales, generateMissingExcel } = require('./localeProcessor.cjs')
const { initLangMapFile, batchAddLocales, batchAddLocalesPc, batchAddLocalesAdmin } = require('./addLocaleProcessor.cjs')
const { processPcLocales, processPcMissingLocales } = require('./pcLocaleProcessor.cjs')
const { processAdminLocales, extractAndGenerateJson } = require('./adminLocaleProcessor.cjs')

/**
 * 将扁平化的对象转换为嵌套对象
 */
function unflattenObject(flatObj) {
  const result = {}
  for (const key in flatObj) {
    if (Object.prototype.hasOwnProperty.call(flatObj, key)) {
      const keys = key.split('.')
      let current = result
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        if (i === keys.length - 1) {
          current[k] = flatObj[key]
        } else {
          if (!(k in current)) current[k] = {}
          current = current[k]
        }
      }
    }
  }
  return result
}

/**
 * 深度合并两个对象
 */
function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target))
  function mergeRecursive(targetObj, sourceObj) {
    for (const key in sourceObj) {
      if (Object.prototype.hasOwnProperty.call(sourceObj, key)) {
        if (sourceObj[key] !== null && typeof sourceObj[key] === 'object' && !Array.isArray(sourceObj[key]) &&
            targetObj[key] !== null && typeof targetObj[key] === 'object' && !Array.isArray(targetObj[key])) {
          if (!targetObj[key]) targetObj[key] = {}
          mergeRecursive(targetObj[key], sourceObj[key])
        } else {
          targetObj[key] = sourceObj[key]
        }
      }
    }
  }
  const nestedSource = unflattenObject(source)
  mergeRecursive(result, nestedSource)
  return result
}

/**
 * 对象转 TS 格式字符串（用于 Admin 合并）
 */
function objectToTsString(obj, indent = 0) {
  const indentStr = '  '.repeat(indent)
  const nextIndentStr = '  '.repeat(indent + 1)

  if (typeof obj === 'string') {
    // 确保所有特殊字符都被转义，并保持在同一行
    return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`
  }

  const entries = Object.entries(obj)
  const entriesStr = entries.map(([key, value]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`
    const valueStr = typeof value === 'string' ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"` : objectToTsString(value, indent + 1)
    return `${nextIndentStr}${formattedKey}: ${valueStr}`
  }).join(',\n')

  return `{\n${entriesStr}\n${indentStr}}`
}

/**
 * 默认的 TitleKeys 配置数据
 */
const DEFAULT_TITLE_KEYS = {
  "key": "key",
  "zh": "中文简体",
  "en": "英语",
  "bg": "保加利亚语",
  "de": "德语",
  "el": "希腊语",
  "es": "西班牙语",
  "he": "希伯来语",
  "hu": "匈牙利语",
  "it": "意大利语",
  "ka": "格鲁吉亚语",
  "kk": "哈萨克语",
  "ky": "吉尔吉斯语",
  "lt": "立陶宛语",
  "mn": "蒙古语",
  "pl": "波兰语",
  "ru": "俄语",
  "sk": "斯洛伐克语",
  "tg": "塔吉克语",
  "tr": "土耳其语",
  "uk": "乌克兰语",
  "uz": "乌兹别克语",
  "es-col": "西班牙语-哥伦比亚",
  "es-mex": "西班牙语-墨西哥",
  "fr": "法语",
  "en-af": "非洲-英语",
  "bn": "孟加拉语",
  "ro": "罗马尼亚语",
  "en-ay": "东南亚-英语"
}

/**
 * 获取配置文件的完整路径
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'titleKeys.json')
}

/**
 * 初始化配置文件，如果不存在则写入默认数据
 */
function initConfigFile() {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    try {
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_TITLE_KEYS, null, 2), 'utf8')
      console.log('✅ 已创建默认配置文件:', configPath)
    } catch (error) {
      console.error('❌ 创建默认配置文件失败:', error)
    }
  }
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '你就用吧老铁，一用一个不吱声 - Locale LOL',
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
    // mainWindow.webContents.openDevTools()
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
    console.log('数据:', data, standardFile)
    const result = processLocales(data.data, data.standardFile)
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

ipcMain.handle('process-pc-locales', async (event, data, standardCode = 'zh') => {
  try {
    const result = processPcLocales(data, standardCode)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('process-pc-missing-locales', async (event, data, zhCode, secondRefCode) => {
  try {
    const results = processPcMissingLocales(data, zhCode, secondRefCode)
    return { success: true, results }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('process-missing-locales', async (event, data, zhCode, secondRefCode) => {
  try {
    const results = processMissingLocales(data, zhCode, secondRefCode)
    return { success: true, results }
  } catch (error) {
    console.error('处理缺失项失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-missing-excel', async (event, results, folderPaths) => {
  try {
    const files = generateMissingExcel(results, folderPaths)
    return { success: true, files }
  } catch (error) {
    console.error('导出缺失项 Excel 失败:', error)
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

ipcMain.handle('save-title-keys', (event, data) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'titleKeys.json');
    fs.writeFileSync(filePath, data);
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('get-title-keys', () => {
  try {
    const filePath = getConfigPath();
    if (fs.existsSync(filePath)) {
      return { success: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }
    } else {
      return { success: true, data: {} }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
});

ipcMain.handle('get-desktop-path', () => {
  try {
    const desktopPath = path.join(app.getPath('home'), 'Desktop');
    return { success: true, path: desktopPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-json-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('select-target-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('merge-locale-file', async (event, tempDataStr, type, filePath) => {
  try {
    const tempData = JSON.parse(tempDataStr)
    
    if (type === 'admin') {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `目标文件夹不存在: ${filePath}` }
      }

      // 注意：这里不再遍历 langFolders，而是直接以 filePath 作为当前语言的根目录
      // 如果用户选的是 locales/es，那 filePath 就是 es 的路径
      const langPath = filePath 
      
      // 为了兼容用户可能选了 locales 根目录的情况，我们判断一下：
      // 如果 filePath 下全是文件夹（如 zh, en），则遍历；否则直接处理当前目录
      const items = fs.readdirSync(langPath)
      const isRootLocales = items.length > 0 && items.every(item => {
        const itemPath = path.join(langPath, item)
        return fs.statSync(itemPath).isDirectory()
      })

      const foldersToProcess = isRootLocales 
        ? items.map(item => ({ name: item, path: path.join(langPath, item) }))
        : [{ name: path.basename(langPath), path: langPath }]

      for (const folder of foldersToProcess) {
        const currentLangPath = folder.path
        
        for (const [fullKey, value] of Object.entries(tempData)) {
          const keys = fullKey.split('.')
          let targetDir = currentLangPath
          let targetFile = ''
          let propertyPath = []
          let found = false

          // 逐层解析：对每一个属性名都进行判断
          for (let i = 0; i < keys.length; i++) {
            const part = keys[i]
            const tsPath = path.join(targetDir, `${part}.ts`)
            const dirPath = path.join(targetDir, part)

            if (fs.existsSync(tsPath)) {
              // 1. 是文件：记录下来，准备处理剩下的部分作为属性
              targetFile = part
              propertyPath = keys.slice(i + 1)
              found = true
              break 
            } else if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
              // 2. 是文件夹：进入该文件夹，继续判断下一个词
              targetDir = dirPath
            } else {
              // 3. 既不是文件也不是文件夹，路径无效，跳出
              break
            }
          }

          if (found && targetFile && propertyPath.length > 0) {
            const tsFilePath = path.join(targetDir, `${targetFile}.ts`)
            
            const fileContent = fs.readFileSync(tsFilePath, 'utf-8')
            const jsonString = fileContent.replace('export default', '').trim().replace(/;$/, '')
            let targetData
            try {
              targetData = new Function(`return ${jsonString}`)()
            } catch (e) { continue }

            // 深度赋值
            let currentObj = targetData
            for (let j = 0; j < propertyPath.length - 1; j++) {
              const k = propertyPath[j]
              if (!currentObj[k]) currentObj[k] = {}
              currentObj = currentObj[k]
            }
            
            const lastKey = propertyPath[propertyPath.length - 1]
            // ✅ 关键改动：写入前确保值是字符串且换行符已转义
            // 如果 value 里包含物理换行，这里会自动被 objectToTsString 处理
            currentObj[lastKey] = value

            const formattedObject = objectToTsString(targetData)
            fs.writeFileSync(tsFilePath, `export default ${formattedObject};\n`, 'utf-8')
          }
        }
      }
    } else if (type === 'pc') {
      // PC 端：读取 TS 文件，合并后写回 TS 格式
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const jsonString = fileContent.replace('export default', '').trim()
      const targetData = new Function(`return ${jsonString}`)()
      
      const result = deepMerge(targetData, tempData)
      const outputContent = `export default ${JSON.stringify(result, null, 2)};`
      fs.writeFileSync(filePath, outputContent, 'utf-8')
    } else {
      // H5 端：读取 JSON 文件，合并后写回 JSON 格式
      const targetRaw = fs.readFileSync(filePath, 'utf-8')
      const targetData = JSON.parse(targetRaw)
      const result = deepMerge(targetData, tempData)
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8')
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})


app.whenReady().then(() => {
  // 初始化配置文件
  initConfigFile()
  // 初始化 H5 和 PC 的语言映射文件
  initLangMapFile('h5')
  initLangMapFile('pc')
  initLangMapFile('admin')

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

ipcMain.handle('get-lang-map', (event, type = 'h5') => {
  try {
    const filePath = path.join(app.getPath('userData'), `langMap-${type}.json`)
    if (fs.existsSync(filePath)) {
      return { success: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }
    } else {
      return { success: true, data: {} }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-lang-map', (event, dataStr, type = 'h5') => {
  try {
    const filePath = path.join(app.getPath('userData'), `langMap-${type}.json`)
    fs.writeFileSync(filePath, dataStr, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('batch-add-locale', (event, dirPath, excludePattern, targetProperty, objectsToAddStr, type = 'h5') => {
  try {
    const result = batchAddLocales(dirPath, excludePattern, targetProperty, objectsToAddStr, type)
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('batch-add-locale-pc', (event, dirPath, excludePattern, targetProperty, objectsToAddStr, type = 'pc') => {
  try {
    const result = batchAddLocalesPc(dirPath, excludePattern, targetProperty, objectsToAddStr, type)
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('batch-add-locale-admin', (event, localesPath, targetProperty, objectsToAddStr, type = 'admin') => {
  try {
    const result = batchAddLocalesAdmin(localesPath, targetProperty, objectsToAddStr, type)
    return result
  } catch (error) {
    console.error('批量添加语言失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-admin-locales', async (event, localesPath) => {
  try {
    const languages = processAdminLocales(localesPath)
    return { success: true, languages }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('extract-admin-locales', async (event, localesPath) => {
  try {
    extractAndGenerateJson(localesPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
