<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import { ref } from 'vue'
import router from "@/router";

const activeIndex = ref('1')
const handleSelect = (key: string, keyPath: string[]) => {

  router.push({
    path: key
  })
}
</script>

<template>
  <el-menu
      :default-active="activeIndex"
      mode="horizontal"
      @select="handleSelect"
  >
    <el-menu-item index="/h5/polyglot">H5多语言工具</el-menu-item>
    <el-menu-item index="/pc/polyglot" disabled>PC多语言工具</el-menu-item>
    <el-menu-item index="/excel/excel-to-json">表格工具</el-menu-item>
    <el-menu-item index="/system/tableKey">表格键值管理</el-menu-item>
  </el-menu>

  <RouterView />

</template>

<style scoped>
nav a {
  text-decoration: none;
  color: #409eff;
}

nav a.router-link-active {
  font-weight: bold;
  color: #66b1ff;
}
</style>