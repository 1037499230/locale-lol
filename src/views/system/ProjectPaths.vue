<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

interface ProjectPaths {
  h5: string
  pc: string
  admin: string
}

interface AutoModeProjectConfig {
  repoUrl: string
  branch: string
  localPath: string
}

interface AutoModeConfig {
  h5: AutoModeProjectConfig
  pc: AutoModeProjectConfig
  admin: AutoModeProjectConfig
  localBasePath: string
}

const paths = ref<ProjectPaths>({ h5: '', pc: '', admin: '' })
const autoConfig = ref<AutoModeConfig>({
  h5: { repoUrl: '', branch: 'test', localPath: '' },
  pc: { repoUrl: '', branch: 'test', localPath: '' },
  admin: { repoUrl: '', branch: 'test', localPath: '' },
  localBasePath: ''
})
const isSaving = ref(false)
const activeTab = ref('manual')

/** 加载已保存的项目路径 */
const loadPaths = async () => {
  const res = await window.electronAPI?.getProjectPaths()
  if (res?.success && res.data) {
    paths.value = res.data
  }
}

/** 加载自动模式配置 */
const loadAutoConfig = async () => {
  const res = await window.electronAPI?.getAutoModeConfig()
  if (res?.success && res.data) {
    autoConfig.value = res.data
  }
}

/** 选择文件夹 */
const handleSelectFolder = async (key: keyof ProjectPaths) => {
  const p = await window.electronAPI?.selectFolder()
  if (p) {
    paths.value[key] = p
  }
}

/** 选择本地基础路径 */
const handleSelectBasePath = async () => {
  const p = await window.electronAPI?.selectFolder()
  if (p) {
    autoConfig.value.localBasePath = p
  }
}

/** 保存手动模式配置 */
const handleSave = async () => {
  isSaving.value = true
  try {
    const res = await window.electronAPI?.saveProjectPaths(JSON.stringify(paths.value, null, 2))
    if (res?.success) {
      ElMessage.success('手动模式路径已保存')
    } else {
      ElMessage.error(res?.error || '保存失败')
    }
  } catch (e: any) {
    ElMessage.error('保存异常: ' + e.message)
  } finally {
    isSaving.value = false
  }
}

/** 保存自动模式配置 */
const handleSaveAutoConfig = async () => {
  isSaving.value = true
  try {
    const res = await window.electronAPI?.saveAutoModeConfig(JSON.stringify(autoConfig.value, null, 2))
    if (res?.success) {
      ElMessage.success('自动模式配置已保存')
    } else {
      ElMessage.error(res?.error || '保存失败')
    }
  } catch (e: any) {
    ElMessage.error('保存异常: ' + e.message)
  } finally {
    isSaving.value = false
  }
}

/** 清空某一项 */
const handleClear = (key: keyof ProjectPaths) => {
  paths.value[key] = ''
}

/** 清空自动模式本地基础路径 */
const handleClearBasePath = () => {
  autoConfig.value.localBasePath = ''
}

onMounted(() => {
  loadPaths()
  loadAutoConfig()
})
</script>

<template>
  <div class="p-5 mt-3 max-w-4xl mx-auto">
    <h2 class="text-xl font-bold mb-2">环境配置</h2>
    <p class="text-sm text-gray-500 mb-6">配置各端多语言项目路径，保存后各功能页将自动填入</p>

    <el-tabs v-model="activeTab">
      <!-- 手动模式配置 -->
      <el-tab-pane label="手动模式" name="manual">
        <p class="text-sm text-gray-400 mb-4">手动选择本地项目文件夹路径，各功能页将自动填入</p>
        <el-form label-width="120px">
          <el-form-item label="H5 端路径">
            <el-input v-model="paths.h5" placeholder="H5 多语言文件所在目录（如 src/locale）">
              <template #append>
                <el-button @click="handleSelectFolder('h5')">选择</el-button>
                <el-divider direction="vertical" />
                <el-button @click="handleClear('h5')" :disabled="!paths.h5">清除</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="PC 端路径">
            <el-input v-model="paths.pc" placeholder="PC 多语言文件所在目录（如 src/locales）">
              <template #append>
                <el-button @click="handleSelectFolder('pc')">选择</el-button>
                <el-divider direction="vertical" />
                <el-button @click="handleClear('pc')" :disabled="!paths.pc">清除</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="Admin 端路径">
            <el-input v-model="paths.admin" placeholder="Admin 多语言文件所在目录">
              <template #append>
                <el-button @click="handleSelectFolder('admin')">选择</el-button>
                <el-divider direction="vertical" />
                <el-button @click="handleClear('admin')" :disabled="!paths.admin">清除</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="handleSave" :loading="isSaving">保存手动模式配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 自动模式配置 -->
      <el-tab-pane label="自动模式" name="auto">
        <p class="text-sm text-gray-400 mb-4">配置远程仓库地址，自动 clone/pull 代码到本地并切换到指定分支</p>

        <el-form label-width="140px">
          <!-- 本地基础路径 -->
          <el-form-item label="本地存储路径" required>
            <el-input v-model="autoConfig.localBasePath" placeholder="所有项目 clone 到此目录下（首次需要选择）">
              <template #append>
                <el-button @click="handleSelectBasePath">选择</el-button>
                <el-divider direction="vertical" />
                <el-button @click="handleClearBasePath" :disabled="!autoConfig.localBasePath">清除</el-button>
              </template>
            </el-input>
            <div class="text-xs text-gray-400 mt-1">项目将 clone 到此目录下，每个仓库自动创建子文件夹</div>
          </el-form-item>

          <el-divider content-position="left">H5 端</el-divider>

          <el-form-item label="H5 远程仓库地址">
            <el-input v-model="autoConfig.h5.repoUrl" placeholder="例如: git@gitlab.xxx.com:group/h5-project.git" clearable />
          </el-form-item>

          <el-form-item label="H5 目标分支">
            <el-input v-model="autoConfig.h5.branch" placeholder="默认: test" clearable style="max-width: 300px" />
          </el-form-item>

          <el-divider content-position="left">PC 端</el-divider>

          <el-form-item label="PC 远程仓库地址">
            <el-input v-model="autoConfig.pc.repoUrl" placeholder="例如: git@gitlab.xxx.com:group/pc-project.git" clearable />
          </el-form-item>

          <el-form-item label="PC 目标分支">
            <el-input v-model="autoConfig.pc.branch" placeholder="默认: test" clearable style="max-width: 300px" />
          </el-form-item>

          <el-divider content-position="left">Admin 端</el-divider>

          <el-form-item label="Admin 远程仓库地址">
            <el-input v-model="autoConfig.admin.repoUrl" placeholder="例如: git@gitlab.xxx.com:group/admin-project.git" clearable />
          </el-form-item>

          <el-form-item label="Admin 目标分支">
            <el-input v-model="autoConfig.admin.branch" placeholder="默认: test" clearable style="max-width: 300px" />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="handleSaveAutoConfig" :loading="isSaving">保存自动模式配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
</style>
