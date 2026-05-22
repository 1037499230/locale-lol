<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const workbook = ref<XLSX.WorkBook | null>(null)
const sheetName = ref<string>('')
const keyCol = ref<string>('')
const valueCol = ref<string>('')
const headers = ref<string[]>([])
const jsonData = ref<Record<string, any>>({})
const sheetNames = ref<string[]>([])
const showMergeDialog = ref(false)
const targetType = ref('h5')
const targetFilePath = ref<string>('')

/**
 * 处理文件选择
 */
const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
    parseExcel(target.files[0])
  }
}

/**
 * 解析 Excel 文件
 */
const parseExcel = (file: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target?.result as ArrayBuffer)
    workbook.value = XLSX.read(data, { type: 'array' })

    // 获取所有工作表名称
    sheetNames.value = workbook.value.SheetNames

    if (sheetNames.value.length > 0) {
      sheetName.value = sheetNames.value[0]
      loadSheetData(sheetName.value)
    }
  }
  reader.readAsArrayBuffer(file)
}

/**
 * 切换工作表时加载数据
 */
const handleSheetChange = (name: string) => {
  sheetName.value = name
  loadSheetData(name)
  jsonData.value = {} // 切换表时清空之前的结果
}

/**
 * 加载指定工作表的数据和表头
 */
const loadSheetData = (name: string) => {
  if (!workbook.value) return

  const worksheet = workbook.value.Sheets[name]
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

  if (json.length > 0) {
    headers.value = json[0].map((h: any) => String(h))
    // 默认选中前两列
    if (headers.value.length >= 2) {
      keyCol.value = headers.value[0]
      valueCol.value = headers.value[1]
    } else {
      keyCol.value = ''
      valueCol.value = ''
    }
  }
}

/**
 * 生成 JSON 数据并进入下一步
 */
const generateJson = () => {
  if (!workbook.value || !keyCol.value || !valueCol.value) {
    ElMessage.warning('请确保已选择文件和对应的列')
    return
  }

  const worksheet = workbook.value.Sheets[sheetName.value]
  const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[]
  const result: Record<string, any> = {}

  rows.forEach(row => {
    const k = row[keyCol.value]
    const v = row[valueCol.value]
    if (k !== undefined && k !== null && String(k).trim() !== '' &&
        v !== undefined && v !== null && String(v).trim() !== '') {
      result[String(k)] = v
    }
  })

  jsonData.value = result
  ElMessage.success(`成功提取 ${Object.keys(result).length} 条数据`)

  showMergeDialog.value = true
}

/**
 * 选择目标文件（JSON 或 TS）
 */
const handleSelectTargetFile = async () => {
  const filters = targetType.value === 'pc'
    ? [{ name: 'TypeScript Files', extensions: ['ts'] }]
    : [{ name: 'JSON Files', extensions: ['json'] }]

  const path = await window.electronAPI?.selectTargetFile(filters)
  if (path) {
    targetFilePath.value = path
  }
}

/**
 * 执行合并操作
 */
const handleMerge = async () => {
  if (!targetFilePath.value) {
    ElMessage.warning('请先选择目标文件')
    return
  }

  try {
    ElMessage.info('正在合并...')
    const res = await window.electronAPI?.mergeLocaleFile(
      JSON.stringify(jsonData.value),
      targetType.value,
      targetFilePath.value
    )

    if (res?.success) {
      ElMessage.success('合并成功！')
      showMergeDialog.value = false
      targetFilePath.value = ''
    } else {
      ElMessage.error(res?.error || '合并失败')
    }
  } catch (error) {
    ElMessage.error('操作异常')
  }
}

/**
 * 下载 JSON 文件
 */
const downloadJson = () => {
  if (Object.keys(jsonData.value).length === 0) {
    ElMessage.warning('没有可下载的数据')
    return
  }

  const blob = new Blob([JSON.stringify(jsonData.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedFile.value?.name.split('.')[0] || 'output'}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="p-5 mt-3">
    <h2 class="text-xl font-bold mb-4">Excel 转 JSON 工具</h2>

    <div class="mb-4">
      <input type="file" ref="fileInput" accept=".xlsx, .xls" @change="handleFileSelect" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
    </div>

    <div v-if="sheetNames.length > 0" class="mb-4">
      <label class="block text-sm font-medium text-gray-700">选择工作表 (Sheet)</label>
      <el-select v-model="sheetName" @change="handleSheetChange" class="w-full mt-1">
        <el-option v-for="name in sheetNames" :key="name" :label="name" :value="name" />
      </el-select>
    </div>

    <div v-if="headers.length > 0" class="grid grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block text-sm font-medium text-gray-700">键列 (Key)</label>
        <el-select v-model="keyCol" class="w-full mt-1">
          <el-option v-for="h in headers" :key="h" :label="h" :value="h" />
        </el-select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">值列 (Value)</label>
        <el-select v-model="valueCol" class="w-full mt-1">
          <el-option v-for="h in headers" :key="h" :label="h" :value="h" />
        </el-select>
      </div>
    </div>

    <div class="flex gap-2">
      <el-button type="primary" @click="generateJson" :disabled="!selectedFile">下一步：合并到项目</el-button>
      <el-button type="success" @click="downloadJson" :disabled="Object.keys(jsonData).length === 0">仅下载 JSON</el-button>
    </div>

    <!-- 合并对话框 -->
    <el-dialog v-model="showMergeDialog" title="合并到多语言文件">
      <el-form label-width="100px">
        <el-form-item label="应用类型">
          <el-select v-model="targetType" placeholder="请选择">
            <el-option label="H5 端" value="h5" />
            <el-option label="PC 端" value="pc" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标文件">
          <el-input
            v-model="targetFilePath"
            :placeholder="targetType === 'pc' ? '请选择目标 TS 文件' : '请选择目标 JSON 文件'"
            readonly
          >
            <template #append>
              <el-button @click="handleSelectTargetFile">选择文件</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMergeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleMerge">开始合并</el-button>
      </template>
    </el-dialog>
  </div>
</template>