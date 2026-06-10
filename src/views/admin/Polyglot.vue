<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage, ElTable } from 'element-plus'
import SelectFileDialog, { type Interface } from '@/components/SelectFileDialog.vue'
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const folderPath = ref<string>('')
const jsonFolder = ref<string>('')
const fileList = ref<Array<{ name: string; path: string; isDirectory: boolean; size: number }>>([])
const selectedFiles = ref<Array<{ name: string; path: string; isDirectory: boolean; size: number }>>([])
const isProcessing = ref(false)
const tableRef = ref<InstanceType<typeof ElTable>>()
const selectFileDialogRef = ref<InstanceType<typeof SelectFileDialog>>()
const guideShow = ref(0)
const tableKey = ref(0)

/**
 * 初始化引导功能
 */
const startGuide = () => {
  const driverObj = driver({
    showProgress: true,
    steps: [
      {
        element: '.box',
        popover: {
          title: '👋 欢迎使用 Admin 多语言工具',
          description: '专治各种嵌套结构的 TS 多语言文件！',
          side: "bottom",
          align: 'start'
        },
      },
      {
        element: '.select-file',
        popover: {
          title: '第一步：选择源文件夹',
          description: '点我选择包含多个语言子文件夹（如 zh, en）的根目录。',
          side: "bottom",
          align: 'start',
          onNextClick: () => {
            guideShow.value = 1
            // 模拟数据用于引导展示
            fileList.value = [{ name: 'zh.json', path: 'zh.json', isDirectory: false, size: 4096 }, { name: 'en.json', path: 'en.json', isDirectory: false, size: 3500 }]
            jsonFolder.value = '/mock/path/to/locales'
            nextTick(() => {
              driverObj.moveNext()
            })
          },
        },
      },
      {
        element: '.extract-btn',
        popover: {
          title: '第二步：提取并生成 JSON',
          description: '点击这里，工具会自动把嵌套的 TS 结构提取成扁平的 JSON 文件。',
          side: "bottom",
          align: 'start',
          onPrevClick: () => {
            guideShow.value = 0
            fileList.value = []
            jsonFolder.value = ''
            nextTick(() => {
              driverObj.movePrevious()
            })
          },
          onNextClick: () => {
            guideShow.value = 2
            nextTick(() => {
              driverObj.moveNext()
            })
          },
        },
      },
      {
        element: '.file-table',
        popover: {
          title: '第三步：勾选要处理的文件',
          description: '提取完成后，在这里勾选你要对比或导出的语言 JSON。',
          side: "bottom",
          align: 'start',
          onPrevClick: () => {
            guideShow.value = 1
            jsonFolder.value = ''
            nextTick(() => {
              driverObj.movePrevious()
            })
          },
          onNextClick: () => {
            guideShow.value = 3
            tableRef.value!.clearSelection()
            tableRef.value!.toggleAllSelection()
            nextTick(() => {
              driverObj.moveNext()
            })
          },
        },
      },
      {
        element: '.to-excel',
        popover: {
          title: '功能一：导出对照表',
          description: '把所有语言打包成一个 Excel 表格，方便统一翻译。',
          side: "bottom",
          align: 'start',
          onPrevClick: () => {
            guideShow.value = 2
            tableRef.value!.clearSelection()
            tableRef.value!.toggleAllSelection()
            nextTick(() => {
              driverObj.movePrevious()
            })
          },
        },
      },
      {
        element: '.to-missing-excel',
        popover: {
          title: '功能二：揪出缺失项',
          description: '一键找出哪些语言还没翻译完，生成缺失报告。',
          side: "bottom",
          align: 'start',
          onPrevClick: () => {
            guideShow.value = 2
            tableRef.value!.clearSelection()
            tableRef.value!.toggleAllSelection()
            nextTick(() => {
              driverObj.movePrevious()
            })
          },
        },
      },
      {
        element: '.box',
        popover: {
          title: '🎉 引导结束',
          description: 'Admin 的多语言虽然结构复杂，但用这个工具一样简单！',
          side: "bottom",
          align: 'start',
          onNextClick: () => {
            guideShow.value = 0
            fileList.value = []
            jsonFolder.value = ''
            driverObj.moveNext();
          },
        },
      }
    ],
    onDestroyStarted: () => {
      if (!driverObj.hasNextStep() || confirm("你学废了吗？")) {
        guideShow.value = 0
        fileList.value = []
        jsonFolder.value = ''
        driverObj.destroy();
      }
    },
  });
  driverObj.drive();
}

const selectedLocales = computed(() => selectedFiles.value.map(file => ({
  code: file.name.split('.')[0],
  standardFilePath: file.path,
  uniAppFilePath: ''
})))

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

const handleSelectionChange = (selection: Array<{ name: string; path: string; isDirectory: boolean; size: number }>) => {
  selectedFiles.value = selection
}

const handleSelectAll = () => {
  if (selectedFiles.value?.length === fileList.value?.length) {
    tableRef.value?.clearSelection()
  } else {
    fileList.value.forEach(row => {
      tableRef.value?.toggleRowSelection(row, true)
    })
  }
}

const handleToExcel = async () => {
  if (guideShow.value > 0) return
  if (!selectedFiles.value?.length) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  selectFileDialogRef.value?.openDialog(selectedLocales.value, 'locales')
}

const handleToMissing = async () => {
  if (guideShow.value > 0) return
  if (!selectedFiles.value?.length) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  selectFileDialogRef.value?.openDialog(selectedLocales.value, 'missing')
}

const handleSubmit = async (e: Interface) => {
  if (e.selectType === 'locales') {
    await handleProcessLocales(e)
  } else if (e.selectType === 'missing') {
    await handleProcessMissing(e)
  }
}

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

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
</script>

<template>
  <div class="mt-3 box">
    <h2 class="text-xl font-bold mb-4">Admin 多语言工具</h2>

    <el-button @click="handleSelectFolder" class="select-file" :class="{'pointer-events-none': guideShow > 0}">选择源文件夹</el-button>
    <el-button
      v-if="folderPath || guideShow > 0"
      type="primary"
      @click="handleExtractJson"
      :loading="isProcessing"
      class="extract-btn"
    >
      提取并生成 JSON
    </el-button>

    <el-button
      v-if="jsonFolder || (guideShow > 1)"
      type="success"
      @click="handleToExcel"
      :disabled="!selectedFiles?.length"
      class="to-excel"
    >
      将选中多语言转换成表格 ({{ selectedFiles.length }})
    </el-button>

    <el-button
      v-if="jsonFolder || (guideShow > 1)"
      type="warning"
      @click="handleToMissing"
      :disabled="!selectedFiles?.length"
      class="to-missing-excel"
    >
      筛选出指定文件的缺失项 ({{ selectedFiles.length }})
    </el-button>

    <el-button @click="startGuide" type="text" color="red" size="small">帮助</el-button>

    <div v-if="folderPath" class="mt-3 text-gray-600">
      源文件夹: {{ folderPath }}
    </div>

    <div v-if="jsonFolder" class="mt-3 text-green-600 font-bold">
      JSON 文件夹: {{ jsonFolder }}
    </div>

    <div v-if="fileList?.length > 0 || guideShow > 1" class="mt-5 file-table">
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
        :key="tableKey"
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