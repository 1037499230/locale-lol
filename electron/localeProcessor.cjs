const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

/**
 * 语言代码与显示名称的映射表
 * 用于 Excel 导出时将语言代码转换为可读的标题
 */
const TitleKeysBD = {
  'key': 'key',
  'zh': '中文简体',
  'en': '英语',
  'bg': '保加利亚语',
  'de': '德语',
  'el': '希腊语',
  'es': '西班牙语',
  'he': '希伯来语',
  'hu': '匈牙利语',
  'it': '意大利语',
  'ka': '格鲁吉亚语',
  'kk': '哈萨克语',
  'ky': '吉尔吉斯语',
  'lt': '立陶宛语',
  'mn': '蒙古语',
  'pl': '波兰语',
  'ru': '俄语',
  'sk': '斯洛伐克语',
  'tg': '塔吉克语',
  'tr': '土耳其语',
  'uk': '乌克兰语',
  'uz': '乌兹别克语',
  'es-col': '西班牙语-哥伦比亚',
  'es-mex': '西班牙语-墨西哥',
  'fr': '法语',
  'en-af': '非洲-英语',
  'bn': '孟加拉语',
  'ro': '罗马尼亚语',
  'en-ay': '东南亚-英语',
}

/**
 * 将嵌套对象扁平化为一维键值对
 * 例如：{a: {b: 'c'}} 转换为 {'a.b': 'c'}
 * @param {Object} obj - 需要扁平化的对象
 * @param {string} prefix - 前缀键名，用于递归拼接
 * @returns {Object} 扁平化后的对象
 */
function flattenObject(obj, prefix = '') {
  const flattened = {}

  if (typeof obj !== 'object' || obj === null) {
    return flattened
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix === '' ? key : `${prefix}.${key}`
      const value = obj[key]

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedFlattened = flattenObject(value, newKey)
        for (const nestedKey in nestedFlattened) {
          if (Object.prototype.hasOwnProperty.call(nestedFlattened, nestedKey)) {
            flattened[nestedKey] = nestedFlattened[nestedKey]
          }
        }
      } else {
        flattened[newKey] = value
      }
    }
  }

  return flattened
}

/**
 * 合并标准文件和 uni-app 文件的扁平化数据
 * 以标准文件的键为基准，追加 uni-app 文件独有的键
 * @param {Object} standardFlattened - 标准文件的扁平化数据
 * @param {Object} uniAppFlattened - uni-app 文件的扁平化数据
 * @returns {Object} 包含合并结果和分类键数组的对象
 * @returns {Object} merged - 合并后的数据对象
 * @returns {Array<string>} standardKeysSorted - 标准文件的键列表（按顺序）
 * @returns {Array<string>} uniqueKeys - uni-app 文件独有的键列表
 */
function mergeFlattenedObjects(standardFlattened, uniAppFlattened) {
  const merged = {}
  const standardKeys = []
  const uniqueKeys = []

  for (const key in standardFlattened) {
    if (Object.prototype.hasOwnProperty.call(standardFlattened, key)) {
      standardKeys.push(key)
      merged[key] = standardFlattened[key]
    }
  }

  for (const key in uniAppFlattened) {
    if (Object.prototype.hasOwnProperty.call(uniAppFlattened, key)) {
      if (!(key in standardFlattened)) {
        uniqueKeys.push(key)
        merged[key] = uniAppFlattened[key]
      } else {
        merged[key] = uniAppFlattened[key]
      }
    }
  }

  return { merged, standardKeysSorted: standardKeys, uniqueKeys }
}

/**
 * 读取 JSON 文件并解析为对象
 * @param {string} filePath - 文件路径
 * @returns {Object|null} 解析后的对象，失败返回 null
 */
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`文件不存在: ${filePath}`)
      return null
    }
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`读取文件 ${filePath} 出错:`, error)
    return null
  }
}

/**
 * 将多语言数据转换为 Excel 文件
 * 按照 TitleKeys 定义的顺序排列列，生成格式化的工作表
 * @param {Array<Object>} data - 多语言数据数组，每个元素代表一行
 * @param {string} outputPath - Excel 文件的输出路径
 * @returns {Array<Object>} 原始输入数据
 */
