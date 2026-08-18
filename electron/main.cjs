const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const { autoUpdater } = require('electron-updater')
const { processLocales, convertToExcel, processMissingLocales, generateMissingExcel } = require('./localeProcessor.cjs')
const { initLangMapFile, batchAddLocales, batchAddLocalesPc, batchAddLocalesAdmin, mergeAdminLocales } = require('./addLocaleProcessor.cjs')
const { processPcLocales, processPcMissingLocales } = require('./pcLocaleProcessor.cjs')
const { processAdminLocales, extractAndGenerateJson } = require('./adminLocaleProcessor.cjs')
const { initSyncLangMapFile, loadSyncLangMap, getSyncLangMapPath, syncLocaleKey } = require('./syncLocaleProcessor.cjs')
const { initAutoModeConfig, loadAutoModeConfig, saveAutoModeConfig, autoCloneProject } = require('./gitCloneProcessor.cjs')

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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * uni-app locale files store their keys as common["uni.xxx"], rather than as
 * common.uni.xxx. Recursively flatten source values into that file format.
 */
function addUniAppEntries(target, sourceKey, value) {
  const key = sourceKey.slice('common.'.length)
  if (!target.common) target.common = {}

  const appendValue = (currentKey, currentValue) => {
    if (isPlainObject(currentValue)) {
      const entries = Object.entries(currentValue)
      if (entries.length === 0) {
        target.common[currentKey] = {}
        return
      }

      entries.forEach(([childKey, childValue]) => {
        appendValue(`${currentKey}.${childKey}`, childValue)
      })
      return
    }

    target.common[currentKey] = currentValue
  }

  appendValue(key, value)
}

function hasUniAppEntries(localeData) {
  return Boolean(localeData.common && Object.keys(localeData.common).length > 0)
}

/**
 * Repair the nested common.uni shape written by older versions, if present in
 * a uni-app file, and return its values in the proper common["uni.xxx"] form.
 */
function extractAndRemoveNestedUniAppEntries(localeData) {
  const extracted = {}

  for (const key of Object.keys(localeData)) {
    if (key === 'common.uni' || key.startsWith('common.uni.')) {
      addUniAppEntries(extracted, key, localeData[key])
      delete localeData[key]
    }
  }

  if (isPlainObject(localeData.common) && Object.prototype.hasOwnProperty.call(localeData.common, 'uni')) {
    addUniAppEntries(extracted, 'common.uni', localeData.common.uni)
    delete localeData.common.uni
  }

  return extracted
}

/**
 * Remove legacy common.uni entries from a normal H5 locale file and convert
 * them to the key format used by the matching uni-app locale file.
 */
function extractAndRemoveUniAppEntries(localeData) {
  const extracted = {}

  for (const key of Object.keys(localeData)) {
    if (key === 'common.uni' || key.startsWith('common.uni.')) {
      addUniAppEntries(extracted, key, localeData[key])
      delete localeData[key]
    }
  }

  if (isPlainObject(localeData.common) && Object.prototype.hasOwnProperty.call(localeData.common, 'uni')) {
    addUniAppEntries(extracted, 'common.uni', localeData.common.uni)
    delete localeData.common.uni

    if (Object.keys(localeData.common).length === 0) {
      delete localeData.common
    }
  }

  return extracted
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
  "en-ay": "东南亚-英语",
  "nl": "荷兰语",
  "et": "爱沙尼亚语",
  "lv": "拉脱维亚语",
  "pt": "葡萄牙语"
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
const autoModeTerminalWindows = new Map()
const autoModeTerminalStates = new Map()
const AUTO_MODE_PROJECT_TYPES = new Set(['h5', 'pc', 'admin'])

function assertAutoModeProjectType(projectType) {
  if (!AUTO_MODE_PROJECT_TYPES.has(projectType)) {
    throw new Error('Invalid auto mode project type')
  }
}

function getAutoModeTerminalState(projectType) {
  if (!autoModeTerminalStates.has(projectType)) {
    autoModeTerminalStates.set(projectType, { logs: [], progress: null })
  }
  return autoModeTerminalStates.get(projectType)
}

function sendToAutoModeTerminal(projectType, channel, payload) {
  const terminalWindow = autoModeTerminalWindows.get(projectType)
  if (terminalWindow && !terminalWindow.isDestroyed()) {
    terminalWindow.webContents.send(channel, payload)
  }
}

function clearAutoModeTerminalState(projectType) {
  const state = getAutoModeTerminalState(projectType)
  state.logs = []
  state.progress = null
  sendToAutoModeTerminal(projectType, 'auto-mode-terminal-clear', { projectType })
}

function publishAutoModeEvent(channel, payload) {
  const state = getAutoModeTerminalState(payload.projectType)
  if (channel === 'auto-mode-log') {
    state.logs.push(payload)
    if (state.logs.length > 2000) state.logs.shift()
  } else if (channel === 'auto-mode-progress') {
    state.progress = payload
  }

  sendToAutoModeTerminal(payload.projectType, channel, payload)
}

function openAutoModeTerminal(projectType) {
  assertAutoModeProjectType(projectType)

  const existingWindow = autoModeTerminalWindows.get(projectType)
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show()
    existingWindow.focus()
    return
  }

  const terminalWindow = new BrowserWindow({
    width: 760,
    height: 500,
    minWidth: 480,
    minHeight: 280,
    title: `Auto Mode Terminal - ${projectType.toUpperCase()}`,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  autoModeTerminalWindows.set(projectType, terminalWindow)

  terminalWindow.once('ready-to-show', () => {
    terminalWindow.show()
  })

  terminalWindow.webContents.once('did-finish-load', () => {
    const state = getAutoModeTerminalState(projectType)
    state.logs.forEach((entry) => terminalWindow.webContents.send('auto-mode-log', entry))
    if (state.progress) {
      terminalWindow.webContents.send('auto-mode-progress', state.progress)
    }
  })

  terminalWindow.on('closed', () => {
    autoModeTerminalWindows.delete(projectType)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auto-mode-terminal-closed', { projectType })
    }
  })

  terminalWindow.loadFile(path.join(__dirname, 'autoModeTerminal.html'), {
    query: { projectType }
  })
}

// ========== 自动更新配置 ==========

function initAutoUpdater() {
  // 不自动下载，由用户确认后再下载
  autoUpdater.autoDownload = false
  // 不自动安装退出
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('🔄 发现新版本:', info.version)
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('✅ 当前已是最新版本')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ 新版本下载完成:', info.version)
    mainWindow?.webContents.send('update-downloaded', {
      version: info.version
    })
  })

  autoUpdater.on('error', (error) => {
    console.error('❌ 自动更新出错:', error)
    mainWindow?.webContents.send('update-error', {
      message: error.message
    })
  })
}

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


