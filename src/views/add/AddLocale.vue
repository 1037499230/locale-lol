<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'

const targetType = ref('h5') // 新增：目标类型选择
const config = ref({
  directoryPath: '',
  excludePattern: 'uni-app',
  targetProperty: 'common',
  objectsToAdd: '{}'
})

const showLangDialog = ref(false)
const langMapStr = ref('{}')
const isProcessing = ref(false)
const currentLangMap = ref<Record<string, string>>({}) // 存储当前加载的语言映射

/**
 * 根据语言映射生成默认的 JSON 模板
 */
const generateDefaultTemplate = (langMap: Record<string, string>) => {
  const template: Record<string, any> = {
    newKey: {}
  }
  Object.values(langMap).forEach(langCode => {
    template.newKey[langCode] = ''
  })
  config.value.objectsToAdd = JSON.stringify(template, null, 2)
}

/**
 * 加载语言映射配置并更新模板
 */
const loadLangMap = async (type: string) => {
  const res = await window.electronAPI?.getLangMap(type)
  if (res?.success && res.data) {
    currentLangMap.value = res.data
    generateDefaultTemplate(res.data)
  }
}

/**
 * 监听类型切换，重新加载映射
 */
watch(targetType, (newType) => {
  loadLangMap(newType)
})

/**
 * 打开语言映射管理弹窗
 */
const openLangDialog = async () => {
  langMapStr.value = JSON.stringify(currentLangMap.value, null, 2)
  showLangDialog.value = true
}

/**
 * 保存语言映射配置
 */
const handleSaveLang = async () => {
  try {
    const data = JSON.parse(langMapStr.value)
    const res = await window.electronAPI?.saveLangMap(JSON.stringify(data, null, 2), targetType.value)
    if (res?.success) {
      ElMessage.success('语言配置已更新')
      currentLangMap.value = data
      generateDefaultTemplate(data) // 更新模板
      showLangDialog.value = false
    } else {
      ElMessage.error(res?.error || '保存失败')
    }
  } catch (e: any) {
    ElMessage.error('JSON 格式错误: ' + e.message)
  }
}

/**
 * 选择目标文件夹
 */
const handleSelectDir = async () => {
  const path = await window.electronAPI?.selectFolder()
  if (path) {
    config.value.directoryPath = path
  }
}

/**
 * 执行批量添加
 */
const handleAdd = async () => {
  if (!config.value.directoryPath) {
    ElMessage.warning('请先选择目标文件夹')
    return
  }

  try {
    let objects
    try {
      objects = JSON.parse(config.value.objectsToAdd)
    } catch (e: any) {
      ElMessage.error('objectsToAdd 必须是合法的 JSON 格式')
      return
    }

    isProcessing.value = true
    ElMessage.info('正在批量处理...')

    const apiCall = targetType.value === 'pc'
      ? window.electronAPI?.batchAddLocalePc
      : window.electronAPI?.batchAddLocale

    const res = await apiCall(
      config.value.directoryPath,
      config.value.excludePattern,
      config.value.targetProperty,
      JSON.stringify(objects),
      targetType.value
    )

    if (res?.success) {
      ElMessage.success(`处理完成！${res.message}`)
    } else {
      ElMessage.error(res?.error || '处理失败')
    }
  } catch (error: any) {
    ElMessage.error('操作异常: ' + error.message)
  } finally {
    isProcessing.value = false
  }
}

onMounted(() => {
  loadLangMap('h5')
})
</script>

<template>
  <div class="p-5 mt-3 max-w-4xl mx-auto">
    <h2 class="text-xl font-bold mb-6 flex justify-between items-center">
      <span>批量新增多语言词条</span>
      <el-button size="small" @click="openLangDialog">管理语言映射</el-button>
    </h2>

    <el-form label-width="120px">
      <el-form-item label="新增哪个">
        <el-radio-group v-model="targetType">
          <el-radio label="h5">H5 端</el-radio>
          <el-radio label="pc">PC 端</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="目标文件夹">
        <el-input v-model="config.directoryPath" placeholder="请选择包含多语言文件的文件夹">
          <template #append>
            <el-button @click="handleSelectDir">选择</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="排除关键词">
        <el-input v-model="config.excludePattern" placeholder="例如: uni-app" />
      </el-form-item>

      <el-form-item label="目标属性路径">
        <el-input v-model="config.targetProperty" placeholder="例如: common 或 common.buttons" />
      </el-form-item>

      <el-form-item label="新增对象 (JSON)">
        <el-input
          type="textarea"
          v-model="config.objectsToAdd"
          :rows="10"
          placeholder="正在加载语言映射..."
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleAdd" :loading="isProcessing">开始添加</el-button>
      </el-form-item>
    </el-form>

    <!-- 语言映射管理弹窗 -->
    <el-dialog v-model="showLangDialog" :title="`管理 ${targetType.toUpperCase()} 语言映射`">
      <el-input
        type="textarea"
        v-model="langMapStr"
        :rows="15"
        placeholder="请输入 JSON 格式的语言映射"
      />
      <template #footer>
        <el-button @click="showLangDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveLang">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>