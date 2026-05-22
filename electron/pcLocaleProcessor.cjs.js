const fs = require('fs')
const path = require('path')

/**
 * 将嵌套对象扁平化为单层键值对
 */
function flattenObject(obj, prefix = '') {
  const flattened = {}
  if (typeof obj !== 'object' || obj === null) return flattened

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
 * 读取 TS 文件并解析为对象
 */
function readTsFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const jsonString = fileContent.replace('export default', '').trim()
    const langData = new Function(`return ${jsonString}`)()
    return langData
  } catch (error) {
    console.error(`读取文件 ${filePath} 出错:`, error)
    return null
  }
}

/**
 * 处理 PC 端多语言文件，生成合并数组
 */
function processPcLocales(localeConfigs, standardCode = 'zh') {
  const jsonData = {}

  for (const config of localeConfigs) {
    const data = readTsFile(config.filePath)
    if (data) {
      jsonData[config.code] = data
    }
  }

  if (!jsonData[standardCode]) {
    throw new Error(`缺少基准文件（${standardCode}），无法生成合并结果`)
  }

  const flattenedStandard = flattenObject(jsonData[standardCode])
  const standardKeys = Object.keys(flattenedStandard).sort()

  const result = []
  for (const key of standardKeys) {
    const item = {
      key: key,
      [standardCode]: flattenedStandard[key]
    }

    for (const config of localeConfigs) {
      if (config.code === standardCode) continue

      const languageData = jsonData[config.code]
      if (!languageData) {
        item[config.code] = ''
        continue
      }

      const flattenedLanguage = flattenObject(languageData)
      const translatedValue = flattenedLanguage[key]

      if (translatedValue !== undefined) {
        item[config.code] = translatedValue === flattenedStandard[key] ? '' : translatedValue
      } else {
        item[config.code] = ''
      }
    }
    result.push(item)
  }

  return result
}

module.exports = {
  processPcLocales
}
