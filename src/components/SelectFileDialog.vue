<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 对话框提交事件的数据接口
 */
export interface Interface {
  /** 标准文件路径 */
  standardFile: string
  /** 保存结果的路径 */
  saveResult: string
  /** 对照文件路径 */
  controlFile: string
  /** 选择类型（locales 或 missing） */
  selectType: string
}

const {
  showDialog,
  handleProcessLocales,
  handleSelectSaveFolder,
  openDialog,
  selectType,
  standardFile,
  controlFile,
  saveResult,
  selectedLocales,
} = useDialog()

/**
 * 使用对话框管理逻辑的组合式函数
 * 管理对话框的显示状态、文件选择和提交流程
 * @returns {Object} 对话框相关的状态和方法
 */
function useDialog(): any {
  // 控制对话框显示/隐藏的状态
  const showDialog = ref<boolean>(false)
  // 当前操作类型（locales：多语言导出，missing：缺失项对比）
  const selectType = ref<string>('')
  // 选定的基准文件路径
  const standardFile = ref<string>('')
  // 选定的对照文件路径
  const controlFile = ref<string>('')
  const saveResult = ref<string>('')
  const selectedLocales = ref<Array<any>>([])

  /**
   * 打开对话框并初始化相关数据
   * @param {Array<any>} locales - 语言配置数组
   * @param {string} type - 操作类型（'locales' 或 'missing'）
   */
  const openDialog = async (locales: Array<any>, type: string) => {
    standardFile.value = ''
    controlFile.value = ''
    showDialog.value = true
    selectedLocales.value = locales
    selectType.value = type

    if (!saveResult.value) {
      const res = await window.electronAPI?.getDesktopPath()
      if (res?.success && res.path) {
        saveResult.value = res.path
      }
    }
  }

  /**
   * 处理多语言文件转换并提交到父组件
   * 触发 on-submit 事件，传递选定的文件路径和操作类型
   */
  const handleProcessLocales = async () => {
    emits('on-submit', { standardFile: standardFile.value, controlFile: controlFile.value, saveResult: saveResult.value, selectType: selectType.value })
  }

  /**
   * 选择保存结果的文件夹
   * 调用 Electron API 打开文件夹选择对话框，更新保存路径
   */
  const handleSelectSaveFolder = async () => {
    const res = await window.electronAPI?.selectSaveFolder()
    if (!res?.success || !res.path) {
      ElMessage.info('已取消保存')
      return
    }

    saveResult.value = res.path
  }

  return {
    showDialog,
    standardFile,
    controlFile,
    saveResult,
    selectedLocales,
    selectType,
    handleProcessLocales,
    handleSelectSaveFolder,
    openDialog
  }
}


/**
 * 定义组件事件，用于向父组件提交表单数据
 */
const emits = defineEmits(['on-submit'])

/**
 * 暴露 openDialog 方法给父组件调用
 */
defineExpose({ openDialog })

</script>

<template>
  <el-dialog title="请选择基准文件" v-model="showDialog">
    <el-select v-model="standardFile" placeholder="请选择基准文件">
      <el-option
          v-for="item in selectedLocales"
          :key="item.code"
          :label="item.code"
          :value="item.code"
      />
    </el-select>
    <el-select class="mt-2" v-model="controlFile" placeholder="请选择对照文件(非必选)" v-if="selectType === 'missing'">
      <el-option
          v-for="item in selectedLocales"
          :key="item.code"
          :label="item.code"
          :value="item.code"
      />
    </el-select>
    <el-input class="mt-2"
              v-model="saveResult"
              style="max-width: 600px"
              placeholder="请填写输出路径"
    >
      <template #append>
        <el-button @click="handleSelectSaveFolder">选择</el-button>
      </template>
    </el-input>
    <div class="mt-5 flex justify-end">
      <el-button @click="handleProcessLocales">转换并生成表格</el-button>
    </div>
  </el-dialog>
</template>

<style scoped>

</style>