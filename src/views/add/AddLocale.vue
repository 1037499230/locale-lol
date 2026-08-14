<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

type TargetType = 'h5' | 'pc' | 'admin'
type AddMode = 'single' | 'spreadsheet'

type SpreadsheetSheet = {
  name: string
  headers: string[]
}

type PreviewColumn = {
  prop: string
  label: string
}

type SegmentType = 'path' | 'name' | null

type PreviewRow = {
  __rowId: string
  __key: string
  __segments: string[]
  __segmentTypes: SegmentType[]
  [key: string]: unknown
}

const targetType = ref<TargetType>('h5')
const addMode = ref<AddMode>('single')
const config = ref({
  directoryPath: '',
  excludePattern: 'uni-app',
  targetProperty: 'common',
  objectsToAdd: '{}',
  langText: ''
})

const showLangDialog = ref(false)
const langMapStr = ref('{}')
const isProcessing = ref(false)
const currentLangMap = ref<Record<string, string>>({})

const spreadsheetFilePath = ref('')
const spreadsheetSheets = ref<SpreadsheetSheet[]>([])
const selectedSheetName = ref('')
const selectedKeyColumnIndex = ref<number | null>(null)
const isReadingSpreadsheet = ref(false)
const isImportingSpreadsheet = ref(false)
const previewColumns = ref<PreviewColumn[]>([])
const previewRows = ref<PreviewRow[]>([])
const selectedPreviewRows = ref<PreviewRow[]>([])

const currentSheet = computed(() => {
  return spreadsheetSheets.value.find(sheet => sheet.name === selectedSheetName.value)
})

const keyColumnOptions = computed(() => {
  return currentSheet.value?.headers.map((header, index) => ({
    label: header || `第 ${index + 1} 列`,
    value: index
  })) || []
})

const selectedPreviewRowIds = computed(() => new Set(selectedPreviewRows.value.map(row => row.__rowId)))

const selectedSegmentValidationErrors = computed(() => {
  const errors: string[] = []

  selectedPreviewRows.value.forEach(row => {
    if (row.__segments.some(segment => isBlank(segment))) {
      errors.push(`${row.__key} 含有空的 key 分段`)
      return
    }

    const firstNameIndex = row.__segmentTypes.indexOf('name')
    if (row.__segmentTypes.includes(null)) {
      errors.push(`${row.__key} 仍有未分类分段`)
      return
    }
    if (firstNameIndex === -1) {
      errors.push(`${row.__key} 缺少属性名`)
      return
    }
    if (firstNameIndex === 0) {
      errors.push(`${row.__key} 缺少目标属性路径`)
      return
    }
    const isContinuous = row.__segmentTypes.every((type, index) => {
      return index < firstNameIndex ? type === 'path' : type === 'name'
    })
    if (!isContinuous) {
      errors.push(`${row.__key} 的目标属性路径和属性名必须分别连续，且路径在前`)
    }
  })

  return errors
})

const canImportSpreadsheet = computed(() => {
  return selectedPreviewRows.value.length > 0 && selectedSegmentValidationErrors.value.length === 0
})

const generateDefaultTemplate = (langMap: Record<string, string>) => {
  const template: Record<string, Record<string, string>> = {
    newKey: {}
  }
  Object.values(langMap).forEach(langCode => {
    template.newKey[langCode] = ''
  })
  config.value.objectsToAdd = JSON.stringify(template, null, 2)
}

const loadLangMap = async (type: TargetType) => {
  await updateDefaultPath()
  const res = await window.electronAPI.getLangMap(type)
  if (res.success && res.data) {
    currentLangMap.value = res.data
    generateDefaultTemplate(res.data)
  }
}

const updateDefaultPath = async () => {
  const res = await window.electronAPI.getProjectPaths()
  if (res?.success && res.data) {
    autoFillDirs(res.data)
  }
}

const autoFillDirs = (paths: { h5: string; pc: string; admin: string }) => {
  switch (targetType.value) {
    case 'h5':
      if (paths.h5) config.value.directoryPath = paths.h5
      break
    case 'pc':
      if (paths.pc) config.value.directoryPath = paths.pc
      break
    case 'admin':
      if (paths.admin) config.value.directoryPath = paths.admin
      break
  }
}

const clearSpreadsheetPreview = () => {
  previewColumns.value = []
  previewRows.value = []
  selectedPreviewRows.value = []
}

watch(targetType, (newType) => {
  clearSpreadsheetPreview()
  loadLangMap(newType)
})

watch(selectedSheetName, () => {
  selectedKeyColumnIndex.value = null
  clearSpreadsheetPreview()
})

