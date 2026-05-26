<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import SelectFileDialog, { type Interface } from '@/components/SelectFileDialog.vue'

const folderPath = ref<string>('')
const jsonFolder = ref<string>('')
const fileList = ref<Array<{ name: string; path: string; isDirectory: boolean; size: number }>>([])
const selectedFiles = ref<Array<{ name: string; path: string; isDirectory: boolean; size: number }>>([])
const isProcessing = ref(false)
const tableRef = ref()
const selectFileDialogRef = ref<InstanceType<typeof SelectFileDialog>>()

const selectedLocales = computed(() => selectedFiles.value.map(file => ({
  code: file.name.split('.')[0],
  standardFilePath: file.path,
  uniAppFilePath: ''
})))

/**
 * 选择 Admin 多语言源文件夹
 */
const handleSelectFolder = async () => {
  try {
    const path = await window.electronAPI?.selectFolder()
    if (path) {
      folderPath.value = path
      ElMessage.success(`已选择文件夹: ${path}`)

      const result = await window.electronAPI?.getAdminLocales(path)
      if (result?.success) {
        ElMessage.success(`找到 ${result.languages?.length || 0} 个语言包`)
      } else {
        ElMessage.error(result?.error || '读取文件夹失败')
      }
    }
  } catch (error) {
    ElMessage.error('操作失败')
    console.error('错误:', error)
  }
}

/**
 * 提取并生成 JSON 文件
 */
const handleExtractJson = async () => {
  if (!folderPath.value) {
    ElMessage.warning('请先选择文件夹')
    return
  }

  try {
    isProcessing.value = true
    ElMessage.info('正在提取并生成 JSON...')

    await window.electronAPI?.extractAdminLocales(folderPath.value)

    jsonFolder.value = folderPath.value
    ElMessage.success('JSON 文件已生成！现在可以进行多语言处理')

    const result = await window.electronAPI?.getFolderFiles(jsonFolder.value)
    if (result?.success) {
      fileList.value = (result.files || [])
        .filter(file => file.name.includes('.json'))
        .filter(file => !file.name.includes('uni-app'))
        .filter(file => !file.name.includes('temp'))
      ElMessage.success(`找到 ${fileList.value?.length} 个 JSON 文件`)
    }
  } catch (error) {
    ElMessage.error('操作失败')
    console.error('错误:', error)
  } finally {
    isProcessing.value = false
  }
}

/**
 * 处理表格选择变化
 */
const handleSelectionChange = (selection: Array<{ name: string; path: string; isDirectory: boolean; size: number }>) => {
  selectedFiles.value = selection
}

/**
 * 全选/取消全选
 */
const handleSelectAll = () => {
  if (selectedFiles.value?.length === fileList.value?.length) {
    tableRef.value?.clearSelection()
  } else {
    fileList.value.forEach(row => {
      tableRef.value?.toggleRowSelection(row, true)
    })
  }
}

/**
 * 导出为 Excel
 */
const handleToExcel = async () => {
  if (!selectedFiles.value?.length) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  selectFileDialogRef.value?.openDialog(selectedLocales.value, 'locales')
}

/**
 * 筛选缺失项
 */
const handleToMissing = async () => {
  if (!selectedFiles.value?.length) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  selectFileDialogRef.value?.openDialog(selectedLocales.value, 'missing')
}

/**
 * 对话框提交
 */
const handleSubmit = async (e: Interface) => {
  if (e.selectType === 'locales') {
    await handleProcessLocales(e)
  } else if (e.selectType === 'missing') {
    await handleProcessMissing(e)
  }
}

/**
 * 处理多语言并导出 Excel
 */
const handleProcessLocales = async ({ standardFile, saveResult }: Interface) => {
  try {
    ElMessage.info('正在处理并生成 Excel...')
    const res = await window.electronAPI?.processLocales(JSON.stringify(selectedLocales.value), standardFile)

    if (res?.success && res.data) {
      const exportResult = await window.electronAPI?.exportExcelToFolder(res.data, saveResult)
      if (exportResult?.success) {
        ElMessage.success(`导出成功！文件已保存到: ${exportResult.filePath}`)
      } else {
        ElMessage.error(exportResult?.error || '导出失败')
      }
    } else {
      ElMessage.error(res?.error || '转换失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
    console.error('错误:', error)
  }
}

/**
 * 处理缺失项对比
 */
const handleProcessMissing = async ({ standardFile, controlFile, saveResult }: Interface) => {
  try {
    ElMessage.info('正在分析缺失项...')
    const res = await window.electronAPI?.processMissingLocales(
      JSON.stringify(selectedLocales.value),
      standardFile,
      controlFile || undefined
    )

    if (res?.success && res.results) {
      const exportResult = await window.electronAPI?.exportMissingExcel(res.results, JSON.stringify({ saveResult, standardFile, controlFile }))
      if (exportResult?.success) {
        const totalMissing = res.results.reduce((sum, r) => sum + r.count, 0)
        ElMessage.success(`分析完成！共发现 ${totalMissing} 个缺失项`)
      } else {
        ElMessage.error(exportResult?.error || '导出失败')
      }
    } else {
      ElMessage.error(res?.error || '分析失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
    console.error('错误:', error)
  }
}

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
</script>

<template>
  <div class="mt-3 p-5">
    <h2 class="text-xl font-bold mb-4">Admin 多语言工具</h2>

    <el-button @click="handleSelectFolder">选择源文件夹</el-button>
    <el-button
      v-if="folderPath"
      type="primary"
      @click="handleExtractJson"
      :loading="isProcessing"
    >
      提取并生成 JSON
    </el-button>

    <el-button
      v-if="jsonFolder"
      type="success"
      @click="handleToExcel"
      :disabled="!selectedFiles?.length"
    >
      将选中多语言转换成表格 ({{ selectedFiles.length }})
    </el-button>

    <el-button
      v-if="jsonFolder"
      type="warning"
      @click="handleToMissing"
      :disabled="!selectedFiles?.length"
    >
      筛选出指定文件的缺失项 ({{ selectedFiles.length }})
    </el-button>

    <div v-if="folderPath" class="mt-3 text-gray-600">
      源文件夹: {{ folderPath }}
    </div>

    <div v-if="jsonFolder" class="mt-3 text-green-600 font-bold">
      JSON 文件夹: {{ jsonFolder }}
    </div>

    <div v-if="fileList?.length > 0" class="mt-5">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-lg font-bold">JSON 文件 (共 {{ fileList?.length }} 个，已选 {{ selectedFiles?.length }} 个)</h3>
        <el-button size="small" @click="handleSelectAll">
          {{ selectedFiles?.length === fileList?.length ? '取消全选' : '全选' }}
        </el-button>
      </div>
      <el-table
        ref="tableRef"
        :data="fileList"
        border
        style="width: 100%"
        max-height="400"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="文件名" />
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <SelectFileDialog ref="selectFileDialogRef" @on-submit="handleSubmit" />
  </div>
</template>

<style scoped>
</style>