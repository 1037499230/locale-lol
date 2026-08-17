const fs = require('fs')
const path = require('path')

const packagePath = path.resolve(__dirname, '..', 'package.json')
const dryRun = process.argv.includes('--dry-run')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const match = String(packageJson.version || '').match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/)

if (!match) {
  throw new Error(`Cannot automatically bump an invalid semantic version: ${packageJson.version}`)
}

const nextVersion = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`

if (dryRun) {
  console.log(`Next version: ${nextVersion}`)
  process.exit(0)
}

packageJson.version = nextVersion
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
console.log(`Version automatically bumped: ${match[0]} -> ${nextVersion}`)
