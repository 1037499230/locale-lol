const { execFileSync } = require('child_process')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')

try {
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
    cwd: repoRoot,
    stdio: 'inherit'
  })
  console.log('Git hooks configured: .githooks')
} catch (error) {
  console.warn('Unable to configure Git hooks automatically. Run: git config --local core.hooksPath .githooks')
}
