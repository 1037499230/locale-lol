<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'

/** 同步方向 */
const direction = ref('pc-to-h5')
/** 源端文件夹路径 */
const sourceDir = ref('')
/** 目标端文件夹路径 */
const targetDir = ref('')
/** 源端 key 路径 */
const sourceKey = ref('')
/** 目标端 key 路径 */
const targetKey = ref('')
/** 选中的语言列表（H5 编码） */
const selectedLangs = ref<string[]>([])
/** H5→PC 语言编码映射表 */
const syncLangMap = ref<Record<string, string>>({})
/** 映射编辑弹窗 */
const showMapDialog = ref(false)
/** 映射编辑文本 */
const mapEditStr = ref('{}')
/** 同步结果 */
const syncResults = ref<Array<{
  lang: string
  success: boolean
  sourceValue?: string
  isOverwrite?: boolean
  sourceFile?: string
  targetFile?: string
  error?: string
}>>([])
/** 是否正在同步 */
const isSyncing = ref(false)

/** 源端标签（根据方向动态切换） */
const sourceLabel = computed(() => direction.value === 'pc-to-h5' ? 'PC端文件夹' : 'H5端文件夹')
/** 目标端标签（根据方向动态切换） */
const targetLabel = computed(() => direction.value === 'pc-to-h5' ? 'H5端文件夹' : 'PC端文件夹')

/** 语言选项列表，用于渲染 checkbox */
const langOptions = computed(() => {
  return Object.entries(syncLangMap.value).map(([h5Code, pcCode]) => ({
    h5Code,
    pcCode,
    /** 两端编码相同时只显示一个，不同时显示映射关系 */
    label: h5Code === pcCode ? h5Code : `${h5Code} ↔ ${pcCode}`,
    value: h5Code
  }))
})

/** 加载同步映射表 */
const loadSyncLangMap = async () => {
  const res = await window.electronAPI?.getSyncLangMap()
  if (res?.success && res.data) {
    syncLangMap.value = res.data
  }
}

/** 全选/取消全选 */
const handleSelectAll = () => {
  if (selectedLangs.value.length === langOptions.value.length) {
    selectedLangs.value = []
  } else {
    selectedLangs.value = langOptions.value.map(o => o.value)
  }
}

/** 选择源端文件夹 */
const handleSelectSourceDir = async () => {
  const p = await window.electronAPI?.selectFolder()
  if (p) sourceDir.value = p
}

/** 选择目标端文件夹 */
const handleSelectTargetDir = async () => {
  const p = await window.electronAPI?.selectFolder()
  if (p) targetDir.value = p
}

/** 打开映射管理弹窗 */
const openMapDialog = () => {
  mapEditStr.value = JSON.stringify(syncLangMap.value, null, 2)
  showMapDialog.value = true
}

/** 保存映射表 */
const handleSaveMap = async () => {
  try {
    const data = JSON.parse(mapEditStr.value)
    const res = await window.electronAPI?.saveSyncLangMap(JSON.stringify(data, null, 2))
    if (res?.success) {
      ElMessage.success('映射已更新')
      syncLangMap.value = data
      // 移除已不存在的语言选中项
      selectedLangs.value = selectedLangs.value.filter(lang => lang in data)
      showMapDialog.value = false
    } else {
      ElMessage.error(res?.error || '保存失败')
    }
  } catch (e: any) {
    ElMessage.error('JSON 格式错误: ' + e.message)
  }
}

/** 执行同步 */
const handleSync = async () => {
  if (!sourceDir.value) {
    ElMessage.warning('请选择源端文件夹')
    return
  }
  if (!targetDir.value) {
    ElMessage.warning('请选择目标端文件夹')
    return
  }
  if (!sourceKey.value.trim()) {
    ElMessage.warning('请输入源端 Key')
    return
  }
  if (!targetKey.value.trim()) {
    ElMessage.warning('请输入目标端 Key')
    return
  }
  if (selectedLangs.value.length === 0) {
    ElMessage.warning('请至少选择一种语言')
    return
  }

  isSyncing.value = true
  syncResults.value = []

  try {
    // Vue 3 的 Proxy 对象无法通过 Electron IPC 结构化克隆，必须转为普通对象
    const params = JSON.parse(JSON.stringify({
      sourceDir: sourceDir.value,
      targetDir: targetDir.value,
      sourceKey: sourceKey.value.trim(),
      targetKey: targetKey.value.trim(),
      selectedLangs: selectedLangs.value,
      direction: direction.value
    }))
    const res = await window.electronAPI?.syncLocaleKey(params)

    if (res?.success) {
      syncResults.value = res.results
      const successCount = res.results.filter((r: any) => r.success).length
      const failCount = res.results.filter((r: any) => !r.success).length
      if (failCount === 0) {
        ElMessage.success(`同步完成！全部 ${successCount} 种语言同步成功`)
      } else {
        ElMessage.warning(`同步完成！成功 ${successCount} 个，失败 ${failCount} 个`)
      }
    } else {
      ElMessage.error(res?.error || '同步失败')
    }
  } catch (error: any) {
    ElMessage.error('同步异常: ' + error.message)
  } finally {
    isSyncing.value = false
  }
}

