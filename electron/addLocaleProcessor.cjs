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
 * Admin 端默认的语言映射配置
 */
const DEFAULT_LANG_MAP_ADMIN = {
  "en": "en",
  "es": "es",
  "fr": "fr",
  "kk": "kk",
  "mn": "mn",
  "ru": "ru",
  "zh": "zh"
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
      } else if (type === 'admin') {
        fs.writeFileSync(filePath, JSON.stringify(DEFAULT_LANG_MAP_ADMIN, null, 2), 'utf8')
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
 * 读取并解析 TS 文件（优化版）
 */
function readTsFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    // 清理注释，防止干扰解析
    let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '')
    cleanContent = cleanContent.replace(/\/\/.*$/gm, '')
    
    // 提取 export default 后面的对象
    const match = cleanContent.match(/export\s+default\s+({[\s\S]*})\s*;?\s*$/)
    if (match && match[1]) {
      try {
        return new Function(`return ${match[1]}`)()
      } catch (e) {
        console.error(` TS 解析失败 ${filePath}:`, e.message)
        return {}
      }
    }
    return {}
  } catch (e) {
    console.error(`🚫 读取文件失败 ${filePath}:`, e.message)
    return {}
  }
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
    // 增强转义：处理 \n, \r, \\, "
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

/**
 * 批量添加多语言词条到 Admin 端 TS 文件（嵌套结构）
 */
function batchAddLocalesAdmin(localesPath, targetProperty, objectsToAddStr, type = 'admin') {
  const langMapPath = path.join(app.getPath('userData'), `langMap-${type}.json`)
  let languages = {}
  if (fs.existsSync(langMapPath)) {
    languages = JSON.parse(fs.readFileSync(langMapPath, 'utf8'))
  } else {
    languages = DEFAULT_LANG_MAP_ADMIN
  }

  const objectsToAdd = JSON.parse(objectsToAddStr)
  const langFolders = fs.readdirSync(localesPath).filter(item => {
    const itemPath = path.join(localesPath, item)
    return fs.statSync(itemPath).isDirectory()
  })

  let processedCount = 0
  for (const langFolder of langFolders) {
    const langCode = langFolder
    const langPath = path.join(localesPath, langFolder)

    // 1. 确定目标操作目录
    let targetDir = langPath
    
    // 如果 targetProperty 不为空且去除空格后仍有内容，才视为子目录路径
    if (targetProperty && targetProperty.trim() !== '') {
      const folders = targetProperty.split('.')
      for (const folder of folders) {
        targetDir = path.join(targetDir, folder)
        if (!fs.existsSync(targetDir)) {
          console.warn(`⚠️ 路径不存在: ${targetDir}，跳过语言 ${langFolder}`)
          targetDir = null
          break
        }
      }
    }

    // 2. 在该目录下查找 .ts 文件
    if (targetDir && fs.existsSync(targetDir)) {
      const tsFiles = fs.readdirSync(targetDir).filter(f => f.endsWith('.ts'))

      for (const tsFile of tsFiles) {
        const tsFilePath = path.join(targetDir, tsFile)
        const tsData = readTsFile(tsFilePath)
        const fileName = path.basename(tsFile, '.ts')

        // 3. 遍历用户配置，匹配文件名
        for (const [keyPath, translations] of Object.entries(objectsToAdd)) {
          const keys = keyPath.split('.')
          const fileKey = keys[0] // 配置的第一个词作为文件名

          if (fileKey !== fileName) continue

          // 获取属性路径（去掉文件名）
          const propertyPath = keys.slice(1)
          if (propertyPath.length === 0) continue

          const fullPropertyKey = propertyPath.join('.')
          const translation = translations[langCode] || translations['zh'] || ''

          // 4. 修改属性值
          if (tsData[fullPropertyKey] !== undefined) {
            tsData[fullPropertyKey] = translation
          } else {
            let currentObj = tsData
            for (let i = 0; i < propertyPath.length - 1; i++) {
              const k = propertyPath[i]
              if (!currentObj[k]) currentObj[k] = {}
              currentObj = currentObj[k]
            }
            const lastKey = propertyPath[propertyPath.length - 1]
            currentObj[lastKey] = translation
          }
        }

        // 5. 写回文件
        const formattedObject = objectToTsString(tsData)
        const updatedData = `export default ${formattedObject};\n`
        fs.writeFileSync(tsFilePath, updatedData, 'utf8')
        processedCount++
      }
    }
  }

  return { success: true, message: `已成功处理 ${processedCount} 个文件` }
}

/**
 * 批量合并 Excel 数据到 Admin 端 TS 文件夹
 */
function mergeAdminLocales(localesPath, tempData) {
  if (!fs.existsSync(localesPath)) {
    throw new Error(`目标文件夹不存在: ${localesPath}`)
  }

  // 智能识别：如果目录下全是文件夹，则遍历；否则直接处理当前目录
  const items = fs.readdirSync(localesPath)
  const isRootLocales = items.length > 0 && items.every(item => {
    const itemPath = path.join(localesPath, item)
    return fs.statSync(itemPath).isDirectory()
  })

  const foldersToProcess = isRootLocales 
    ? items.map(item => ({ name: item, path: path.join(localesPath, item) }))
    : [{ name: path.basename(localesPath), path: localesPath }]

  for (const folder of foldersToProcess) {
    const currentLangPath = folder.path
    
    for (const [fullKey, value] of Object.entries(tempData)) {
      const keys = fullKey.split('.')
      let targetDir = currentLangPath
      let targetFile = ''
      let propertyPath = []
      let found = false

      // 逐层解析路径：先判文件，再进文件夹
      for (let i = 0; i < keys.length; i++) {
        const part = keys[i]
        const tsPath = path.join(targetDir, `${part}.ts`)
        const dirPath = path.join(targetDir, part)

        if (fs.existsSync(tsPath)) {
          targetFile = part
          propertyPath = keys.slice(i + 1)
          found = true
          break 
        } else if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          targetDir = dirPath
        } else {
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
        
        currentObj[propertyPath[propertyPath.length - 1]] = value

        const formattedObject = objectToTsString(targetData)
        fs.writeFileSync(tsFilePath, `export default ${formattedObject};\n`, 'utf-8')
      }
    }
  }
}

module.exports = {
  initLangMapFile,
  batchAddLocales,
  batchAddLocalesPc,
  batchAddLocalesAdmin,
  mergeAdminLocales
}