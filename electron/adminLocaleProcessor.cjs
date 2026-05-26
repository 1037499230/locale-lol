const fs = require('fs')
const path = require('path')

/**
 * 递归提取嵌套目录下的 TS 文件
 */
function extractTsFiles(dirPath, prefix = '') {
  const result = {}
  const items = fs.readdirSync(dirPath)

  items.forEach(item => {
    const itemPath = path.join(dirPath, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory()) {
      const newPrefix = prefix ? `${prefix}.${item}` : item
      const subResult = extractTsFiles(itemPath, newPrefix)
      Object.assign(result, subResult)
    } else if (item.endsWith('.ts')) {
      const fileName = path.basename(item, '.ts')
      const fullKey = prefix ? `${prefix}.${fileName}` : fileName
      result[fullKey] = processTsFile(itemPath)
    }
  })

  return result
}

/**
 * 处理单个 TS 文件
 */
function processTsFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    let cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '')
    cleanContent = cleanContent.replace(/\/\/.*$/gm, '')

    const exportDefaultMatch = cleanContent.match(/export\s+default\s+({[\s\S]*?})(?:\s*;)?\s*$/)

    if (exportDefaultMatch && exportDefaultMatch[1]) {
      const objStr = `return ${exportDefaultMatch[1]}`
      return new Function(objStr)()
    }
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error)
  }

  return {}
}

/**
 * 处理 Admin 多语言目录
 */
function processAdminLocales(localesPath) {
  const languages = []
  const items = fs.readdirSync(localesPath)

  items.forEach(item => {
    const itemPath = path.join(localesPath, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory()) {
      languages.push(item)
    }
  })

  return languages
}

/**
 * 提取并生成 JSON 文件
 */
function extractAndGenerateJson(localesPath) {
  const items = fs.readdirSync(localesPath)

  items.forEach(item => {
    const itemPath = path.join(localesPath, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory()) {
      const result = extractTsFiles(itemPath)
      const outputPath = path.join(localesPath, `${item}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8')
      console.log(`Generated ${outputPath}`)
    }
  })
}

module.exports = {
  processAdminLocales,
  extractAndGenerateJson
}