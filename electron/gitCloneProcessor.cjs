const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

/**
 * 自动模式配置文件名
 */
const AUTO_MODE_CONFIG_FILE = 'auto-mode-config.json'

/**
 * 各端多语言文件在项目中的固定相对路径
 * clone 的是项目根目录，多语言文件在这些子目录下
 */
const LOCALE_SUB_PATHS = {
  h5: path.join('src', 'locale'),
  pc: path.join('src', 'languages', 'locales'),
  admin: path.join('src', 'languages', 'locales')
}

/**
 * 默认自动模式配置
 */
const DEFAULT_AUTO_MODE_CONFIG = {
  h5: {
    repoUrl: '',
    branch: 'test',
    localPath: ''
  },
  pc: {
    repoUrl: '',
    branch: 'test',
    localPath: ''
  },
  admin: {
    repoUrl: '',
    branch: 'test',
    localPath: ''
  },
  localBasePath: ''
}

/**
 * 获取自动模式配置文件路径
 */
function getAutoModeConfigPath() {
  return path.join(app.getPath('userData'), AUTO_MODE_CONFIG_FILE)
}

/**
 * 初始化自动模式配置文件
 */
function initAutoModeConfig() {
  const filePath = getAutoModeConfigPath()
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_AUTO_MODE_CONFIG, null, 2), 'utf8')
      console.log('✅ 已创建默认自动模式配置文件:', filePath)
    } catch (error) {
      console.error('❌ 创建自动模式配置文件失败:', error)
    }
  }
}

/**
 * 读取自动模式配置
 */
function loadAutoModeConfig() {
  const filePath = getAutoModeConfigPath()
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      console.error('读取自动模式配置失败:', e)
      return DEFAULT_AUTO_MODE_CONFIG
    }
  }
  return DEFAULT_AUTO_MODE_CONFIG
}

/**
 * 保存自动模式配置
 */
function saveAutoModeConfig(config) {
  const filePath = getAutoModeConfigPath()
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8')
}

/**
 * 从仓库 URL 中提取项目目录名
 * 例如: git@gitlab.xxx.com:group/project.git → project
 *      https://gitlab.xxx.com/group/project.git → project
 */
function extractRepoName(repoUrl) {
  const basename = path.basename(repoUrl, '.git')
  return basename
}

/**
 * 执行 git 命令，通过回调实时输出日志
 * @param {string[]} args - git 命令参数
 * @param {string} cwd - 工作目录
 * @param {function} onLog - 日志回调 (type: 'stdout'|'stderr', data: string)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function execGit(args, cwd, onLog) {
  return new Promise((resolve) => {
    const gitPath = process.platform === 'win32' ? 'git.exe' : 'git'
    const proc = spawn(gitPath, args, { cwd })

    proc.stdout.on('data', (data) => {
      const text = data.toString().trim()
      if (text) onLog('stdout', text)
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim()
      if (text) onLog('stderr', text)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: `git ${args.join(' ')} 退出码: ${code}` })
      }
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: `执行 git 命令失败: ${err.message}` })
    })
  })
}

/**
 * 自动拉取项目代码并切换到指定分支
 *
 * 流程:
 * 1. 首次: git clone → git checkout <branch>
 * 2. 非首次: git fetch --all → git checkout <branch> → git pull origin <branch>
 *
 * @param {string} projectType - 项目类型 'h5' | 'pc' | 'admin'
 * @param {function} onLog - 日志回调
 * @param {function} onProgress - 进度回调 (step: string, percent: number)
 * @returns {Promise<{success: boolean, localPath?: string, error?: string}>}
 */