/** 根据当前方向和已保存的项目路径，自动填入源端/目标端 */
const autoFillDirs = (paths: { h5: string; pc: string; admin: string }) => {
  if (direction.value === 'pc-to-h5') {
    if (!sourceDir.value && paths.pc) sourceDir.value = paths.pc
    if (!targetDir.value && paths.h5) targetDir.value = paths.h5
  } else {
    if (!sourceDir.value && paths.h5) sourceDir.value = paths.h5
    if (!targetDir.value && paths.pc) targetDir.value = paths.pc
  }
}

/** 切换同步方向时，自动交换源端/目标端路径 */
watch(direction, () => {
  const temp = sourceDir.value
  sourceDir.value = targetDir.value
  targetDir.value = temp
})

onMounted(async () => {
  await loadSyncLangMap()
  const res = await window.electronAPI?.getProjectPaths()
  if (res?.success && res.data) {
    autoFillDirs(res.data)
  }
})
</script>

<template>
  <div class="p-5 mt-3 max-w-5xl mx-auto">
    <h2 class="text-xl font-bold mb-6">PC ↔ H5 多语言同步</h2>

    <el-form label-width="120px">
      <!-- 同步方向 -->
      <el-form-item label="同步方向">
        <el-radio-group v-model="direction">
          <el-radio label="pc-to-h5">PC → H5</el-radio>
          <el-radio label="h5-to-pc">H5 → PC</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 源端文件夹 -->
      <el-form-item :label="sourceLabel">
        <el-input v-model="sourceDir" :placeholder="`请选择${sourceLabel}（多语言文件所在目录）`">
          <template #append>
            <el-button @click="handleSelectSourceDir">选择</el-button>
          </template>
        </el-input>
      </el-form-item>

      <!-- 目标端文件夹 -->
      <el-form-item :label="targetLabel">
        <el-input v-model="targetDir" :placeholder="`请选择${targetLabel}（多语言文件所在目录）`">
          <template #append>
            <el-button @click="handleSelectTargetDir">选择</el-button>
          </template>
        </el-input>
      </el-form-item>

      <!-- 源端 Key -->
      <el-form-item label="源端 Key">
        <el-input
          v-model="sourceKey"
          placeholder="从哪读？例如: common.submit"
          clearable
        />
      </el-form-item>

      <!-- 目标端 Key -->
      <el-form-item label="目标端 Key">
        <el-input
          v-model="targetKey"
          placeholder="写到哪？例如: common.submitBtn（可与源端不同）"
          clearable
        />
      </el-form-item>

      <!-- 语言选择 -->
      <el-form-item label="同步语言">
        <div class="flex items-center mb-2">
          <el-button size="small" @click="handleSelectAll">
            {{ selectedLangs.length === langOptions.length ? '取消全选' : '全选' }}
          </el-button>
          <span class="ml-3 text-gray-500 text-sm">
            已选 {{ selectedLangs.length }} / {{ langOptions.length }} 种语言
          </span>
        </div>
        <el-checkbox-group v-model="selectedLangs">
          <el-checkbox
            v-for="opt in langOptions"
            :key="opt.value"
            :label="opt.value"
          >
            {{ opt.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <!-- 操作按钮 -->
      <el-form-item>
        <el-button @click="openMapDialog">管理语言映射</el-button>
        <el-button type="primary" @click="handleSync" :loading="isSyncing">
          执行同步
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 同步结果 -->
    <div v-if="syncResults.length > 0" class="mt-5">
      <h3 class="text-lg font-bold mb-3">同步结果</h3>
      <el-table :data="syncResults" border style="width: 100%">
        <el-table-column prop="lang" label="语言" width="150">
          <template #default="{ row }">
            {{ row.lang === syncLangMap[row.lang] ? row.lang : `${row.lang} ↔ ${syncLangMap[row.lang] || row.lang}` }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <span v-if="row.success">{{ row.isOverwrite ? '🔄' : '✅' }}</span>
            <span v-else>❌</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <span v-if="row.success" class="text-xs text-gray-500">
              {{ row.isOverwrite ? '覆盖' : '新增' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="同步值" min-width="200">
          <template #default="{ row }">
            <span v-if="row.success" class="text-sm">
              {{ row.sourceValue && row.sourceValue.length > 60 ? row.sourceValue.substring(0, 60) + '...' : row.sourceValue }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="源文件" width="120">
          <template #default="{ row }">
            <span v-if="row.success" class="text-xs text-gray-500">{{ row.sourceFile }}</span>
          </template>
        </el-table-column>
        <el-table-column label="目标文件" width="120">
          <template #default="{ row }">
            <span v-if="row.success" class="text-xs text-gray-500">{{ row.targetFile }}</span>
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="200">
          <template #default="{ row }">
            <span v-if="!row.success" class="text-red-500 text-sm">{{ row.error }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 映射管理弹窗 -->
    <el-dialog v-model="showMapDialog" title="管理 PC ↔ H5 语言映射" width="650px">
      <p class="text-sm text-gray-500 mb-3">
        格式: <code>{ "H5编码": "PC编码" }</code>，两端编码相同时直接写一样的值即可。
      </p>
      <p class="text-sm text-gray-400 mb-3">
        例如: <code>{ "es-col": "col-es", "zh-Hans": "zh", "en": "en" }</code>
      </p>
      <el-input
        type="textarea"
        v-model="mapEditStr"
        :rows="18"
        placeholder="请输入 JSON 格式的语言映射"
      />
      <template #footer>
        <el-button @click="showMapDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveMap">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
</style>