/**
 * 读取表格工作簿。首行始终按表头返回，空单元格统一为字符串，方便渲染进程处理。
 */
function readSpreadsheetWorkbook(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('表格文件不存在或已被移动')
  }

  return XLSX.readFile(filePath, { cellDates: true })
}

ipcMain.handle('select-spreadsheet-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: '表格文件', extensions: ['xlsx', 'xls', 'csv'] }]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('get-spreadsheet-metadata', async (event, filePath) => {
  try {
    const workbook = readSpreadsheetWorkbook(filePath)
    const sheets = workbook.SheetNames.map(name => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: '',
        blankrows: false
      })
      const headers = Array.isArray(rows[0])
        ? rows[0].map(value => value == null ? '' : String(value))
        : []
      return { name, headers }
    })
    return { success: true, sheets }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('read-spreadsheet-sheet', async (event, filePath, sheetName) => {
  try {
    const workbook = readSpreadsheetWorkbook(filePath)
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      throw new Error('未找到所选工作表')
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false
    })
    return { success: true, rows }
  } catch (error) {
    return { success: false, error: error.message }
  }
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
    const result = processPcLocales(data.data, data.standardFile)
    return { success: true, data: result }
  } catch (error) {
    console.error('处理PC多语言失败:', error)
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

function isJavaScriptIdentifier(value) {
  return /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u.test(value)
}

function serializePcLocaleValue(value, depth = 0) {
  const indent = '  '
  const currentIndent = indent.repeat(depth)
  const childIndent = indent.repeat(depth + 1)

  if (value === null || typeof value !== 'object') {
    const serializedValue = JSON.stringify(value)
    return serializedValue === undefined ? 'undefined' : serializedValue
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map(item => `${childIndent}${serializePcLocaleValue(item, depth + 1)}`).join(',\n')}\n${currentIndent}]`
  }

  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'

  const serializedEntries = entries.map(([key, childValue]) => {
    const propertyName = isJavaScriptIdentifier(key) ? key : JSON.stringify(key)
    return `${childIndent}${propertyName}: ${serializePcLocaleValue(childValue, depth + 1)}`
  })
  return `{\n${serializedEntries.join(',\n')}\n${currentIndent}}`
}

function mergeLocaleFile(tempData, type, filePath) {
  if (type === 'admin') {
    mergeAdminLocales(filePath, tempData)
  } else if (type === 'pc') {
    // PC 端：读取 TS 文件，合并后写回 TS 格式
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `目标文件不存在: ${filePath}` }
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const jsonString = fileContent.replace('export default', '').trim()
    const targetData = new Function(`return ${jsonString}`)()

    const result = deepMerge(targetData, tempData)
    const outputContent = `export default ${serializePcLocaleValue(result)};`
    fs.writeFileSync(filePath, outputContent, 'utf-8')
  } else {
    // H5: common.uni.* belongs in the uni-app file for the selected language.
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Target file does not exist: ${filePath}` }
    }

    const targetFileName = path.basename(filePath)
    if (path.extname(targetFileName).toLowerCase() !== '.json' || targetFileName.toLowerCase().startsWith('uni-app.')) {
      return { success: false, error: `Select a primary language file (for example fr.json), not a uni-app file: ${filePath}` }
    }

    const normalData = {}
    const incomingUniAppData = {}
    for (const [key, value] of Object.entries(tempData)) {
      if (key === 'common.uni' || key.startsWith('common.uni.')) {
        addUniAppEntries(incomingUniAppData, key, value)
      } else {
        normalData[key] = value
      }
    }

    // Read and calculate every result before writing either file. This guarantees that
    // a missing/broken uni-app file cannot leave the normal locale half-updated.
    const targetRaw = fs.readFileSync(filePath, 'utf-8')
    const targetData = JSON.parse(targetRaw)
    const legacyUniAppData = extractAndRemoveUniAppEntries(targetData)
    const hasUniAppChanges = hasUniAppEntries(legacyUniAppData) || hasUniAppEntries(incomingUniAppData)
    const normalResult = deepMerge(targetData, normalData)

    let uniAppFilePath
    let uniAppResult
    if (hasUniAppChanges) {
      uniAppFilePath = path.join(path.dirname(filePath), `uni-app.${targetFileName}`)
      if (!fs.existsSync(uniAppFilePath)) {
        return { success: false, error: `Uni App target file does not exist: ${uniAppFilePath}` }
      }

      const uniAppRaw = fs.readFileSync(uniAppFilePath, 'utf-8')
      const uniAppTargetData = JSON.parse(uniAppRaw)
      const incorrectlyNestedUniAppData = extractAndRemoveNestedUniAppEntries(uniAppTargetData)
      // Existing entries moved out of fr.json are retained, while current Excel values win.
      uniAppResult = deepMerge(
        deepMerge(
          deepMerge(uniAppTargetData, incorrectlyNestedUniAppData),
          legacyUniAppData
        ),
        incomingUniAppData
      )
    }

    // Write the uni-app sibling first. If the second write ever fails, the normal file
    // still retains its old entries rather than silently losing common.uni.* translations.
    if (hasUniAppChanges) {
      fs.writeFileSync(uniAppFilePath, JSON.stringify(uniAppResult, null, 2), 'utf-8')
    }
    fs.writeFileSync(filePath, JSON.stringify(normalResult, null, 2), 'utf-8')
  }


  return { success: true }
}

