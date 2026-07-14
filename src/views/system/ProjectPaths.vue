<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

interface ProjectPaths {
  h5: string
  pc: string
  admin: string
}

const paths = ref<ProjectPaths>({ h5: '', pc: '', admin: '' })
const isSaving = ref(false)

/** 加载已保存的项目路径 */
const loadPaths = async () => {
  const res = await window.electronAPI?.getProjectPaths()
  if (res?.success && res.data) {
    paths.value = res.data
  }
}

/** 选择文件夹 */
const handleSelectFolder = async (key: keyof ProjectPaths) => {
  const p = await window.electronAPI?.selectFolder()
  if (p) {
    paths.value[key] = p
  }
}

/** 保存配置 */
const handleSave = async () => {
  isSaving.value = true
  try {
    const res = await window.electronAPI?.saveProjectPaths(JSON.stringify(paths.value, null, 2))
    if (res?.success) {
      ElMessage.success('项目路径已保存，各页面将自动填入')
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

onMounted(() => {
  loadPaths()
})
</script>

<template>
  <div class="p-5 mt-3 max-w-3xl mx-auto">
    <h2 class="text-xl font-bold mb-2">环境配置</h2>
    <p class="text-sm text-gray-500 mb-6">配置各端多语言项目路径，保存后各功能页将自动填入，无需每次手动选择</p>

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
        <el-button type="primary" @click="handleSave" :loading="isSaving">保存配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
</style>
