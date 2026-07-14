const fs = require('fs')
const path = require('path')
const { app } = require('electron')

/**
 * 默认的 H5 ↔ PC 语言编码映射表
 * key = H5 语言编码, value = PC 语言编码
 * 用于解决两端语言文件命名不一致的问题
 * 例如: H5 的 'es-col' 对应 PC 的 'col-es'
 */
const DEFAULT_SYNC_LANG_MAP = {
  "zh-Hans": "zh",
  "bg": "bg",
  "de": "de",
  "el": "el",
  "es": "es",
  "he": "he",
  "hu": "hu",
  "it": "it",
  "pl": "pl",
  "sk": "sk",
  "en": "en",
  "lt": "lt",
  "tr": "tr",
  "uk": "uk",
  "ka": "ka",
  "kk": "kk",
  "ky": "ky",
  "mn": "mn",
  "ru": "ru",
  "tg": "tg",
  "uz": "uz",
  "fr": "fr",
  "bn": "bn",
  "ro": "ro",
  "en-af": "en-af",
  "en-ay": "en-ay",
  "es-col": "col-es",
  "es-mex": "mex-es"
}

/**
 * 获取同步映射文件的完整路径
 */
function getSyncLangMapPath() {
  return path.join(app.getPath('userData'), 'langMap-sync.json')
}

/**
 * 初始化同步映射文件，不存在则创建默认映射
 */
function initSyncLangMapFile() {
  const filePath = getSyncLangMapPath()
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_SYNC_LANG_MAP, null, 2), 'utf8')
      console.log('✅ 已创建默认同步语言映射文件:', filePath)
    } catch (error) {
      console.error('❌ 创建同步语言映射文件失败:', error)
    }
  }
}

/**
 * 加载同步映射表
 * @returns {Object} H5→PC 语言编码映射
 */
function loadSyncLangMap() {
  const filePath = getSyncLangMapPath()
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      console.error('读取同步映射文件失败:', e)
      return DEFAULT_SYNC_LANG_MAP
    }
  }
  return DEFAULT_SYNC_LANG_MAP
}

/**
 * 读取 TS 文件并解析为对象
 * @param {string} filePath - TS 文件路径
 * @returns {Object|null} 解析后的对象
 */
function readTsFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '')
    cleanContent = cleanContent.replace(/\/\/.*$/gm, '')
    const match = cleanContent.match(/export\s+default\s+({[\s\S]*})\s*;?\s*$/)
    if (match && match[1]) {
      try {
        return new Function(`return ${match[1]}`)()
      } catch (e) {
        console.error(`TS 解析失败 ${filePath}:`, e.message)
        return null
      }
    }
    return null
  } catch (e) {
    console.error(`读取文件失败 ${filePath}:`, e.message)
    return null
  }
}

/**
 * 获取嵌套属性值
 * @param {Object} obj - 目标对象
 * @param {string} keyPath - 属性路径（如 "common.submit"）
 * @returns {*} 属性值，不存在返回 undefined
 */