const openLangDialog = () => {
  langMapStr.value = JSON.stringify(currentLangMap.value, null, 2)
  showLangDialog.value = true
}

const handleSaveLang = async () => {
  try {
    const data = JSON.parse(langMapStr.value)
    const res = await window.electronAPI.saveLangMap(JSON.stringify(data, null, 2), targetType.value)
    if (res.success) {
      ElMessage.success('语言配置已更新')
      currentLangMap.value = data
      generateDefaultTemplate(data)
      clearSpreadsheetPreview()
      showLangDialog.value = false
    } else {
      ElMessage.error(res.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error('JSON 格式错误: ' + error.message)
  }
}

const handleSelectDir = async () => {
  const path = await window.electronAPI.selectFolder()
  if (path) {
    config.value.directoryPath = path
  }
}

const handleAdd = async () => {
  if (!config.value.directoryPath) {
    ElMessage.warning('请先选择目标文件夹')
    return
  }

  try {
    let objects
    try {
      objects = JSON.parse(config.value.objectsToAdd)
    } catch (error: any) {
      ElMessage.error('新增对象必须是合法的 JSON 格式')
      return
    }

    isProcessing.value = true
    ElMessage.info('正在批量处理...')

    let apiCall: any
    let params: any[]

    if (targetType.value === 'pc') {
      apiCall = window.electronAPI.batchAddLocalePc
      params = [
        config.value.directoryPath,
        config.value.excludePattern,
        config.value.targetProperty,
        JSON.stringify(objects),
        targetType.value
      ]
    } else if (targetType.value === 'admin') {
      apiCall = window.electronAPI.batchAddLocaleAdmin
      params = [
        config.value.directoryPath,
        config.value.targetProperty,
        JSON.stringify(objects),
        targetType.value
      ]
    } else {
      apiCall = window.electronAPI.batchAddLocale
      params = [
        config.value.directoryPath,
        config.value.excludePattern,
        config.value.targetProperty,
        JSON.stringify(objects),
        targetType.value
      ]
    }

    const res = await apiCall(...params)

    if (res?.success) {
      ElMessage.success(`处理完成：${res.message}`)
    } else {
      console.error(res)
      ElMessage.error(res?.error || '处理失败')
    }
  } catch (error: any) {
    ElMessage.error('操作异常: ' + error.message)
  } finally {
    isProcessing.value = false
  }
}

const quickHandwriting = () => {
  if (!config.value.langText) {
    ElMessage.warning('请输入要快速填充的文本')
    return
  }

  try {
    const objects = JSON.parse(config.value.objectsToAdd)
    for (const key in objects) {
      for (const langCode in objects[key]) {
        objects[key][langCode] = config.value.langText
      }
    }
    config.value.objectsToAdd = JSON.stringify(objects, null, 2)
    ElMessage.success('已快速填充')
  } catch (error: any) {
    ElMessage.error('新增对象必须是合法的 JSON 格式')
  }
}

const toCellText = (value: unknown) => value == null ? '' : String(value)
const isBlank = (value: unknown) => toCellText(value).trim() === ''

const handleSelectSpreadsheetFile = async () => {
  const filePath = await window.electronAPI.selectSpreadsheetFile()
  if (!filePath) return

  // 选择新文件后立即清空旧工作表、键列选择和预览数据，避免混用旧文件数据。
  spreadsheetFilePath.value = ''
  spreadsheetSheets.value = []
  selectedSheetName.value = ''
  selectedKeyColumnIndex.value = null
  clearSpreadsheetPreview()

  const res = await window.electronAPI.getSpreadsheetMetadata(filePath)
  if (!res.success || !res.sheets?.length) {
    ElMessage.error(res.error || '未读取到可用工作表')
    return
  }

  spreadsheetFilePath.value = filePath
  spreadsheetSheets.value = res.sheets
  selectedSheetName.value = res.sheets[0].name
}

const handleReadSpreadsheet = async () => {
  if (!spreadsheetFilePath.value) {
    ElMessage.warning('请先选择表格文件')
    return
  }
  if (!selectedSheetName.value) {
    ElMessage.warning('请选择工作表')
    return
  }
  if (selectedKeyColumnIndex.value === null) {
    ElMessage.warning('请选择键列')
    return
  }

  isReadingSpreadsheet.value = true
  try {
    const [sheetRes, titleKeysRes, langMapRes] = await Promise.all([
      window.electronAPI.readSpreadsheetSheet(spreadsheetFilePath.value, selectedSheetName.value),
      window.electronAPI.getTitleKeys(),
      window.electronAPI.getLangMap(targetType.value)
    ])

    if (!sheetRes.success || !sheetRes.rows) {
      ElMessage.error(sheetRes.error || '读取表格数据失败')
      return
    }
    if (!titleKeysRes.success || !titleKeysRes.data) {
      ElMessage.error(titleKeysRes.error || '读取表格键值管理配置失败')
      return
    }
    if (!langMapRes.success || !langMapRes.data) {
      ElMessage.error(langMapRes.error || '读取当前项目语言映射失败')
      return
    }

    const rows = sheetRes.rows
    const headers = rows[0]?.map(toCellText) || []
    const keyColumnIndex = selectedKeyColumnIndex.value
    if (keyColumnIndex >= headers.length) {
      ElMessage.error('所选键列不存在，请重新选择')
      return
    }

    // 表格键值管理：语言代码 -> 中文表头，读取时需要反向为 中文表头 -> 语言代码。
    const sourceCodeByTitle = Object.entries(titleKeysRes.data).reduce<Record<string, string>>((result, [code, title]) => {
      const titleText = toCellText(title)
      if (titleText && !result[titleText]) result[titleText] = code
      return result
    }, {})

    // 当前项目语言映射：项目语言键 -> 通用语言代码，读取时反向为 通用语言代码 -> 项目语言键。
    const targetCodeBySourceCode = Object.entries(langMapRes.data).reduce<Record<string, string>>((result, [targetCode, sourceCode]) => {
      const sourceCodeText = toCellText(sourceCode)
      if (sourceCodeText && !result[sourceCodeText]) result[sourceCodeText] = targetCode
      return result
    }, {})

    const validLanguageColumns: Array<{ index: number; targetCode: string }> = []
    const usedTargetCodes = new Set<string>()
    headers.forEach((header, index) => {
      if (index === keyColumnIndex) return
      const sourceCode = sourceCodeByTitle[header]
      const targetCode = sourceCode && targetCodeBySourceCode[sourceCode]
      // 无法反查表头或不在当前项目语言映射里的列，均作为脏数据过滤。
      if (!targetCode || usedTargetCodes.has(targetCode)) return
      usedTargetCodes.add(targetCode)
      validLanguageColumns.push({ index, targetCode })
    })

    const rowsByKey = new Map<string, PreviewRow>()
    rows.slice(1).forEach((row, rowIndex) => {
      const key = toCellText(row[keyColumnIndex])
      // 键列为空时整行作为脏数据过滤。
      if (isBlank(key)) return

      const previewRow: PreviewRow = {
        __rowId: `${rowIndex}-${key}`,
        __key: key,
        __segments: key.split('.'),
        __segmentTypes: key.split('.').map(() => null)
      }

      validLanguageColumns.forEach(({ index, targetCode }) => {
        const value = toCellText(row[index])
        // 单个语言为空时预览保持为空，后续导入阶段可直接省略该属性。
        if (!isBlank(value)) previewRow[targetCode] = value
      })

      // 同一个 key 完全以最后出现的整行为准。
      rowsByKey.delete(key)
      rowsByKey.set(key, previewRow)
    })

    previewColumns.value = [
      { prop: '__key', label: headers[keyColumnIndex] || 'key' },
      ...validLanguageColumns.map(({ targetCode }) => ({ prop: targetCode, label: targetCode }))
    ]
    previewRows.value = [...rowsByKey.values()]
    selectedPreviewRows.value = []

    if (!previewRows.value.length) {
      ElMessage.warning('未读取到有效数据行')
      return
    }
    ElMessage.success(`已读取 ${previewRows.value.length} 行有效数据`)
  } catch (error: any) {
    ElMessage.error('读取表格异常: ' + error.message)
  } finally {
    isReadingSpreadsheet.value = false
  }
}

const handlePreviewSelectionChange = (rows: PreviewRow[]) => {
  selectedPreviewRows.value = rows
}

const isPreviewRowSelected = (row: PreviewRow) => selectedPreviewRowIds.value.has(row.__rowId)

const getSegmentTagType = (type: SegmentType) => {
  if (type === 'path') return 'primary'
  if (type === 'name') return 'success'
  return 'info'
}

const setSegmentType = (row: PreviewRow, index: number, type: Exclude<SegmentType, null>) => {
  row.__segmentTypes[index] = type
}

const getSegmentStatusText = (row: PreviewRow) => {
  if (!isPreviewRowSelected(row)) return '未勾选'
  if (row.__segmentTypes.includes(null)) return '待分类'
  return selectedSegmentValidationErrors.value.some(error => error.startsWith(row.__key)) ? '分类无效' : '已完成'
}

const buildSpreadsheetImportGroups = () => {
  const groups = new Map<string, Record<string, Record<string, string>>>()

  selectedPreviewRows.value.forEach(row => {
    const firstNameIndex = row.__segmentTypes.indexOf('name')
    const targetProperty = row.__segments.slice(0, firstNameIndex).join('.')
    const propertyName = row.__segments.slice(firstNameIndex).join('.')
    const translations: Record<string, string> = {}

    previewColumns.value.forEach(column => {
      if (column.prop === '__key') return
      const sourceLanguageCode = currentLangMap.value[column.prop]
      const translation = row[column.prop]
      if (sourceLanguageCode && !isBlank(translation)) {
        // 单个添加处理器按映射值（通用语言键）匹配语言文件；预览则仍显示项目语言键。
        translations[sourceLanguageCode] = toCellText(translation)
      }
    })

    if (!groups.has(targetProperty)) groups.set(targetProperty, {})
    groups.get(targetProperty)![propertyName] = translations
  })

  return groups
}

const handleSpreadsheetImport = async () => {
  if (!config.value.directoryPath) {
    ElMessage.warning('请先选择目标文件夹')
    return
  }
  if (!canImportSpreadsheet.value) {
    ElMessage.warning('请先完成所有已勾选 key 的有效分类')
    return
  }

  const groups = buildSpreadsheetImportGroups()
  if (!groups.size) {
    ElMessage.warning('没有可导入的数据')
    return
  }

  isImportingSpreadsheet.value = true
  const errors: string[] = []
  let importedGroups = 0

  try {
    for (const [targetProperty, objectsToAdd] of groups) {
      let res
      if (targetType.value === 'pc') {
        res = await window.electronAPI.batchAddLocalePc(
          config.value.directoryPath,
          config.value.excludePattern,
          targetProperty,
          JSON.stringify(objectsToAdd),
          targetType.value,
          true
        )
      } else if (targetType.value === 'admin') {
        res = await window.electronAPI.batchAddLocaleAdmin(
          config.value.directoryPath,
          targetProperty,
          JSON.stringify(objectsToAdd),
          targetType.value,
          true
        )
      } else {
        res = await window.electronAPI.batchAddLocale(
          config.value.directoryPath,
          config.value.excludePattern,
          targetProperty,
          JSON.stringify(objectsToAdd),
          targetType.value,
          true
        )
      }

      if (res.success) {
        importedGroups++
      } else {
        errors.push(`${targetProperty}: ${res.error || '导入失败'}`)
      }
    }

    if (errors.length) {
      ElMessage.error(`部分导入失败（成功 ${importedGroups} 组）：${errors.join('；')}`)
    } else {
      ElMessage.success(`导入完成：已处理 ${importedGroups} 个目标属性路径`)
    }
  } catch (error: any) {
    ElMessage.error('导入异常: ' + error.message)
  } finally {
    isImportingSpreadsheet.value = false
  }
}

onMounted(() => {
  loadLangMap('h5')
})
</script>

<template>
  <div class="p-5 mt-3 max-w-6xl mx-auto">
    <h2 class="text-xl font-bold mb-6 flex justify-between items-center">
      <span>批量新增多语言词条</span>
      <el-button size="small" @click="openLangDialog">管理语言映射</el-button>
    </h2>

    <el-form label-width="120px">
      <el-form-item label="新增哪个">
        <el-radio-group v-model="targetType">
          <el-radio label="h5">H5 端</el-radio>
          <el-radio label="pc">PC 端</el-radio>
          <el-radio label="admin">Admin 端</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="目标文件夹">
        <el-input v-model="config.directoryPath" placeholder="请选择包含多语言文件的文件夹">
          <template #append>
            <el-button @click="handleSelectDir">选择</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="添加方式">
        <el-radio-group v-model="addMode">
          <el-radio label="single">单个添加</el-radio>
          <el-radio label="spreadsheet">从表格中批量导入</el-radio>
        </el-radio-group>
      </el-form-item>

      <template v-if="addMode === 'single'">
        <el-form-item v-if="targetType !== 'admin'" label="排除关键字">
          <el-input v-model="config.excludePattern" placeholder="例如: uni-app" />
        </el-form-item>

        <el-form-item label="目标属性路径">
          <el-input
            v-model="config.targetProperty"
            :placeholder="targetType === 'admin' ? '例如: user.login（留空则直接在语言根目录查找）' : '例如: common 或 common.buttons'"
          />
        </el-form-item>

        <el-form-item label="快速填充">
          <el-input v-model="config.langText" placeholder="请输入">
            <template #append>
              <el-button @click="quickHandwriting">填充</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="新增对象 (JSON)">
          <el-input
            v-model="config.objectsToAdd"
            type="textarea"
            :rows="10"
            placeholder="正在加载语言映射..."
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="isProcessing" @click="handleAdd">开始添加</el-button>
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="表格文件">
          <div class="flex flex-col gap-2">
            <el-button type="primary" @click="handleSelectSpreadsheetFile">选择文件</el-button>
            <div class="flex items-center gap-1 text-xs text-gray-500">
              <span>没有文件？</span>
              <a
                href="./combined-locales-1786603308375.xlsx"
                download="combined-locales-1786603308375.xlsx"
                class="font-medium text-primary-600 hover:text-primary-500 hover:underline"
              >
                下载表格模板
              </a>
            </div>
          </div>
        </el-form-item>

        <template v-if="spreadsheetFilePath">
          <el-form-item label="选择工作表">
            <el-select v-model="selectedSheetName" placeholder="请选择工作表" class="w-full">
              <el-option
                v-for="sheet in spreadsheetSheets"
                :key="sheet.name"
                :label="sheet.name"
                :value="sheet.name"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="键列">
            <el-select v-model="selectedKeyColumnIndex" placeholder="请选择 key 值所在列" class="w-full">
              <el-option
                v-for="column in keyColumnOptions"
                :key="column.value"
                :label="column.label"
                :value="column.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="isReadingSpreadsheet" @click="handleReadSpreadsheet">开始读取数据</el-button>
          </el-form-item>
        </template>
      </template>
    </el-form>

    <div v-if="addMode === 'spreadsheet' && previewColumns.length" class="mt-6">
      <div class="mb-3 flex justify-between items-center">
        <h3 class="text-lg font-bold">数据预览</h3>
        <span class="text-sm text-gray-500">已选择 {{ selectedPreviewRows.length }} / {{ previewRows.length }} 行</span>
      </div>
      <el-table
        :data="previewRows"
        row-key="__rowId"
        border
        max-height="520"
        @selection-change="handlePreviewSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column
          v-for="column in previewColumns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          min-width="180"
          show-overflow-tooltip
        >
          <template v-if="column.prop === '__key'" #default="{ row }">
            <div class="flex flex-wrap gap-2 items-center py-1">
              <el-popover
                v-for="(segment, index) in row.__segments"
                :key="`${row.__rowId}-${index}`"
                trigger="click"
                width="190"
              >
                <template #reference>
                  <el-tag
                    :type="getSegmentTagType(row.__segmentTypes[index])"
                    effect="plain"
                    class="cursor-pointer"
                  >
                    {{ segment }}
                  </el-tag>
                </template>
                <div class="flex flex-col gap-2">
                  <span class="text-sm text-gray-600">选择“{{ segment }}”的用途</span>
                  <el-button size="small" type="primary" @click="setSegmentType(row, index, 'path')">目标属性路径</el-button>
                  <el-button size="small" type="success" @click="setSegmentType(row, index, 'name')">属性名</el-button>
                </div>
              </el-popover>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 rounded border border-gray-200 p-4">
        <div class="flex flex-wrap justify-between gap-3 items-center">
          <div>
            <p class="font-medium">已勾选 {{ selectedPreviewRows.length }} 行，已完成 {{ selectedPreviewRows.filter(row => !row.__segmentTypes.includes(null)).length }} 行分段选择</p>
            <p class="mt-1 text-sm text-gray-500">蓝色表示目标属性路径，绿色表示属性名；每个已勾选 key 必须先连续选择路径，再连续选择属性名。</p>
            <p v-if="selectedPreviewRows.length && selectedSegmentValidationErrors.length" class="mt-1 text-sm text-red-500">
              {{ selectedSegmentValidationErrors[0] }}
            </p>
            <p v-else-if="selectedPreviewRows.length" class="mt-1 text-sm text-green-600">{{ getSegmentStatusText(selectedPreviewRows[0]) === '已完成' ? '已通过分段校验，可以开始导入。' : '请完成已勾选行的分段选择。' }}</p>
          </div>
          <el-button
            v-if="canImportSpreadsheet"
            type="primary"
            :loading="isImportingSpreadsheet"
            @click="handleSpreadsheetImport"
          >
            开始导入
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showLangDialog" :title="`管理 ${targetType.toUpperCase()} 语言映射`">
      <el-input
        v-model="langMapStr"
        type="textarea"
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