function convertToExcel(data, outputPath) {
  const TitleKeys = JSON.parse(localStorage.getItem('tableData') || 'null') || TitleKeysBD
  const orderedKeys = Object.keys(TitleKeys)
  const dataKeys = Object.keys(data[0])
  const currentOrderedKeys = dataKeys.filter(key => orderedKeys.includes(key))

  const worksheetData = [
    currentOrderedKeys.map(key => TitleKeys[key] || key),
    ...data.map(item => currentOrderedKeys.map(key => item[key] || ''))
  ]
  console.log(`正在生成 ${outputPath}...`, dataKeys)

  const ws = XLSX.utils.aoa_to_sheet(worksheetData)

  ws['!cols'] = orderedKeys.map(() => ({wch: 30}))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Locales')

  XLSX.writeFile(wb, outputPath)
  return data
}

/**
 * 处理多语言配置文件，合并标准和 uni-app 文件的数据
 * 以中文基准文件的键为标准，生成所有语言的对照表格数据
 *
 * 处理流程：
 * 1. 遍历所有语言配置，读取并扁平化标准文件和 uni-app 文件
 * 2. 合并两种文件的数据，保留标准文件的键和 uni-app 独有的键
 * 3. 以中文基准文件的合并键为准，提取其他语言的对应翻译
 * 4. 如果翻译值与中文相同或不存在，则留空
 *
 * @param {string} data - JSON 字符串，包含语言配置数组，每个配置包含 code、standardFilePath、uniAppFilePath
 * @param {string} standardFile - 基准文件的语言代码（通常是 'zh'）
 * @returns {Array<Object>} 处理后的多语言数据数组，每个元素包含 key 和各语言的翻译值
 * @throws {Error} 当缺少中文基准文件时抛出错误
 */
function processLocales(data, standardFile) {
  const configs = JSON.parse(data) || []

  const mergedLanguageData = {}

  for (const config of configs) {
    const standardData = readJsonFile(config.standardFilePath)
    const uniAppData = config.uniAppFilePath ? readJsonFile(config.uniAppFilePath) : null

    if (!standardData && !uniAppData) {
      console.warn(`⚠️ ${config.code}: 两个文件都不存在，跳过`)
      continue
    }

    const standardFlattened = standardData ? flattenObject(standardData) : {}
    const uniAppFlattened = uniAppData ? flattenObject(uniAppData) : {}

    const { merged } = mergeFlattenedObjects(standardFlattened, uniAppFlattened)
    mergedLanguageData[config.code] = merged

    const standardCount = Object.keys(standardFlattened).length
    const uniqueCount = Object.keys(merged).length - standardCount

    if (standardData && uniAppData) {
      console.log(`✅ ${config.code}: 已合并，基准 ${standardCount} 个 key，uni-app 追加 ${uniqueCount} 个独有 key`)
    } else if (standardData) {
      console.log(`📄 ${config.code}: 仅标准文件 ${standardCount} 个 key`)
    } else {
      console.log(`📄 ${config.code}: 仅 uni-app 文件 ${Object.keys(uniAppFlattened).length} 个 key`)
    }
  }

  if (!mergedLanguageData[standardFile]) {
    throw new Error(`缺少中文基准文件（${standardFile}），无法生成合并结果`)
  }

  const zhStandardPath = configs.find(config => config.code === standardFile).standardFilePath
  const zhUniAppPath = configs.find(config => config.code === standardFile).uniAppFilePath
  console.log(`正在处理中文文件 ${zhStandardPath} 和 ${zhUniAppPath}...`)

  const zhStandard = readJsonFile(zhStandardPath)
  const zhUniApp = readJsonFile(zhUniAppPath)

  const {
    merged: zhMerged,
    standardKeysSorted,
    uniqueKeys,
  } = mergeFlattenedObjects(flattenObject(zhStandard), flattenObject(zhUniApp))

  const zhKeys = [...standardKeysSorted].sort().concat(uniqueKeys)

  console.log(`${standardFile}合并后共 ${zhKeys.length} 个 key，准备生成合并结果...`)

  const result = []

  for (const key of zhKeys) {
    const item = {
      key,
      [standardFile]: zhMerged[key],
    }

    for (const config of configs) {
      if (config.code === standardFile) {
        continue
      }

      const languageData = mergedLanguageData[config.code]
      if (!languageData) {
        item[config.code] = ''
        continue
      }

      const translatedValue = languageData[key]

      if (translatedValue !== undefined) {
        if (translatedValue === zhMerged[key]) {
          item[config.code] = ''
        } else {
          item[config.code] = translatedValue
        }
      } else {
        item[config.code] = ''
      }
    }

    result.push(item)
  }

  return result
}

module.exports = { processLocales, convertToExcel }
