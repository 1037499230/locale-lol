const fs = require('fs')
const path = require('path')
const { app } = require('electron')

/**
 * 默认的语言映射配置
 */
const DEFAULT_LANG_MAP = {
  "zh-Hans": "zh-Hans",
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
  "es-col": "es-col",
  "es-mex": "es-mex"
}

/**
 * 默认的语言映射配置
 */
const DEFAULT_LANG_MAP_PC = {
  "zh": "zh",
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
  "col-es": "col-es",
  "mex-es": "mex-es"
}

/**
 * 获取语言映射文件的完整路径
 */
function getLangMapPath(type = 'h5') {
  return path.join(app.getPath('userData'), `langMap-${type}.json`)
}

/**
 * 初始化语言映射文件
 */
function initLangMapFile(type = 'h5') {
  const filePath = getLangMapPath(type)
  if (!fs.existsSync(filePath)) {
    try {
      if (type === 'pc') {
        fs.writeFileSync(filePath, JSON.stringify(DEFAULT_LANG_MAP_PC, null, 2), 'utf8')
      } else {
        fs.writeFileSync(filePath, JSON.stringify(DEFAULT_LANG_MAP, null, 2), 'utf8')
      }
      console.log(`✅ 已创建默认语言映射文件: ${filePath}`)
    } catch (error) {
      console.error('❌ 创建语言映射文件失败:', error)
    }
  }
}

/**
 * 批量添加多语言词条到指定文件夹下的 JSON 文件
 */
function batchAddLocales(dirPath, excludePattern, targetProperty, objectsToAddStr, type = 'h5') {
  // 读取语言映射
  const langMapPath = getLangMapPath(type)
  let languages = {}
  if (fs.existsSync(langMapPath)) {
    languages = JSON.parse(fs.readFileSync(langMapPath, 'utf8'))
  } else {
    languages = DEFAULT_LANG_MAP
  }

  const objectsToAdd = JSON.parse(objectsToAddStr)
  const excludeRegex = new RegExp(excludePattern)

  const files = fs.readdirSync(dirPath)
  const jsonFiles = files.filter(file => {
    return path.extname(file).toLowerCase() === '.json' && !excludeRegex.test(file)
  })

  let processedCount = 0
  for (const file of jsonFiles) {
    const filePath = path.join(dirPath, file)
    const baseName = path.basename(file, '.json')

    // 识别文件对应的语言代码
    let fileLanguage = ''
    for (const [key, value] of Object.entries(languages)) {
      if (value === baseName || key === baseName) {
        fileLanguage = value
        break
      }
    }

    if (!fileLanguage) continue

    const content = fs.readFileSync(filePath, 'utf8')
    const jsonData = JSON.parse(content)

    // 动态处理嵌套属性路径
    const properties = targetProperty.split('.')
    let currentObj = jsonData
    for (let i = 0; i < properties.length - 1; i++) {
      const prop = properties[i]
      if (!currentObj[prop]) currentObj[prop] = {}
      currentObj = currentObj[prop]
    }

    const finalProperty = properties[properties.length - 1]
    if (!currentObj[finalProperty]) {
      currentObj[finalProperty] = {}
    }

    // 遍历要添加的对象，根据当前文件语言提取对应的翻译
    for (const [key, translations] of Object.entries(objectsToAdd)) {
      if (typeof translations === 'object' && translations !== null) {
        const translation = translations[fileLanguage] || translations['zh-Hans'] || ''
        currentObj[finalProperty][key] = translation
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8')
    processedCount++
  }

  return { success: true, message: `已成功处理 ${processedCount} 个文件` }
}

/**
 * 读取并解析 TS 文件
 */
function readTsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const jsonContent = content.replace('export default', '').trim().replace(/;$/, '')
  return new Function(`return ${jsonContent}`)()
}

/**
 * 判断是否为对象类型
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * 深度合并对象
 */
function deepMergeTs(target, source) {
  const output = { ...target }
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          Object.assign(output, { [key]: deepMergeTs(target[key], source[key]) })
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }
  return output
}

/**
 * 获取嵌套属性
 */
function getNestedProperty(obj, path) {
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

/**
 * 设置嵌套属性
 */
function setNestedProperty(obj, path, value) {
  const keys = path.split('.')
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
 */
function objectToTsString(obj, indent = 0) {
  const indentStr = '  '.repeat(indent)
  const nextIndentStr = '  '.repeat(indent + 1)

  if (typeof obj === 'string') {
    return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
  }

  const entries = Object.entries(obj)
  const entriesStr = entries.map(([key, value]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`
    const valueStr = typeof value === 'string' ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` : objectToTsString(value, indent + 1)
    return `${nextIndentStr}${formattedKey}: ${valueStr}`
  }).join(',\n')

  return `{\n${entriesStr}\n${indentStr}}`
}

/**
 * 批量添加多语言词条到 PC 端 TS 文件
 */
function batchAddLocalesPc(dirPath, excludePattern, targetProperty, objectsToAddStr, type = 'pc') {
  const langMapPath = path.join(app.getPath('userData'), `langMap-${type}.json`)
  let languages = {}
  if (fs.existsSync(langMapPath)) {
    languages = JSON.parse(fs.readFileSync(langMapPath, 'utf8'))
  } else {
    languages = DEFAULT_LANG_MAP_PC
  }

  const objectsToAdd = JSON.parse(objectsToAddStr)
  const excludeRegex = new RegExp(excludePattern)

  const files = fs.readdirSync(dirPath)
  const tsFiles = files.filter(file => {
    return path.extname(file).toLowerCase() === '.ts' && !excludeRegex.test(file)
  })

  let processedCount = 0
  for (const file of tsFiles) {
    const filePath = path.join(dirPath, file)
    const baseName = path.basename(file, '.ts')

    // 识别语言
    let fileLanguage = ''
    for (const [key, value] of Object.entries(languages)) {
      if (value === baseName || key === baseName) {
        fileLanguage = value
        break
      }
    }

    if (!fileLanguage) continue

    const jsonData = readTsFile(filePath)

    // 创建对应语言的词条
    const localizedObjectToAdd = {}
    Object.keys(objectsToAdd).forEach(key => {
      const translations = objectsToAdd[key]
      if (typeof translations === 'object' && translations !== null && !Array.isArray(translations)) {
        localizedObjectToAdd[key] = translations[fileLanguage] || translations['zh'] || ''
      } else {
        localizedObjectToAdd[key] = translations
      }
    })

    // 合并到指定路径
    const target = getNestedProperty(jsonData, targetProperty)
    if (!target) {
      setNestedProperty(jsonData, targetProperty, localizedObjectToAdd)
    } else if (typeof target === 'object' && !Array.isArray(target)) {
      const merged = deepMergeTs(target, localizedObjectToAdd)
      setNestedProperty(jsonData, targetProperty, merged)
    } else {
      setNestedProperty(jsonData, targetProperty, localizedObjectToAdd)
    }

    // 写回 TS 文件
    const formattedObject = objectToTsString(jsonData)
    const updatedData = `export default ${formattedObject};\n`
    fs.writeFileSync(filePath, updatedData, 'utf8')
    processedCount++
  }

  return { success: true, message: `已成功处理 ${processedCount} 个文件` }
}

module.exports = {
  initLangMapFile,
  batchAddLocales,
  batchAddLocalesPc
}