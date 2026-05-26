<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import SelectFileDialog, { type Interface } from '@/components/SelectFileDialog.vue'

// 当前选择的文件夹路径
const folderPath = ref<string>('')
// 文件夹中的所有文件列表（TypeScript 格式的多语言文件）
const fileList = ref<Array<{ name: string; path: string; isDirectory: boolean; size: number }>>([])
// 解析后的语言配置列表
const localeList = ref<Array<any>>([])
// 用户选中的文件列表
const selectedFiles = ref<Array<{ name: string; path: string; isDirectory: boolean; size: number }>>([])
// 表格组件的引用，用于操作表格选择状态
const tableRef = ref()
// 选择文件对话框组件的引用
const selectFileDialogRef = ref<InstanceType<typeof SelectFileDialog>>()

/**
 * 计算选中的语言配置
 * 根据选中的文件名提取语言代码，并生成标准文件路径
 */
const selectedLocales = computed(() => selectedFiles.value.map(file => {
  const name = file.name.includes('zh-Hans') ? 'zh' : file.name.split('.')[0]
  return {
    code: name,
    filePath: file.path
  }
}))

/**
 * 处理选择文件夹操作
 * 调用 Electron API 选择文件夹，读取其中的 .ts 文件并过滤出符合条件的多语言文件
 */
const handleSelectFolder = async () => {
  try {
    const path = await window.electronAPI?.selectFolder()
    if (path) {
      folderPath.value = path
      ElMessage.success(`已选择文件夹: ${path}`)

      const result = await window.electronAPI?.getFolderFiles(path)
      if (result?.success) {
        fileList.value = (result.files || [])
          .filter(file => file.name.includes('.ts'))
          .filter(file => !file.name.includes('uni-app'))
          .filter(file => !file.name.includes('temp'))
          .filter(file => file.name.split('.')[0].length <= 10)

        localeList.value = fileList.value.map(file => {
          const name = file.name.includes('zh-Hans') ? 'zh' : file.name.split('.')[0]
          return {
            code: name,
            filePath: file.path
          }
        })
        ElMessage.success(`找到 ${fileList.value.length} 个文件`)
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
 * 处理表格选择变化事件
 */
const handleSelectionChange = (selection: Array<{ name: string; path: string; isDirectory: boolean; size: number }>) => {
  selectedFiles.value = selection
}

/**
 * 处理全选/取消全选操作
 */
const handleSelectAll = () => {
  if (selectedFiles.value.length === fileList.value.length) {
    tableRef.value?.clearSelection()
  } else {
    fileList.value.forEach(row => {
      tableRef.value?.toggleRowSelection(row, true)
    })
  }
}

/**
 * 处理导出为 Excel 文件
 */
const handleToExcel = async () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  selectFileDialogRef.value?.openDialog(selectedLocales.value, 'locales')
}

/**
 * 处理筛选缺失项
 */
const handleToMissing = async () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  selectFileDialogRef.value?.openDialog(selectedLocales.value, 'missing')
}

/**
 * 处理对话框提交事件
 */
const handleSubmit = async (e: Interface) => {
  if (e.selectType === 'locales') {
    await handleProcessLocales(e)
  } else if (e.selectType === 'missing') {
    await handleProcessMissing(e)
  } else {
    ElMessage.error('你选了个什么玩意？')
  }
}

/**
 * 处理语言配置并导出 Excel
 */
const handleProcessLocales = async ({ standardFile, saveResult }: Interface) => {
  try {
    ElMessage.info('正在处理并生成 Excel...')

    const res = await window.electronAPI?.processPcLocales(
      JSON.stringify(selectedLocales.value),
      standardFile
    )

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
 * 处理缺失项对比并导出 Excel
 */
const handleProcessMissing = async ({ standardFile, controlFile, saveResult }: Interface) => {
  try {
    ElMessage.info('正在分析缺失项...')

    const res = await window.electronAPI?.processPcMissingLocales(
      JSON.stringify(selectedLocales.value),
      standardFile,
      controlFile || undefined
    )

    if (res?.success && res.results) {
      const exportResult = await window.electronAPI?.exportMissingExcel(res.results, JSON.stringify({ saveResult, standardFile, controlFile }))

      if (exportResult?.success) {
        const totalMissing = res.results.reduce((sum, r) => sum + r.count, 0)
        ElMessage.success(`分析完成！共发现 ${totalMissing} 个缺失项，文件已保存到: ${saveResult}`)
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
  <div class="mt-3">
    <el-button @click="handleSelectFolder">选择源文件夹</el-button>
    <el-button
      v-if="folderPath"
      type="primary"
      @click="handleToExcel"
      :disabled="selectedFiles.length === 0"
    >
      将选中多语言转换成表格 ({{ selectedFiles.length }})
    </el-button>

    <el-button
      v-if="folderPath"
      type="primary"
      @click="handleToMissing"
      :disabled="selectedFiles.length === 0"
    >
      筛选出指定文件的缺失项 ({{ selectedFiles.length }})
    </el-button>

    <div v-if="folderPath" class="mt-3 text-gray-600">
      已选择: {{ folderPath }}
    </div>

    <div v-if="fileList.length > 0" class="mt-5">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-lg font-bold">多语言文件 (共 {{ fileList.length }} 个，已选 {{ selectedFiles.length }} 个)</h3>
        <el-button size="small" @click="handleSelectAll">
          {{ selectedFiles.length === fileList.length ? '取消全选' : '全选' }}
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