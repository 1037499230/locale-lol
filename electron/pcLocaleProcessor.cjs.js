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
        flattened[newKey] = typeof value === 'string' ? value : JSON.stringify(value)
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
 * 判断是否包含中文字符
 */
function hasChineseChar(str) {
  return /[\u4e00-\u9fa5]/.test(str)
}

/**
 * 处理 PC 端多语言文件，生成合并数组
 */
function processPcLocales(data, standardCode = 'zh') {
  const configs = JSON.parse(data) || []
  const mergedLanguageData = {}

  for (const config of configs) {
    const tsData = readTsFile(config.standardFilePath)
    if (tsData) {
      mergedLanguageData[config.code] = flattenObject(tsData)
    }
  }

  if (!mergedLanguageData[standardCode]) {
    throw new Error(`缺少基准文件（${standardCode}），无法生成合并结果`)
  }

  const standardKeys = Object.keys(mergedLanguageData[standardCode]).sort()
  const result = []

  for (const key of standardKeys) {
    const item = {
      key,
      [standardCode]: mergedLanguageData[standardCode][key]
    }

    for (const config of configs) {
      if (config.code === standardCode) continue

      const languageData = mergedLanguageData[config.code]
      if (!languageData) {
        item[config.code] = ''
        continue
      }

      const translatedValue = languageData[key]
      if (translatedValue !== undefined) {
        item[config.code] = translatedValue === mergedLanguageData[standardCode][key] ? '' : translatedValue
      } else {
        item[config.code] = ''
      }
    }
    result.push(item)
  }

  return result
}

/**
 * 找出目标文件中缺失的属性或值为中文的属性
 */
function findMissingKeys(zhData, targetData, secondRefData) {
  const zhFlat = flattenObject(zhData)
  const targetFlat = flattenObject(targetData)
  const secondRefFlat = secondRefData ? flattenObject(secondRefData) : {}
  const missing = []

  for (const key in zhFlat) {
    if (Object.prototype.hasOwnProperty.call(zhFlat, key)) {
      const targetValue = targetFlat[key] || ''

      if (!targetValue || hasChineseChar(targetValue)) {
        let secondRefValue = secondRefFlat[key] || ''
        if (secondRefValue && hasChineseChar(secondRefValue)) {
          secondRefValue = ''
        }

        missing.push({
          key,
          zhValue: zhFlat[key],
          secondRefValue,
          targetValue: targetValue || ''
        })
      }
    }
  }

  missing.sort((a, b) => a.key.localeCompare(b.key))
  return missing
}

/**
 * 处理 PC 端多语言缺失项对比
 */
function processPcMissingLocales(data, zhCode, secondRefCode) {
  const configs = JSON.parse(data) || []
  const results = []

  const zhConfig = configs.find(c => c.code === zhCode)
  if (!zhConfig) {
    throw new Error(`未找到语言代码为 ${zhCode} 的配置`)
  }

  const zhData = readTsFile(zhConfig.standardFilePath)
  if (!zhData) {
    throw new Error(`无法读取基准文件 ${zhCode}`)
  }

  let secondRefData = undefined
  if (secondRefCode) {
    const secondRefConfig = configs.find(c => c.code === secondRefCode)
    if (secondRefConfig) {
      secondRefData = readTsFile(secondRefConfig.standardFilePath)
    }
  }

  for (const config of configs) {
    if (config.code === zhCode || config.code === secondRefCode) continue

    const targetData = readTsFile(config.standardFilePath)
    if (!targetData) {
      results.push({ lang: config.code, missing: [], count: 0 })
      continue
    }

    const missing = findMissingKeys(zhData, targetData, secondRefData)
    results.push({ lang: config.code, missing, count: missing.length })
  }

  return results
}

module.exports = {
  processPcLocales,
  processPcMissingLocales
}