function getNestedProperty(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

/**
 * 设置嵌套属性值，中间层级不存在则自动创建
 * @param {Object} obj - 目标对象
 * @param {string} keyPath - 属性路径
 * @param {*} value - 要设置的值
 */
function setNestedProperty(obj, keyPath, value) {
  const keys = keyPath.split('.')
  const lastKey = keys.pop()
  if (!lastKey) return

  let current = obj
  for (const key of keys) {
    if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[lastKey] = value
}

/**
 * 对象转 TS 格式字符串
 * @param {Object} obj - 目标对象
 * @param {number} indent - 缩进层级
 * @returns {string} TS 格式字符串
 */
function objectToTsString(obj, indent = 0) {
  const indentStr = '  '.repeat(indent)
  const nextIndentStr = '  '.repeat(indent + 1)

  if (typeof obj === 'string') {
    return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`
  }

  const entries = Object.entries(obj)
  const entriesStr = entries.map(([key, value]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`
    const valueStr = typeof value === 'string'
      ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`
      : objectToTsString(value, indent + 1)
    return `${nextIndentStr}${formattedKey}: ${valueStr}`
  }).join(',\n')

  return `{\n${entriesStr}\n${indentStr}}`
}

/**
 * 读取多语言文件（自动识别 JSON/TS 格式）
 * @param {string} filePath - 文件路径
 * @returns {Object|null} 解析后的对象
 */
function readLocaleFile(filePath) {
  if (filePath.endsWith('.ts')) {
    return readTsFile(filePath)
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`读取文件失败 ${filePath}:`, e.message)
    return null
  }
}

/**
 * 写入多语言文件（自动识别 JSON/TS 格式）
 * @param {string} filePath - 文件路径
 * @param {Object} data - 要写入的数据
 */
function writeLocaleFile(filePath, data) {
  if (filePath.endsWith('.ts')) {
    const formattedObject = objectToTsString(data)
    fs.writeFileSync(filePath, `export default ${formattedObject};\n`, 'utf8')
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  }
}

/**
 * 在目录中查找指定语言编码对应的文件
 * @param {string} dirPath - 目录路径
 * @param {string} langCode - 语言编码
 * @returns {string|null} 文件完整路径，未找到返回 null
 */
function findLangFile(dirPath, langCode) {
  if (!fs.existsSync(dirPath)) return null
  const files = fs.readdirSync(dirPath)
  // 优先匹配 .json（H5），其次 .ts（PC）
  const jsonMatch = files.find(f => f === `${langCode}.json`)
  if (jsonMatch) return path.join(dirPath, jsonMatch)
  const tsMatch = files.find(f => f === `${langCode}.ts`)
  if (tsMatch) return path.join(dirPath, tsMatch)
  return null
}

/**
 * 执行单条 Key 的跨端同步
 * 根据方向和映射表，将源端指定 key 的值写入目标端指定 key
 * 存在则覆盖，不存在则创建（含中间层级）
 *
 * @param {string} sourceDir - 源端文件夹路径
 * @param {string} targetDir - 目标端文件夹路径
 * @param {string} sourceKey - 源端 key 路径（如 "common.submit"）
 * @param {string} targetKey - 目标端 key 路径
 * @param {Array<string>} selectedLangs - 选中的语言列表（H5 编码）
 * @param {string} direction - 同步方向：'pc-to-h5' 或 'h5-to-pc'
 * @returns {Array<Object>} 每种语言的同步结果
 */
function syncLocaleKey(sourceDir, targetDir, sourceKey, targetKey, selectedLangs, direction) {
  const syncLangMap = loadSyncLangMap()
  const results = []

  for (const h5Lang of selectedLangs) {
    // 根据方向映射语言编码
    let sourceLangCode, targetLangCode
    if (direction === 'pc-to-h5') {
      // 源端是 PC，需要用 PC 编码找文件；目标端是 H5，用 H5 编码
      sourceLangCode = syncLangMap[h5Lang] || h5Lang
      targetLangCode = h5Lang
    } else {
      // 源端是 H5，用 H5 编码找文件；目标端是 PC，需要用 PC 编码
      sourceLangCode = h5Lang
      targetLangCode = syncLangMap[h5Lang] || h5Lang
    }

    // 查找源端文件
    const sourceFile = findLangFile(sourceDir, sourceLangCode)
    if (!sourceFile) {
      results.push({ lang: h5Lang, success: false, error: `源文件不存在: ${sourceLangCode}` })
      continue
    }

    // 查找目标端文件
    const targetFile = findLangFile(targetDir, targetLangCode)
    if (!targetFile) {
      results.push({ lang: h5Lang, success: false, error: `目标文件不存在: ${targetLangCode}` })
      continue
    }

    // 读取源端数据
    const sourceData = readLocaleFile(sourceFile)
    if (!sourceData) {
      results.push({ lang: h5Lang, success: false, error: `源文件读取失败: ${path.basename(sourceFile)}` })
      continue
    }

    // 获取源端 key 的值
    const sourceValue = getNestedProperty(sourceData, sourceKey)
    if (sourceValue === undefined) {
      results.push({ lang: h5Lang, success: false, error: `源 key 不存在: ${sourceKey}` })
      continue
    }

    // 读取目标端数据
    const targetData = readLocaleFile(targetFile)
    if (!targetData) {
      results.push({ lang: h5Lang, success: false, error: `目标文件读取失败: ${path.basename(targetFile)}` })
      continue
    }

    // 深拷贝值，避免引用问题
    const valueToSync = typeof sourceValue === 'object' && sourceValue !== null
      ? JSON.parse(JSON.stringify(sourceValue))
      : sourceValue

    // 在写入前检查目标端原来是否已存在该 key
    const isOverwrite = getNestedProperty(targetData, targetKey) !== undefined

    // 写入目标端（存在覆盖，不存在创建）
    setNestedProperty(targetData, targetKey, valueToSync)
    writeLocaleFile(targetFile, targetData)

    results.push({
      lang: h5Lang,
      success: true,
      sourceValue: typeof sourceValue === 'string' ? sourceValue : JSON.stringify(sourceValue),
      isOverwrite,
      sourceFile: path.basename(sourceFile),
      targetFile: path.basename(targetFile)
    })
  }

  return results
}

module.exports = {
  initSyncLangMapFile,
  loadSyncLangMap,
  getSyncLangMapPath,
  syncLocaleKey,
  DEFAULT_SYNC_LANG_MAP
}
