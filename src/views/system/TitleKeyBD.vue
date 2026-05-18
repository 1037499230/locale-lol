<script setup lang="ts">
import {onMounted, ref} from "vue";
import {ElMessage} from "element-plus";

const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const textarea = ref('')

onMounted(async () => {
  // 从 Electron 主进程获取持久化配置
  const res = await window.electronAPI?.getTitleKeys() || {}
  if (!res.success || !res.data) {
    ElMessage.error('获取配置失败')
    return
  }
  const data = res.data
  tableData.value = Object.keys(data).map(item => {
    return {
      label: item,
      value: data[item]
    }
  })
})

function handleAdd() {
  tableData.value.push({label: '', value: ''})
}

async function handleSubmit() {
  try {
    const dataObj = Object.fromEntries(tableData.value.map(({ label, value }) => [label, value]))
    // 调用 Electron API 保存到文件
    const res = await window.electronAPI?.saveTitleKeys(JSON.stringify(dataObj))
    if (res.success) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error('保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

function handleImport() {
  try {
    const data = JSON.parse(textarea.value)
    tableData.value = Object.keys(data).map(item => {
      return {
        label: item,
        value: data[item]
      }
    })
    ElMessage.success('导入成功')
  } catch (e) {
    ElMessage.error('导入失败')
  }
}

function handleClear() {
  tableData.value = []
}


</script>

<template>
  <div>
    <div class="mt-3">
      <el-button @click="handleAdd">新增</el-button>
      <el-button @click="dialogVisible = true" type="warning">导入</el-button>
      <el-button @click="handleSubmit" type="primary">保存</el-button>
      <el-button @click="handleClear" type="danger">清空</el-button>
    </div>
    <el-descriptions border column="1" class="mt-3">
      <el-descriptions-item label="Username" v-for="(item, index) in tableData" :key="index" >
        <template #label>
          <span>key: </span>
          <el-input v-model="item.label" style="width: 200px"></el-input>
        </template>
        <template #default>
          <span>value: </span>
          <el-input v-model="item.value" style="width: 200px"></el-input>
          <el-button class="ml-2" @click="tableData.splice(index, 1)" type="danger">删除</el-button>
        </template>
      </el-descriptions-item>
    </el-descriptions>

    <el-dialog title="导入" v-model="dialogVisible">
      <el-input type="textarea" v-model="textarea"/>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>