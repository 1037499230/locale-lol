<script setup lang="ts">
import {computed, ref} from 'vue'
import { ElMessage } from 'element-plus'
import SelectFileDialog, {type Interface} from "@/views/h5/components/SelectFileDialog.vue";

// 当前选择的文件夹路径
const folderPath = ref<string>('')
// 文件夹中的所有文件列表（JSON格式的多语言文件）
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
 * 根据选中的文件名提取语言代码，并生成标准文件路径和 uni-app 文件路径
 * @returns {Array<{code: string, standardFilePath: string, uniAppFilePath: string}>} 语言配置数组
 */
const selectedLocales = computed(() => selectedFiles.value.map(file => {
  let name
  if (file.name.includes('zh-Hans')) {
    name = 'zh'
  } else {
    name = file.name.split('.')[0]
  }
  return {
    code: name,
    standardFilePath: file.path,
    uniAppFilePath: file.path.replace(/\\([^\\]+)$/, '\\uni-app.$1')
  }
}))

/**
 * 处理选择文件夹操作
 * 调用 Electron API 选择文件夹，读取其中的 JSON 文件并过滤出符合条件的多语言文件
 * 过滤规则：
 * - 必须是 .json 文件
 * - 不包含 'uni-app' 的文件
 * - 不包含 'temp' 的文件
 * - 文件名（不含扩展名）长度不超过 10 个字符
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
            .filter(file => file.name.includes('.json'))
            .filter(file => !file.name.includes('uni-app'))
            .filter(file => !file.name.includes('temp'))
            .filter(file => file.name.split('.')[0].length <= 10)
        localeList.value = fileList.value.map(file => {
          let name
          if (file.name.includes('zh-Hans')) {
            name = 'zh'
          } else {
            name = file.name.split('.')[0]
          }
          return {
            code: name,
            standardFilePath: file.path,
            uniAppFilePath: file.path.replace(/\\([^\\]+)$/, '\\uni-app.$1')
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
 * @param {Array<{name: string, path: string, isDirectory: boolean, size: number}>} selection - 当前选中的文件列表
 */
const handleSelectionChange = (selection: Array<{ name: string; path: string; isDirectory: boolean; size: number }>) => {
  selectedFiles.value = selection
}

/**
 * 处理全选/取消全选操作
 * 如果当前已全选则取消全选，否则选中所有文件
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
 * 验证是否有选中文件，打开选择对话框进行多语言配置导出
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
 * 验证是否有选中文件，打开选择对话框进行缺失项对比分析
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
 * 根据选择类型（locales 或 missing）调用相应的处理函数
 * @param {Interface} e - 提交事件对象，包含选择类型和相关文件信息
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
 * 调用 Electron API 处理选中的多语言配置，生成 Excel 文件并保存到指定位置
 * @param {Interface} param0 - 参数对象
 * @param {string} param0.standardFile - 标准文件路径
 * @param {string} param0.saveResult - 保存结果的路径
 */
const handleProcessLocales = async ({standardFile, saveResult}: Interface) => {
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
 * 处理缺失项对比并导出 Excel
 * 分析选中文件中相对于标准文件的缺失项，生成对比报告
 * @param {Interface} param0 - 参数对象
 * @param {string} param0.standardFile - 标准文件路径
 * @param {string} param0.controlFile - 对照文件路径
 * @param {string} param0.saveResult - 保存结果的路径
 */
const handleProcessMissing = async ({standardFile, controlFile, saveResult}: Interface) => {
  try {
    console.log(standardFile, controlFile, saveResult)
    // todo 处理缺失项对比
    ElMessage.info('正在分析缺失项...')
  } catch (error) {
    ElMessage.error('操作失败')
    console.error('错误:', error)
  }
}

/**
 * 格式化文件大小
 * 将字节数转换为人类可读的单位（B、KB、MB、GB）
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小字符串
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
  <div class="mt-5 p-5">
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

    <SelectFileDialog ref="selectFileDialogRef" @on-submit="handleSubmit"/>
  </div>
</template>

<style scoped>

</style>
