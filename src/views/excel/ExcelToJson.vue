<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

type TargetType = 'h5' | 'pc' | 'admin'
type MergeMode = 'existing' | 'create'

interface LocaleTarget {
  /** 用于合并的原始文件/文件夹名称。 */
  name: string
  /** 去除文件后缀后的项目语言键。 */
  code: string
  /** 通过语言映射和表格键值管理转换后的显示名称。 */
  displayName: string
  path: string
}

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
const targetType = ref<TargetType>('h5')
const targetFolderPath = ref('')
const targetFilePath = ref('')
const mergeMode = ref<MergeMode>('existing')
const newLocaleCode = ref('')
const templateLocalePath = ref('')
const localeTargets = ref<LocaleTarget[]>([])
const isLoadingLocaleTargets = ref(false)
let localeTargetScanId = 0

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

/** 读取目标文件夹第一层可合并的多语言项。 */
const loadLocaleTargets = async (folderPath: string) => {
  const scanId = ++localeTargetScanId
  targetFolderPath.value = folderPath
  targetFilePath.value = ''
  templateLocalePath.value = ''
  localeTargets.value = []

  if (!folderPath) return

  isLoadingLocaleTargets.value = true
  try {
    const [folderRes, titleKeysRes, langMapRes] = await Promise.all([
      window.electronAPI?.getFolderFiles(folderPath),
      window.electronAPI?.getTitleKeys(),
      window.electronAPI?.getLangMap(targetType.value)
    ])
    if (scanId !== localeTargetScanId) return

    if (!folderRes?.success) {
      ElMessage.error(folderRes?.error || '读取目标文件夹失败')
      return
    }

    // 语言映射：项目内语言键 -> 通用语言代码；表格键值管理：通用语言代码 -> 中文名称。
    // 只有同时完成“当前应用语言映射”和“中文名称映射”的项才可作为合并目标。
    const titleKeys = titleKeysRes?.success ? titleKeysRes.data || {} : {}
    const langMap = langMapRes?.success ? langMapRes.data || {} : {}
    const extension = targetType.value === 'h5' ? '.json' : '.ts'
    const getLocaleCode = (name: string) => targetType.value === 'admin'
      ? name
      : name.slice(0, -extension.length)

    localeTargets.value = (folderRes.files || [])
      .filter(item => {
        if (targetType.value === 'admin') return item.isDirectory
        if (item.isDirectory || !item.name.toLowerCase().endsWith(extension)) return false
        // uni-app.xxx.json 会随所选的 xxx.json 自动写入，因此不作为可选择的目标显示。
        return targetType.value !== 'h5' || !item.name.toLowerCase().startsWith('uni-app.')
      })
      .map(item => {
        const code = getLocaleCode(item.name)
        const commonCode = langMap[code] || langMap[item.name]
        const displayName = commonCode ? titleKeys[commonCode] || titleKeys[code] : ''
        return { name: item.name, code, commonCode, displayName, path: item.path }
      })
      .filter(target => Boolean(target.commonCode && target.displayName))
      .map(({ name, code, displayName, path }) => ({ name, code, displayName, path }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'))

    if (localeTargets.value.length === 0) {
      ElMessage.warning('未找到可合并的多语言')
    }
  } catch (error) {
    if (scanId === localeTargetScanId) {
      ElMessage.error('读取目标文件夹失败')
    }
  } finally {
    if (scanId === localeTargetScanId) {
      isLoadingLocaleTargets.value = false
    }
  }
}

/** 按当前应用类型读取环境配置中的默认多语言文件夹。 */
const loadConfiguredLocaleFolder = async () => {
  const res = await window.electronAPI?.getProjectPaths()
  const folderPath = res?.success ? res.data?.[targetType.value] || '' : ''

  if (!folderPath) {
    localeTargetScanId += 1
    targetFolderPath.value = ''
    targetFilePath.value = ''
    templateLocalePath.value = ''
    localeTargets.value = []
    isLoadingLocaleTargets.value = false
    ElMessage.warning('当前应用类型尚未配置默认多语言文件夹，请手动选择')
    return
  }

  await loadLocaleTargets(folderPath)
}

/** 手动重新选择目标文件夹。 */
const handleSelectTargetFolder = async () => {
  const folderPath = await window.electronAPI?.selectFolder()
  if (folderPath) {
    await loadLocaleTargets(folderPath)
  }
}

watch(targetType, () => {
  if (showMergeDialog.value) {
    void loadConfiguredLocaleFolder()
  }
})

watch(showMergeDialog, (visible) => {
  if (visible) {
    targetFilePath.value = ''
    templateLocalePath.value = ''
    newLocaleCode.value = ''
    mergeMode.value = 'existing'
    void loadConfiguredLocaleFolder()
  }
})

watch(mergeMode, () => {
  targetFilePath.value = ''
  templateLocalePath.value = ''
})

/**
 * 执行合并操作
 */
const handleMerge = async () => {
  const localeCode = newLocaleCode.value.trim()
  const isCreateMode = mergeMode.value === 'create'

  if (!targetFolderPath.value) {
    ElMessage.warning('请先选择目标文件夹')
    return
  }

  if (!isCreateMode && !targetFilePath.value) {
    ElMessage.warning('请先选择一个目标多语言')
    return
  }

  if (isCreateMode) {
    if (!localeCode) {
      ElMessage.warning('请输入目标语言编号')
      return
    }
    if (!/^[a-z0-9_-]+$/.test(localeCode)) {
      ElMessage.warning('语言编号仅支持小写英文字母、数字、- 和 _')
      return
    }
    if (!templateLocalePath.value) {
      ElMessage.warning('请先选择模板语言')
      return
    }
  }

  try {
    ElMessage.info(isCreateMode ? '正在新建并合并...' : '正在合并...')
    const res = isCreateMode
      ? await window.electronAPI?.createLocaleFromTemplate(
        JSON.stringify(jsonData.value),
        targetType.value,
        targetFolderPath.value,
        localeCode,
        templateLocalePath.value
      )
      : await window.electronAPI?.mergeLocaleFile(
        JSON.stringify(jsonData.value),
        targetType.value,
        targetFilePath.value
      )

    if (res?.success) {
      ElMessage.success(isCreateMode ? '新建并合并成功！' : '合并成功！')
      if (res.warning) {
        ElMessage.error(res.warning)
      }
      showMergeDialog.value = false
      targetFolderPath.value = ''
      targetFilePath.value = ''
      templateLocalePath.value = ''
      newLocaleCode.value = ''
      localeTargets.value = []
    } else {
      ElMessage.error(res?.error || (isCreateMode ? '新建并合并失败' : '合并失败'))
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

    <el-dialog v-model="showMergeDialog" title="合并到多语言文件" width="600px">
      <el-form label-width="100px">
        <el-form-item label="应用类型">
          <el-select v-model="targetType" placeholder="请选择">
            <el-option label="H5 端" value="h5" />
            <el-option label="PC 端" value="pc" />
            <el-option label="Admin 端" value="admin" />
          </el-select>
        </el-form-item>

        <el-form-item label="目标文件夹">
          <el-input v-model="targetFolderPath" readonly placeholder="请先在环境配置中设置默认多语言文件夹，或手动选择">
            <template #append>
              <el-button @click="handleSelectTargetFolder">选择文件夹</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="合并模式" class="merge-mode-form-item">
          <el-radio-group v-model="mergeMode" class="merge-mode-group">
            <el-radio value="existing" border class="merge-mode-card">
              <span class="merge-mode-card__content">
                <span class="merge-mode-card__title">合并到已有多语言文件</span>
                <span class="merge-mode-card__subtitle">选择一个已配置的语言，直接写入表格内容</span>
              </span>
            </el-radio>
            <el-radio value="create" border class="merge-mode-card">
              <span class="merge-mode-card__content">
                <span class="merge-mode-card__title">新建多语言{{ targetType === 'admin' ? '文件夹' : '文件' }}</span>
                <span class="merge-mode-card__subtitle">从模板复制后，再合并表格内容</span>
              </span>
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="mergeMode === 'existing'">
          <el-form-item label="目标多语言" class="locale-target-form-item">
            <div v-if="targetFolderPath || isLoadingLocaleTargets" class="locale-target-panel w-full">
              <div class="locale-target-panel__header">
                <div>
                  <p class="locale-target-panel__title">选择合并目标</p>
                  <p class="locale-target-panel__subtitle">仅可选择一个{{ targetType === 'admin' ? '语言文件夹' : '语言文件' }}</p>
                </div>
                <span v-if="!isLoadingLocaleTargets" class="locale-target-panel__count">{{ localeTargets.length }} 个可用</span>
              </div>
              <el-skeleton v-if="isLoadingLocaleTargets" :rows="2" animated class="locale-target-panel__loading" />
              <el-radio-group v-else-if="localeTargets.length" v-model="targetFilePath" class="locale-target-list">
                <el-radio v-for="target in localeTargets" :key="target.path" :value="target.path" border class="locale-target-card">
                  <span class="locale-target-card__content">
                    <span class="locale-target-card__type">{{ targetType === 'admin' ? '目录' : (targetType === 'pc' ? 'TS' : 'JSON') }}</span>
                    <span class="locale-target-card__text">
                      <span class="locale-target-card__name" :title="target.displayName">{{ target.displayName }}</span>
                      <span v-if="target.displayName !== target.code" class="locale-target-card__code">{{ target.code }}</span>
                    </span>
                  </span>
                </el-radio>
              </el-radio-group>
              <div v-else class="locale-target-empty">
                <span class="locale-target-empty__icon">—</span>
                <span>该文件夹第一层未找到可合并的多语言</span>
              </div>
            </div>
            <div v-else class="locale-target-hint">请选择目标文件夹后，再选择一个目标多语言。</div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="目标语言编号">
            <div class="new-locale-code-field">
              <el-input v-model="newLocaleCode" maxlength="64" clearable placeholder="例如：fr、pt-br、zh_hans" />
              <p>仅支持小写英文字母、数字、- 和 _；不能与目标文件夹内已有语言重名。</p>
            </div>
          </el-form-item>
          <el-form-item label="模板语言" class="template-locale-form-item">
            <el-select v-model="templateLocalePath" class="w-full" :loading="isLoadingLocaleTargets" placeholder="请选择要复制的模板语言" :disabled="!targetFolderPath">
              <el-option
                v-for="target in localeTargets"
                :key="target.path"
                :label="target.displayName === target.code ? target.displayName : target.displayName + '（' + target.code + '）'"
                :value="target.path"
              >
                <span class="template-locale-option__name">{{ target.displayName }}</span>
                <span v-if="target.displayName !== target.code" class="template-locale-option__code">{{ target.code }}</span>
              </el-option>
            </el-select>
            <div v-if="targetFolderPath && !isLoadingLocaleTargets && !localeTargets.length" class="template-locale-empty">当前文件夹未找到可作为模板的已映射语言。</div>
            <div v-else-if="!targetFolderPath" class="template-locale-empty">请先选择目标文件夹，再选择模板语言。</div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showMergeDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleMerge"
          :disabled="isLoadingLocaleTargets || (mergeMode === 'existing' ? !targetFilePath : !targetFolderPath || !newLocaleCode.trim() || !templateLocalePath)"
        >开始合并</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<style scoped>
.locale-target-form-item :deep(.el-form-item__content) {
  min-width: 0;
}


.merge-mode-form-item :deep(.el-form-item__content),
.template-locale-form-item :deep(.el-form-item__content) {
  min-width: 0;
}

.merge-mode-group {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.merge-mode-card.el-radio.is-bordered {
  display: flex;
  width: 100%;
  min-height: 88px;
  height: auto;
  min-width: 0;
  margin: 0;
  padding: 10px 13px;
  border-color: #e1e7f1;
  border-radius: 12px;
  background: #fff;
  transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease;
}

.merge-mode-card.el-radio.is-bordered:hover {
  border-color: #a8c1f5;
  box-shadow: 0 5px 14px rgb(55 106 190 / 10%);
}

.merge-mode-card.el-radio.is-bordered.is-checked {
  border-color: #5b8def;
  background: linear-gradient(135deg, #f5f8ff, #eef4ff);
  box-shadow: 0 5px 16px rgb(63 117 209 / 15%);
}

.merge-mode-card :deep(.el-radio__label) {
  flex: 1;
  min-width: 0;
  padding-left: 9px;
  white-space: normal;
}

.merge-mode-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.merge-mode-card__title {
  color: #34415a;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}

.merge-mode-card__subtitle {
  color: #8a95a8;
  font-size: 11px;
  line-height: 1.45;
}

.new-locale-code-field { width: 100%; }

.new-locale-code-field p,
.template-locale-empty {
  margin: 6px 0 0;
  color: #8a95a8;
  font-size: 12px;
  line-height: 1.5;
}

.template-locale-option__name { color: #34415a; }

.template-locale-option__code {
  float: right;
  color: #98a2b3;
  font-size: 12px;
}

.locale-target-panel {
  overflow: hidden;
  border: 1px solid #e4eaf5;
  border-radius: 14px;
  background: linear-gradient(145deg, #fbfcff 0%, #f5f8ff 100%);
  box-shadow: 0 8px 24px rgb(55 93 155 / 6%);
}

.locale-target-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 15px 12px;
  border-bottom: 1px solid #e9eef7;
}

.locale-target-panel__title {
  margin: 0;
  color: #26344e;
  font-size: 14px;
  font-weight: 650;
}

.locale-target-panel__subtitle {
  margin: 3px 0 0;
  color: #8a95a8;
  font-size: 12px;
}

.locale-target-panel__count {
  flex: none;
  padding: 4px 9px;
  border-radius: 999px;
  color: #4f6fb2;
  background: #eaf1ff;
  font-size: 12px;
  font-weight: 600;
}

.locale-target-panel__loading {
  padding: 16px;
}

.locale-target-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 252px;
  overflow: auto;
  padding: 14px;
}

.locale-target-card.el-radio.is-bordered {
  display: flex;
  width: 100%;
  height: 62px;
  min-width: 0;
  margin: 0;
  padding: 0 12px;
  border-color: #e1e7f1;
  border-radius: 10px;
  background: #fff;
  transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.locale-target-card.el-radio.is-bordered:hover {
  border-color: #a8c1f5;
  box-shadow: 0 5px 14px rgb(55 106 190 / 10%);
  transform: translateY(-1px);
}

.locale-target-card.el-radio.is-bordered.is-checked {
  border-color: #5b8def;
  background: linear-gradient(135deg, #f5f8ff, #eef4ff);
  box-shadow: 0 5px 16px rgb(63 117 209 / 15%);
}

.locale-target-card :deep(.el-radio__input) {
  flex: none;
}

.locale-target-card :deep(.el-radio__label) {
  flex: 1;
  min-width: 0;
  padding-left: 9px;
}

.locale-target-card__content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.locale-target-card__type {
  flex: none;
  min-width: 38px;
  padding: 3px 5px;
  border-radius: 5px;
  color: #5d78b7;
  background: #eef3ff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}

.locale-target-card.is-checked .locale-target-card__type {
  color: #fff;
  background: #5b8def;
}

.locale-target-card__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.locale-target-card__name {
  overflow: hidden;
  color: #34415a;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-target-card__code {
  overflow: hidden;
  margin-top: 2px;
  color: #98a2b3;
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-target-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 132px;
  gap: 8px;
  color: #98a2b3;
  font-size: 13px;
}

.locale-target-empty__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  color: #a8b3c4;
  background: #edf1f6;
  font-size: 20px;
}

.locale-target-hint {
  width: 100%;
  padding: 12px 14px;
  border: 1px dashed #d8e0ed;
  border-radius: 10px;
  color: #98a2b3;
  background: #fafbfd;
  font-size: 13px;
}

@media (max-width: 640px) {
  .locale-target-list,
  .merge-mode-group {
    grid-template-columns: 1fr;
  }
}
</style>