function toH5LocaleImportIdentifier(localeCode) {
  return localeCode
    .split('-')
    .filter(Boolean)
    .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function findMatchingBrace(content, openingBraceIndex) {
  let depth = 0
  let quote = null
  let inLineComment = false
  let inBlockComment = false

  for (let index = openingBraceIndex; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (inLineComment) {
      if (char === '\n' || char === '\r') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (char === '\\') {
        index += 1
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '/' && nextChar === '/') {
      inLineComment = true
      index += 1
      continue
    }
    if (char === '/' && nextChar === '*') {
      inBlockComment = true
      index += 1
      continue
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function updateH5LocaleIndex(folderPath, localeCode) {
  const indexPath = path.join(folderPath, 'index.ts')
  if (!fs.existsSync(indexPath)) {
    return { warning: `H5 合并已完成，但未更新 index.ts：配置文件丢失（${indexPath}）。` }
  }

  let source
  try {
    source = fs.readFileSync(indexPath, 'utf-8')
  } catch (error) {
    return { warning: `H5 合并已完成，但读取 index.ts 失败：${error.message}` }
  }

  const messagesMatch = /\bconst\s+messages\s*=\s*{/.exec(source)
  if (!messagesMatch) {
    return { warning: 'H5 合并已完成，但未更新 index.ts：无法识别 const messages = { ... } 配置。' }
  }

  const openingBraceIndex = source.indexOf('{', messagesMatch.index)
  const closingBraceIndex = findMatchingBrace(source, openingBraceIndex)
  if (openingBraceIndex === -1 || closingBraceIndex === -1) {
    return { warning: 'H5 合并已完成，但未更新 index.ts：messages 配置结构异常。' }
  }

  const importIdentifier = toH5LocaleImportIdentifier(localeCode)
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(importIdentifier)) {
    return { warning: `H5 合并已完成，但未更新 index.ts：语言编号“${localeCode}”无法生成有效的导入变量名。` }
  }

  const messagesBody = source.slice(openingBraceIndex + 1, closingBraceIndex)
  const escapedLocaleCode = escapeRegExp(localeCode)
  const escapedImportIdentifier = escapeRegExp(importIdentifier)
  const propertyPattern = new RegExp(`(?:^|[,{\\n])\\s*(?:['"]${escapedLocaleCode}['"]|${escapedImportIdentifier})\\s*:`, 'm')
  if (propertyPattern.test(messagesBody)) {
    return { updated: false }
  }

  const closingLineStart = source.lastIndexOf('\n', closingBraceIndex) + 1
  const closingIndent = source.slice(closingLineStart, closingBraceIndex).match(/^\s*/)?.[0] || ''
  const propertyIndent = `${closingIndent}  `
  const propertyKey = localeCode.includes('-') ? `'${localeCode}'` : localeCode
  const propertyLine = `${propertyIndent}${propertyKey}: ${importIdentifier},`
  const bodyWithoutTrailingWhitespace = messagesBody.replace(/\s*$/, '')
  const normalizedBody = bodyWithoutTrailingWhitespace && !bodyWithoutTrailingWhitespace.endsWith(',')
    ? `${bodyWithoutTrailingWhitespace},`
    : bodyWithoutTrailingWhitespace
  const newMessagesBody = normalizedBody
    ? `${normalizedBody}\n${propertyLine}\n${closingIndent}`
    : `\n${propertyLine}\n${closingIndent}`
  let updatedSource = source.slice(0, openingBraceIndex + 1) + newMessagesBody + source.slice(closingBraceIndex)

  const importPathPattern = new RegExp(`^\\s*import\\s+[^\\r\\n]*?\\s+from\\s+['"]\\./${escapedLocaleCode}\\.json['"]\\s*;?\\s*$`, 'm')
  const importIdentifierPattern = new RegExp(`^\\s*import\\s+${escapedImportIdentifier}\\b`, 'm')
  if (!importPathPattern.test(updatedSource) && !importIdentifierPattern.test(updatedSource)) {
    const importLinePattern = /^[^\S\r\n]*import[^\r\n]*(?:\r?\n|$)/gm
    const imports = [...updatedSource.matchAll(importLinePattern)]
    const lastImport = imports.at(-1)
    const insertAt = lastImport ? lastImport.index + lastImport[0].length : 0
    const prefix = updatedSource.slice(0, insertAt)
    const suffix = updatedSource.slice(insertAt)
    const needsLineBreak = prefix.length > 0 && !/\r?\n$/.test(prefix)
    updatedSource = `${prefix}${needsLineBreak ? '\n' : ''}import ${importIdentifier} from './${localeCode}.json'\n${suffix}`
  }

  try {
    fs.writeFileSync(indexPath, updatedSource, 'utf-8')
    return { updated: true }
  } catch (error) {
    return { warning: `H5 合并已完成，但写入 index.ts 失败：${error.message}` }
  }
}

function getLocaleDisplayName(type, localeCode) {
  try {
    const langMapPath = path.join(app.getPath('userData'), `langMap-${type}.json`)
    const titleKeysPath = getConfigPath()
    const langMap = fs.existsSync(langMapPath)
      ? JSON.parse(fs.readFileSync(langMapPath, 'utf-8'))
      : {}
    const titleKeys = fs.existsSync(titleKeysPath)
      ? JSON.parse(fs.readFileSync(titleKeysPath, 'utf-8'))
      : {}
    const extension = type === 'h5' ? '.json' : type === 'pc' ? '.ts' : ''
    const commonCode = langMap[localeCode] || langMap[`${localeCode}${extension}`]
    const displayName = commonCode ? titleKeys[commonCode] || titleKeys[localeCode] : titleKeys[localeCode]

    // Mapping files are user-maintained. A malformed/missing mapping should never block locale creation.
    return typeof displayName === 'string' ? displayName.replace(/[\r\n]+/g, ' ').trim() : ''
  } catch (error) {
    return ''
  }
}

function updatePcLocaleIndex(folderPath, localeCode, displayName = '') {
  const indexPath = path.join(path.dirname(folderPath), 'index.ts')
  if (!fs.existsSync(indexPath)) {
    return { warning: `PC 合并已完成，但未更新 index.ts：配置文件丢失（${indexPath}）。` }
  }

  let source
  try {
    source = fs.readFileSync(indexPath, 'utf-8')
  } catch (error) {
    return { warning: `PC 合并已完成，但读取 index.ts 失败：${error.message}` }
  }

  const importIdentifier = toH5LocaleImportIdentifier(localeCode)
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(importIdentifier)) {
    return { warning: `PC 合并已完成，但未更新 index.ts：语言编号“${localeCode}”无法生成有效的导入变量名。` }
  }

  const i18nMatch = /\bconst\s+i18n\s*=/.exec(source)
  if (!i18nMatch) {
    return { warning: 'PC 合并已完成，但未更新 index.ts：无法识别 const i18n 配置。' }
  }

  const i18nOpeningBraceIndex = source.indexOf('{', i18nMatch.index)
  const i18nClosingBraceIndex = findMatchingBrace(source, i18nOpeningBraceIndex)
  if (i18nOpeningBraceIndex === -1 || i18nClosingBraceIndex === -1) {
    return { warning: 'PC 合并已完成，但未更新 index.ts：i18n 配置结构异常。' }
  }

  const i18nBody = source.slice(i18nOpeningBraceIndex + 1, i18nClosingBraceIndex)
  const messagesMatch = /\bmessages\s*:\s*{/.exec(i18nBody)
  if (!messagesMatch) {
    return { warning: 'PC 合并已完成，但未更新 index.ts：无法识别 i18n.messages 配置。' }
  }

  const messagesStartIndex = i18nOpeningBraceIndex + 1 + messagesMatch.index
  const messagesOpeningBraceIndex = source.indexOf('{', messagesStartIndex)
  const messagesClosingBraceIndex = findMatchingBrace(source, messagesOpeningBraceIndex)
  if (messagesOpeningBraceIndex === -1 || messagesClosingBraceIndex === -1 || messagesClosingBraceIndex > i18nClosingBraceIndex) {
    return { warning: 'PC 合并已完成，但未更新 index.ts：messages 配置结构异常。' }
  }

  const escapedLocaleCode = escapeRegExp(localeCode)
  const escapedImportIdentifier = escapeRegExp(importIdentifier)
  const messagesBody = source.slice(messagesOpeningBraceIndex + 1, messagesClosingBraceIndex)
  const propertyPattern = new RegExp(
    `(?:^|[,{\\n])\\s*(?:['"]${escapedLocaleCode}['"]\\s*:|${escapedImportIdentifier}(?:\\s*:|\\s*(?=,|$)))`,
    'm'
  )
  const importPathPattern = new RegExp(
    `^\\s*import\\s+[^\\r\\n]*?\\s+from\\s+['"]\\./${escapedLocaleCode}['"]\\s*;?\\s*(?://.*)?$`,
    'm'
  )
  const importIdentifierPattern = new RegExp(`^\\s*import\\s+${escapedImportIdentifier}\\b`, 'm')

  // Existing language registration takes precedence. Do not try to partially rebuild user-maintained config.
  if (propertyPattern.test(messagesBody) || importPathPattern.test(source)) {
    return { updated: false }
  }
  if (importIdentifierPattern.test(source)) {
    return { warning: `PC 合并已完成，但未更新 index.ts：导入变量“${importIdentifier}”已被其他配置占用。` }
  }

  const closingLineStart = source.lastIndexOf('\n', messagesClosingBraceIndex) + 1
  const closingIndent = source.slice(closingLineStart, messagesClosingBraceIndex).match(/^\s*/)?.[0] || ''
  const propertyIndent = `${closingIndent}  `
  const propertyLine = localeCode.includes('-')
    ? `${propertyIndent}'${localeCode}': ${importIdentifier},`
    : `${propertyIndent}${importIdentifier},`
  const bodyWithoutTrailingWhitespace = messagesBody.replace(/\s*$/, '')
  const normalizedBody = bodyWithoutTrailingWhitespace && !bodyWithoutTrailingWhitespace.endsWith(',')
    ? `${bodyWithoutTrailingWhitespace},`
    : bodyWithoutTrailingWhitespace
  const newMessagesBody = normalizedBody
    ? `${normalizedBody}\n${propertyLine}\n${closingIndent}`
    : `\n${propertyLine}\n${closingIndent}`
  let updatedSource = source.slice(0, messagesOpeningBraceIndex + 1) + newMessagesBody + source.slice(messagesClosingBraceIndex)

  const comment = displayName ? ` // ${displayName}` : ''
  const importLinePattern = /^[^\S\r\n]*import[^\r\n]*(?:\r?\n|$)/gm
  const imports = [...updatedSource.matchAll(importLinePattern)]
  const lastImport = imports.at(-1)
  const insertAt = lastImport ? lastImport.index + lastImport[0].length : 0
  const prefix = updatedSource.slice(0, insertAt)
  const suffix = updatedSource.slice(insertAt)
  const needsLineBreak = prefix.length > 0 && !/\r?\n$/.test(prefix)
  updatedSource = `${prefix}${needsLineBreak ? '\n' : ''}import ${importIdentifier} from "./${path.basename(folderPath)}/${localeCode}";${comment}\n${suffix}`

  try {
    fs.writeFileSync(indexPath, updatedSource, 'utf-8')
    return { updated: true }
  } catch (error) {
    return { warning: `PC 合并已完成，但写入 index.ts 失败：${error.message}` }
  }
}

function findExistingFileInParentDirectories(folderPath, fileName) {
  let currentDirectory = path.resolve(folderPath)
  const rootDirectory = path.parse(currentDirectory).root

  while (currentDirectory !== rootDirectory) {
    currentDirectory = path.dirname(currentDirectory)
    const candidatePath = path.join(currentDirectory, fileName)
    if (fs.existsSync(candidatePath)) return candidatePath
  }

  return null
}

function updatePcAppVue(folderPath, localeCode, displayName = '') {
  // PC locale folders may be nested, such as src/languages/locales.
  const appVuePath = findExistingFileInParentDirectories(folderPath, 'App.vue')
  if (!appVuePath) {
    return { warning: `PC 合并已完成，但未更新 App.vue：未在多语言目录的上级目录中找到 App.vue（${folderPath}）。` }
  }

  let source
  try {
    source = fs.readFileSync(appVuePath, 'utf-8')
  } catch (error) {
    return { warning: `PC 合并已完成，但读取 App.vue 失败：${error.message}` }
  }

  const importIdentifier = toH5LocaleImportIdentifier(localeCode)
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(importIdentifier)) {
    return { warning: `PC 合并已完成，但未更新 App.vue：语言编号“${localeCode}”无法生成有效的导入变量名。` }
  }

  const escapedLocaleCode = escapeRegExp(localeCode)
  const escapedImportIdentifier = escapeRegExp(importIdentifier)
  const importPathPattern = new RegExp(
    `^\\s*import\\s+[^\\r\\n]*?\\s+from\\s+['"]element-plus/es/locale/lang/${escapedLocaleCode}['"]\\s*;?\\s*(?://.*)?$`,
    'm'
  )
  const importIdentifierPattern = new RegExp(`^\\s*import\\s+${escapedImportIdentifier}\\b`, 'm')
  const localeIfPattern = new RegExp(`\\bif\\s*\\(\\s*code\\s*={2,3}\\s*['"]${escapedLocaleCode}['"]\\s*\\)\\s*return\\s+[^;\\r\\n]+;?`, 'g')

  // One existing registration is treated as user-managed and is not duplicated or altered.
  if (importPathPattern.test(source) || localeIfPattern.test(source)) {
    return { updated: false }
  }
  if (importIdentifierPattern.test(source)) {
    return { warning: `PC 合并已完成，但未更新 App.vue：导入变量“${importIdentifier}”已被其他配置占用。` }
  }

  const localeMatch = /\bconst\s+locale\s*=/.exec(source)
  if (!localeMatch) {
    return { warning: 'PC 合并已完成，但未更新 App.vue：无法识别 const locale 计算属性。' }
  }

  const localeOpeningBraceIndex = source.indexOf('{', localeMatch.index)
  const localeClosingBraceIndex = findMatchingBrace(source, localeOpeningBraceIndex)
  if (localeOpeningBraceIndex === -1 || localeClosingBraceIndex === -1) {
    return { warning: 'PC 合并已完成，但未更新 App.vue：locale 计算属性结构异常。' }
  }

  const localeBodyStart = localeOpeningBraceIndex + 1
  const localeBody = source.slice(localeBodyStart, localeClosingBraceIndex)
  const codeIfPattern = /\bif\s*\(\s*code\s*={2,3}\s*['"][^'"]+['"]\s*\)\s*return\s+[^;\r\n]+;?/g
  const codeIfs = [...localeBody.matchAll(codeIfPattern)]
  if (codeIfs.length === 0) {
    return { warning: 'PC 合并已完成，但未更新 App.vue：未找到 locale 计算属性中的语言 if 配置。' }
  }

  const lastCodeIf = codeIfs.at(-1)
  const conditionEndIndex = localeBodyStart + lastCodeIf.index + lastCodeIf[0].length
  const lineStart = source.lastIndexOf('\n', conditionEndIndex) + 1
  const lineIndent = source.slice(lineStart, conditionEndIndex).match(/^\s*/)?.[0] || ''
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  let updatedSource = `${source.slice(0, conditionEndIndex)}${newline}${lineIndent}if (code == "${localeCode}") return ${importIdentifier};${source.slice(conditionEndIndex)}`

  const comment = displayName ? ` // ${displayName}` : ''
  const importLinePattern = /^[^\S\r\n]*import[^\r\n]*(?:\r?\n|$)/gm
  const imports = [...updatedSource.matchAll(importLinePattern)]
  const lastImport = imports.at(-1)
  const insertAt = lastImport ? lastImport.index + lastImport[0].length : 0
  const prefix = updatedSource.slice(0, insertAt)
  const suffix = updatedSource.slice(insertAt)
  const needsLineBreak = prefix.length > 0 && !/\r?\n$/.test(prefix)
  updatedSource = `${prefix}${needsLineBreak ? newline : ''}import ${importIdentifier} from "element-plus/es/locale/lang/${localeCode}";${comment}${newline}${suffix}`

  try {
    fs.writeFileSync(appVuePath, updatedSource, 'utf-8')
    return { updated: true }
  } catch (error) {
    return { warning: `PC 合并已完成，但写入 App.vue 失败：${error.message}` }
  }
}

function findExistingRelativeFileInParentDirectories(folderPath, relativeFilePath) {
  let currentDirectory = path.resolve(folderPath)
  const rootDirectory = path.parse(currentDirectory).root

  while (currentDirectory !== rootDirectory) {
    currentDirectory = path.dirname(currentDirectory)
    const candidatePath = path.join(currentDirectory, relativeFilePath)
    if (fs.existsSync(candidatePath)) return candidatePath
  }

  return null
}

function updateAdminAppVue(folderPath, localeCode, displayName = '') {
  const appVuePath = findExistingFileInParentDirectories(folderPath, 'App.vue')
  if (!appVuePath) {
    return { warning: `Admin 合并已完成，但未更新 App.vue：未在多语言目录的上级目录中找到 App.vue（${folderPath}）。` }
  }

  let source
  try {
    source = fs.readFileSync(appVuePath, 'utf-8')
  } catch (error) {
    return { warning: `Admin 合并已完成，但读取 App.vue 失败：${error.message}` }
  }

  const importIdentifier = toH5LocaleImportIdentifier(localeCode)
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(importIdentifier)) {
    return { warning: `Admin 合并已完成，但未更新 App.vue：语言编号“${localeCode}”无法生成有效的导入变量名。` }
  }

  const escapedLocaleCode = escapeRegExp(localeCode)
  const escapedImportIdentifier = escapeRegExp(importIdentifier)
  const importPathPattern = new RegExp(
    `^\\s*import\\s+[^\\r\\n]*?\\s+from\\s+['"]element-plus/es/locale/lang/${escapedLocaleCode}['"]\\s*;?\\s*(?://.*)?$`,
    'm'
  )
  const importIdentifierPattern = new RegExp(`^\\s*import\\s+${escapedImportIdentifier}\\b`, 'm')
  const localeIfPattern = new RegExp(`\\bif\\s*\\(\\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\\.[A-Za-z_$][A-Za-z0-9_$]*)*\\s*={2,3}\\s*['"]${escapedLocaleCode}['"]\\s*\\)\\s*return\\s+[^;\\r\\n]+;?`, 'g')

  if (importPathPattern.test(source) || localeIfPattern.test(source)) {
    return { updated: false }
  }
  if (importIdentifierPattern.test(source)) {
    return { warning: `Admin 合并已完成，但未更新 App.vue：导入变量“${importIdentifier}”已被其他配置占用。` }
  }

  const localeMatch = /\bconst\s+locale\s*=/.exec(source)
  if (!localeMatch) {
    return { warning: 'Admin 合并已完成，但未更新 App.vue：无法识别 const locale 计算属性。' }
  }

  const localeOpeningBraceIndex = source.indexOf('{', localeMatch.index)
  const localeClosingBraceIndex = findMatchingBrace(source, localeOpeningBraceIndex)
  if (localeOpeningBraceIndex === -1 || localeClosingBraceIndex === -1) {
    return { warning: 'Admin 合并已完成，但未更新 App.vue：locale 计算属性结构异常。' }
  }

  const localeBodyStart = localeOpeningBraceIndex + 1
  const localeBody = source.slice(localeBodyStart, localeClosingBraceIndex)
  const codeIfPattern = /\bif\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\s*(={2,3})\s*(['"])[^'"]+\3\s*\)\s*return\s+[^;\r\n]+;?/g
  const codeIfs = [...localeBody.matchAll(codeIfPattern)]
  if (codeIfs.length === 0) {
    return { warning: 'Admin 合并已完成，但未更新 App.vue：未找到 locale 计算属性中的语言 if 配置。' }
  }

  const lastCodeIf = codeIfs.at(-1)
  const conditionSubject = lastCodeIf[1]
  const conditionOperator = lastCodeIf[2]
  const conditionEndIndex = localeBodyStart + lastCodeIf.index + lastCodeIf[0].length
  const lineStart = source.lastIndexOf('\n', conditionEndIndex) + 1
  const lineIndent = source.slice(lineStart, conditionEndIndex).match(/^\s*/)?.[0] || ''
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  let updatedSource = `${source.slice(0, conditionEndIndex)}${newline}${lineIndent}if (${conditionSubject} ${conditionOperator} "${localeCode}") return ${importIdentifier};${source.slice(conditionEndIndex)}`

  const comment = displayName ? ` // ${displayName}` : ''
  const importLinePattern = /^[^\S\r\n]*import[^\r\n]*(?:\r?\n|$)/gm
  const imports = [...updatedSource.matchAll(importLinePattern)]
  const lastImport = imports.at(-1)
  const insertAt = lastImport ? lastImport.index + lastImport[0].length : 0
  const prefix = updatedSource.slice(0, insertAt)
  const suffix = updatedSource.slice(insertAt)
  const needsLineBreak = prefix.length > 0 && !/\r?\n$/.test(prefix)
  updatedSource = `${prefix}${needsLineBreak ? newline : ''}import ${importIdentifier} from "element-plus/es/locale/lang/${localeCode}";${comment}${newline}${suffix}`

  try {
    fs.writeFileSync(appVuePath, updatedSource, 'utf-8')
    return { updated: true }
  } catch (error) {
    return { warning: `Admin 合并已完成，但写入 App.vue 失败：${error.message}` }
  }
}

function findMatchingSquareBracket(content, openingBracketIndex) {
  let depth = 0
  let quote = null
  let inLineComment = false
  let inBlockComment = false

  for (let index = openingBracketIndex; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (inLineComment) {
      if (char === '\n' || char === '\r') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (char === '\\') {
        index += 1
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '/' && nextChar === '/') {
      inLineComment = true
      index += 1
      continue
    }
    if (char === '/' && nextChar === '*') {
      inBlockComment = true
      index += 1
      continue
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function updateAdminLanguageList(folderPath, localeCode, displayName = '') {
  const commonEnumPath = findExistingRelativeFileInParentDirectories(folderPath, path.join('enums', 'commonEnum.ts'))
  if (!commonEnumPath) {
    return { warning: `Admin 合并已完成，但未更新 src/enums/commonEnum.ts：配置文件丢失（${folderPath}）。` }
  }

  let source
  try {
    source = fs.readFileSync(commonEnumPath, 'utf-8')
  } catch (error) {
    return { warning: `Admin 合并已完成，但读取 src/enums/commonEnum.ts 失败：${error.message}` }
  }

  const languageListMatch = /\bexport\s+const\s+languageList(?:\s*:\s*[^=]+)?\s*=\s*\[/.exec(source)
  if (!languageListMatch) {
    return { warning: 'Admin 合并已完成，但未更新 src/enums/commonEnum.ts：无法识别 export const languageList 配置。' }
  }

  const openingBracketIndex = source.indexOf('[', languageListMatch.index)
  const closingBracketIndex = findMatchingSquareBracket(source, openingBracketIndex)
  if (openingBracketIndex === -1 || closingBracketIndex === -1) {
    return { warning: 'Admin 合并已完成，但未更新 src/enums/commonEnum.ts：languageList 配置结构异常。' }
  }

  const listBody = source.slice(openingBracketIndex + 1, closingBracketIndex)
  const escapedLocaleCode = escapeRegExp(localeCode)
  const existingValuePattern = new RegExp(`\\bvalue\\s*:\\s*['"]${escapedLocaleCode}['"]`)
  if (existingValuePattern.test(listBody)) {
    return { updated: false }
  }

  const closingLineStart = source.lastIndexOf('\n', closingBracketIndex) + 1
  const closingIndent = source.slice(closingLineStart, closingBracketIndex).match(/^\s*/)?.[0] || ''
  const itemIndent = `${closingIndent}  `
  const languageLabel = displayName || localeCode
  const languageItem = `${itemIndent}{ label: ${JSON.stringify(languageLabel)}, value: ${JSON.stringify(localeCode)}, code: ${JSON.stringify(localeCode.toUpperCase())} }`
  const bodyWithoutTrailingWhitespace = listBody.replace(/\s*$/, '')
  const normalizedBody = bodyWithoutTrailingWhitespace && !bodyWithoutTrailingWhitespace.endsWith(',')
    ? `${bodyWithoutTrailingWhitespace},`
    : bodyWithoutTrailingWhitespace
  const newListBody = normalizedBody
    ? `${normalizedBody}\n${languageItem}\n${closingIndent}`
    : `\n${languageItem}\n${closingIndent}`
  const updatedSource = source.slice(0, openingBracketIndex + 1) + newListBody + source.slice(closingBracketIndex)

  try {
    fs.writeFileSync(commonEnumPath, updatedSource, 'utf-8')
    return { updated: true }
  } catch (error) {
    return { warning: `Admin 合并已完成，但写入 src/enums/commonEnum.ts 失败：${error.message}` }
  }
}

function updateAdminI18nLang(folderPath, localeCode) {
  const utilsIndexPath = findExistingRelativeFileInParentDirectories(folderPath, path.join('utils', 'index.ts'))
  if (!utilsIndexPath) {
    return { warning: `Admin 合并已完成，但未更新 src/utils/index.ts：配置文件丢失（${folderPath}）。` }
  }

  let source
  try {
    source = fs.readFileSync(utilsIndexPath, 'utf-8')
  } catch (error) {
    return { warning: `Admin 合并已完成，但读取 src/utils/index.ts 失败：${error.message}` }
  }

  const functionMatch = /\bexport\s+function\s+getI18nLang\s*\([^)]*\)\s*{/.exec(source)
  if (!functionMatch) {
    return { warning: 'Admin 合并已完成，但未更新 src/utils/index.ts：无法识别 export function getI18nLang 配置。' }
  }

  const functionOpeningBraceIndex = source.indexOf('{', functionMatch.index)
  const functionClosingBraceIndex = findMatchingBrace(source, functionOpeningBraceIndex)
  if (functionOpeningBraceIndex === -1 || functionClosingBraceIndex === -1) {
    return { warning: 'Admin 合并已完成，但未更新 src/utils/index.ts：getI18nLang 函数结构异常。' }
  }

  const functionBodyStart = functionOpeningBraceIndex + 1
  const functionBody = source.slice(functionBodyStart, functionClosingBraceIndex)
  const switchMatch = /\bswitch\s*\([^)]*\)\s*{/.exec(functionBody)
  if (!switchMatch) {
    return { warning: 'Admin 合并已完成，但未更新 src/utils/index.ts：未找到 getI18nLang 中的 switch 配置。' }
  }

  const switchOpeningBraceIndex = source.indexOf('{', functionBodyStart + switchMatch.index)
  const switchClosingBraceIndex = findMatchingBrace(source, switchOpeningBraceIndex)
  if (switchOpeningBraceIndex === -1 || switchClosingBraceIndex === -1) {
    return { warning: 'Admin 合并已完成，但未更新 src/utils/index.ts：getI18nLang 的 switch 结构异常。' }
  }

  const switchBody = source.slice(switchOpeningBraceIndex + 1, switchClosingBraceIndex)
  const escapedLocaleCode = escapeRegExp(localeCode)
  const existingCasePattern = new RegExp(`\\bcase\\s*(['"])${escapedLocaleCode}\\1\\s*:`)
  if (existingCasePattern.test(switchBody)) {
    return { updated: false }
  }

  const defaultMatch = /\bdefault\s*:/.exec(switchBody)
  if (!defaultMatch) {
    return { warning: 'Admin 合并已完成，但未更新 src/utils/index.ts：未找到 getI18nLang 中的 default 分支。' }
  }

  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const defaultStartIndex = switchOpeningBraceIndex + 1 + defaultMatch.index
  const defaultLineStart = source.lastIndexOf('\n', defaultStartIndex) + 1
  const caseIndent = source.slice(defaultLineStart, defaultStartIndex).match(/^\s*/)?.[0] || '    '
  const codeIndent = `${caseIndent}  `
  const caseBlock = `${caseIndent}case "${localeCode}":${newline}${codeIndent}code = "${localeCode}";${newline}${codeIndent}break;${newline}`
  const updatedSource = `${source.slice(0, defaultLineStart)}${caseBlock}${source.slice(defaultLineStart)}`

  try {
    fs.writeFileSync(utilsIndexPath, updatedSource, 'utf-8')
    return { updated: true }
  } catch (error) {
    return { warning: `Admin 合并已完成，但写入 src/utils/index.ts 失败：${error.message}` }
  }
}

function validateNewLocaleCode(localeCode) {
  if (!/^[a-z0-9_-]+$/.test(localeCode)) {
    throw new Error('Language code may contain only lowercase English letters, numbers, hyphens, and underscores.')
  }
}

function isDirectChildPath(folderPath, childPath) {
  return path.dirname(path.resolve(childPath)) === path.resolve(folderPath)
}

function getNewLocaleConflictNames(type, localeCode) {
  if (type === 'h5') return [localeCode, `${localeCode}.json`, `uni-app.${localeCode}.json`]
  if (type === 'pc') return [localeCode, `${localeCode}.ts`]
  return [localeCode]
}

function assertNewLocaleTargetAvailable(type, folderPath, localeCode) {
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new Error(`Target folder does not exist: ${folderPath}`)
  }

  const existingNames = new Set(fs.readdirSync(folderPath).map(name => name.toLowerCase()))
  const conflict = getNewLocaleConflictNames(type, localeCode).find(name => existingNames.has(name.toLowerCase()))
  if (conflict) {
    throw new Error(`A locale file or folder already exists for language code "${localeCode}": ${conflict}`)
  }
}

function assertTemplateLocale(type, folderPath, templatePath) {
  if (!templatePath || !fs.existsSync(templatePath) || !isDirectChildPath(folderPath, templatePath)) {
    throw new Error('Please select a valid template language from the target folder.')
  }

  const stats = fs.statSync(templatePath)
  const fileName = path.basename(templatePath)
  if (type === 'admin') {
    if (!stats.isDirectory()) throw new Error('Admin template language must be a folder.')
    return
  }

  const extension = type === 'h5' ? '.json' : '.ts'
  if (!stats.isFile() || path.extname(fileName).toLowerCase() !== extension ||
      (type === 'h5' && fileName.toLowerCase().startsWith('uni-app.'))) {
    throw new Error(`Template language must be a ${extension} locale file.`)
  }
}

function createLocaleFromTemplate(tempData, type, folderPath, localeCode, templatePath) {
  if (!['h5', 'pc', 'admin'].includes(type)) {
    throw new Error('Invalid locale type.')
  }

  const normalizedCode = String(localeCode || '').trim()
  const normalizedFolderPath = path.resolve(folderPath || '')
  const normalizedTemplatePath = path.resolve(templatePath || '')
  validateNewLocaleCode(normalizedCode)
  assertNewLocaleTargetAvailable(type, normalizedFolderPath, normalizedCode)
  assertTemplateLocale(type, normalizedFolderPath, normalizedTemplatePath)

  const createdPaths = []
  try {
    let targetPath
    if (type === 'admin') {
      targetPath = path.join(normalizedFolderPath, normalizedCode)
      fs.cpSync(normalizedTemplatePath, targetPath, { recursive: true, force: false, errorOnExist: true })
      createdPaths.push(targetPath)
    } else {
      const extension = type === 'h5' ? '.json' : '.ts'
      targetPath = path.join(normalizedFolderPath, `${normalizedCode}${extension}`)
      fs.copyFileSync(normalizedTemplatePath, targetPath, fs.constants.COPYFILE_EXCL)
      createdPaths.push(targetPath)

      if (type === 'h5') {
        const templateUniAppPath = path.join(normalizedFolderPath, `uni-app.${path.basename(normalizedTemplatePath)}`)
        const targetUniAppPath = path.join(normalizedFolderPath, `uni-app.${normalizedCode}.json`)
        const requiresUniAppFile = Object.keys(tempData).some(key => key === 'common.uni' || key.startsWith('common.uni.'))

        if (fs.existsSync(templateUniAppPath)) {
          fs.copyFileSync(templateUniAppPath, targetUniAppPath, fs.constants.COPYFILE_EXCL)
          createdPaths.push(targetUniAppPath)
        } else if (requiresUniAppFile) {
          throw new Error(`The selected H5 template is missing its uni-app file: ${templateUniAppPath}`)
        }
      }
    }

    const mergeResult = mergeLocaleFile(tempData, type, targetPath)
    if (!mergeResult.success) throw new Error(mergeResult.error || 'Failed to merge locale data.')

    const warnings = []
    if (type === 'h5') {
      const indexResult = updateH5LocaleIndex(normalizedFolderPath, normalizedCode)
      if (indexResult.warning) warnings.push(indexResult.warning)
    } else if (type === 'pc') {
      const displayName = getLocaleDisplayName('pc', normalizedCode)
      const indexResult = updatePcLocaleIndex(normalizedFolderPath, normalizedCode, displayName)
      const appVueResult = updatePcAppVue(normalizedFolderPath, normalizedCode, displayName)
      if (indexResult.warning) warnings.push(indexResult.warning)
      if (appVueResult.warning) warnings.push(appVueResult.warning)
    } else if (type === 'admin') {
      const displayName = getLocaleDisplayName('admin', normalizedCode) || normalizedCode
      const appVueResult = updateAdminAppVue(normalizedFolderPath, normalizedCode, displayName)
      const languageListResult = updateAdminLanguageList(normalizedFolderPath, normalizedCode, displayName)
      const i18nLangResult = updateAdminI18nLang(normalizedFolderPath, normalizedCode)
      if (appVueResult.warning) warnings.push(appVueResult.warning)
      if (languageListResult.warning) warnings.push(languageListResult.warning)
      if (i18nLangResult.warning) warnings.push(i18nLangResult.warning)
    }

    return { success: true, targetPath, warning: warnings.join('\n') || undefined }
  } catch (error) {
    createdPaths.reverse().forEach(createdPath => {
      try {
        fs.rmSync(createdPath, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error('Failed to clean up newly created locale path:', cleanupError)
      }
    })
    throw error
  }
}

ipcMain.handle('merge-locale-file', async (event, tempDataStr, type, filePath) => {
  try {
    const tempData = JSON.parse(tempDataStr)

    return mergeLocaleFile(tempData, type, filePath)
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('create-locale-from-template', async (event, tempDataStr, type, folderPath, localeCode, templatePath) => {
  try {
    const tempData = JSON.parse(tempDataStr)
    return createLocaleFromTemplate(tempData, type, folderPath, localeCode, templatePath)
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
  // 初始化 PC↔H5 同步语言映射文件
  initSyncLangMapFile()
  // 初始化项目路径配置文件
  initProjectPathsFile()
  // 初始化自动模式配置文件
  initAutoModeConfig()
  // 初始化自动更新
  initAutoUpdater()

  createWindow()

  // 生产环境启动后自动检查更新
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('自动检查更新失败:', err)
      })
    }, 3000)
  }

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

ipcMain.handle('batch-add-locale', (event, dirPath, excludePattern, targetProperty, objectsToAddStr, type = 'h5', strictTranslations = false) => {
  try {
    const result = batchAddLocales(dirPath, excludePattern, targetProperty, objectsToAddStr, type, strictTranslations)
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('batch-add-locale-pc', (event, dirPath, excludePattern, targetProperty, objectsToAddStr, type = 'pc', strictTranslations = false) => {
  try {
    const result = batchAddLocalesPc(dirPath, excludePattern, targetProperty, objectsToAddStr, type, strictTranslations)
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('batch-add-locale-admin', (event, localesPath, targetProperty, objectsToAddStr, type = 'admin', strictTranslations = false) => {
  try {
    const result = batchAddLocalesAdmin(localesPath, targetProperty, objectsToAddStr, type, strictTranslations)
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

// ========== 项目路径持久化 ==========

const PROJECT_PATHS_FILE = 'project-paths.json'

const DEFAULT_PROJECT_PATHS = {
  h5: '',
  pc: '',
  admin: ''
}

function getProjectPathsFilePath() {
  return path.join(app.getPath('userData'), PROJECT_PATHS_FILE)
}

function initProjectPathsFile() {
  const filePath = getProjectPathsFilePath()
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_PROJECT_PATHS, null, 2), 'utf8')
      console.log('✅ 已创建默认项目路径配置文件:', filePath)
    } catch (error) {
      console.error('❌ 创建项目路径配置文件失败:', error)
    }
  }
}

ipcMain.handle('get-project-paths', () => {
  try {
    const filePath = getProjectPathsFilePath()
    if (fs.existsSync(filePath)) {
      return { success: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }
    }
    return { success: true, data: DEFAULT_PROJECT_PATHS }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-project-paths', (event, dataStr) => {
  try {
    const filePath = getProjectPathsFilePath()
    fs.writeFileSync(filePath, dataStr, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ========== PC ↔ H5 同步相关 ==========

ipcMain.handle('get-sync-lang-map', () => {
  try {
    const data = loadSyncLangMap()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-sync-lang-map', (event, dataStr) => {
  try {
    const filePath = getSyncLangMapPath()
    fs.writeFileSync(filePath, dataStr, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('sync-locale-key', async (event, params) => {
  try {
    const { sourceDir, targetDir, sourceKey, targetKey, selectedLangs, direction } = params
    const results = syncLocaleKey(sourceDir, targetDir, sourceKey, targetKey, selectedLangs, direction)
    return { success: true, results }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ========== 自动模式相关 ==========

ipcMain.handle('get-auto-mode-config', () => {
  try {
    const data = loadAutoModeConfig()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-auto-mode-config', (event, dataStr) => {
  try {
    const config = JSON.parse(dataStr)
    saveAutoModeConfig(config)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-auto-mode-terminal', (event, projectType) => {
  try {
    openAutoModeTerminal(projectType)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('close-auto-mode-terminal', (event, projectType) => {
  try {
    assertAutoModeProjectType(projectType)
    const terminalWindow = autoModeTerminalWindows.get(projectType)
    if (terminalWindow && !terminalWindow.isDestroyed()) terminalWindow.close()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('clear-auto-mode-terminal-logs', (event, projectType) => {
  try {
    assertAutoModeProjectType(projectType)
    clearAutoModeTerminalState(projectType)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('auto-clone-project', async (event, projectType) => {
  try {
    assertAutoModeProjectType(projectType)
    clearAutoModeTerminalState(projectType)
    const result = await autoCloneProject(
      projectType,
      (type, data) => {
        // 通过 IPC 向渲染进程发送日志
        publishAutoModeEvent('auto-mode-log', { type, data, projectType })
      },
      (step, percent) => {
        // 通过 IPC 向渲染进程发送进度
        publishAutoModeEvent('auto-mode-progress', { step, percent, projectType })
      }
    )
    return result
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ========== 自动更新相关 ==========

ipcMain.handle('check-for-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    const currentVersion = app.getVersion()
    const remoteVersion = result?.updateInfo?.version
    return {
      hasUpdate: remoteVersion && remoteVersion !== currentVersion,
      currentVersion,
      remoteVersion,
      releaseNotes: result?.updateInfo?.releaseNotes,
      releaseDate: result?.updateInfo?.releaseDate
    }
  } catch (error) {
    return { hasUpdate: false, error: error.message }
  }
})

ipcMain.handle('download-update', async () => {
  try {
    const downloadResult = await autoUpdater.downloadUpdate()
    return { success: true, downloadResult }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
  return { success: true }
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})
