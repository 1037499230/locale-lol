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
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_LANG_MAP, null, 2), 'utf8')
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

module.exports = {
  initLangMapFile,
  batchAddLocales
}