async function autoCloneProject(projectType, onLog, onProgress) {
  const config = loadAutoModeConfig()
  const projectConfig = config[projectType]

  if (!projectConfig || !projectConfig.repoUrl) {
    return { success: false, error: `未配置 ${projectType} 的远程仓库地址` }
  }

  const repoUrl = projectConfig.repoUrl
  const branch = projectConfig.branch || 'test'
  const localBasePath = config.localBasePath

  if (!localBasePath) {
    return { success: false, error: '未配置本地基础路径，请先在环境配置中设置' }
  }

  // 确保基础路径存在
  if (!fs.existsSync(localBasePath)) {
    try {
      fs.mkdirSync(localBasePath, { recursive: true })
      onLog('stdout', `📁 已创建基础路径: ${localBasePath}`)
    } catch (err) {
      return { success: false, error: `创建基础路径失败: ${err.message}` }
    }
  }

  const repoName = extractRepoName(repoUrl)
  const localRepoPath = path.join(localBasePath, repoName)
  const gitDir = path.join(localRepoPath, '.git')
  const isFirstTime = !fs.existsSync(gitDir)

  if (isFirstTime) {
    // ===== 首次：clone =====
    onLog('stdout', `🚀 首次拉取，正在 clone ${repoUrl} ...`)
    onProgress('clone', 10)

    const cloneResult = await execGit(
      ['clone', repoUrl, localRepoPath],
      localBasePath,
      onLog
    )

    if (!cloneResult.success) {
      return { success: false, error: `clone 失败: ${cloneResult.error}` }
    }

    onProgress('checkout', 60)
    onLog('stdout', `📦 clone 完成，正在切换到分支 ${branch} ...`)

    const checkoutResult = await execGit(
      ['checkout', branch],
      localRepoPath,
      onLog
    )

    if (!checkoutResult.success) {
      onLog('stderr', `⚠️ 切换到 ${branch} 失败，可能分支不存在，尝试 fetch 远程分支...`)

      // 尝试 fetch 后 checkout 远程分支
      const fetchResult = await execGit(
        ['fetch', 'origin', `${branch}:${branch}`],
        localRepoPath,
        onLog
      )

      if (fetchResult.success) {
        const retryCheckout = await execGit(
          ['checkout', branch],
          localRepoPath,
          onLog
        )
        if (!retryCheckout.success) {
          return { success: false, error: `切换到分支 ${branch} 失败: ${retryCheckout.error}` }
        }
      } else {
        return { success: false, error: `切换到分支 ${branch} 失败: ${checkoutResult.error}` }
      }
    }

    onProgress('done', 100)

    // 拼接多语言文件子路径
    const localePath = path.join(localRepoPath, LOCALE_SUB_PATHS[projectType])
    onLog('stdout', `📂 多语言文件路径: ${localePath}`)

    if (!fs.existsSync(localePath)) {
      onLog('stderr', `⚠️ 多语言目录不存在: ${localePath}，请确认项目结构`)
    }

    // 持久化 localPath（存多语言子路径，而非项目根目录）
    projectConfig.localPath = localePath
    saveAutoModeConfig(config)

    return { success: true, localPath: localePath }
  } else {
    // ===== 非首次：fetch + checkout + pull =====
    onLog('stdout', `🔄 已有本地仓库，正在更新 ${repoName} ...`)
    onProgress('fetch', 10)

    const fetchResult = await execGit(
      ['fetch', '--all'],
      localRepoPath,
      onLog
    )

    if (!fetchResult.success) {
      return { success: false, error: `fetch 失败: ${fetchResult.error}` }
    }

    onProgress('checkout', 40)
    onLog('stdout', `📦 正在切换到分支 ${branch} ...`)

    const checkoutResult = await execGit(
      ['checkout', branch],
      localRepoPath,
      onLog
    )

    if (!checkoutResult.success) {
      // 尝试 fetch 远程分支
      onLog('stderr', `⚠️ 本地无 ${branch} 分支，尝试从远程拉取...`)
      const fetchBranchResult = await execGit(
        ['fetch', 'origin', `${branch}:${branch}`],
        localRepoPath,
        onLog
      )

      if (fetchBranchResult.success) {
        const retryCheckout = await execGit(
          ['checkout', branch],
          localRepoPath,
          onLog
        )
        if (!retryCheckout.success) {
          return { success: false, error: `切换到分支 ${branch} 失败: ${retryCheckout.error}` }
        }
      } else {
        return { success: false, error: `切换到分支 ${branch} 失败: ${checkoutResult.error}` }
      }
    }

    onProgress('pull', 70)
    onLog('stdout', `⬇️ 正在拉取最新代码 origin/${branch} ...`)

    const pullResult = await execGit(
      ['pull', 'origin', branch],
      localRepoPath,
      onLog
    )

    if (!pullResult.success) {
      onLog('stderr', `⚠️ pull 失败: ${pullResult.error}，继续使用本地代码`)
      // pull 失败不阻断，可能只是冲突，本地代码仍然可用
    }

    onProgress('done', 100)

    // 拼接多语言文件子路径
    const localePath = path.join(localRepoPath, LOCALE_SUB_PATHS[projectType])
    onLog('stdout', `📂 多语言文件路径: ${localePath}`)

    if (!fs.existsSync(localePath)) {
      onLog('stderr', `⚠️ 多语言目录不存在: ${localePath}，请确认项目结构`)
    }

    // 持久化 localPath（存多语言子路径，而非项目根目录）
    projectConfig.localPath = localePath
    saveAutoModeConfig(config)

    return { success: true, localPath: localePath }
  }
}

module.exports = {
  initAutoModeConfig,
  loadAutoModeConfig,
  saveAutoModeConfig,
  autoCloneProject,
  DEFAULT_AUTO_MODE_CONFIG
}
