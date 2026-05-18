<script setup lang="ts">
import { ref, computed } from 'vue'
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
 * 生成 JSON 数据
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
      <el-button type="primary" @click="generateJson" :disabled="!selectedFile">生成预览</el-button>
      <el-button type="success" @click="downloadJson" :disabled="Object.keys(jsonData).length === 0">下载 JSON</el-button>
    </div>

    <div v-if="Object.keys(jsonData).length > 0" class="mt-4 p-4 bg-gray-50 rounded border max-h-96 overflow-auto">
      <pre>{{ JSON.stringify(jsonData, null, 2) }}</pre>
    </div>
  </div>
</template>