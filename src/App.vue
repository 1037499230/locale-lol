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
  <div class="app-header bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 shadow-lg">
    <h1 class="text-2xl font-bold mb-2">🌍 你就用吧老铁 (Locale LOL)</h1>
    <p class="text-sm opacity-90">多语言处理神器 · 一用一个不吱声</p>
  </div>

  <el-menu
      :default-active="activeIndex"
      mode="horizontal"
      @select="handleSelect"
      class="border-b"
  >
    <el-menu-item index="/h5/polyglot">H5多语言工具</el-menu-item>
    <el-menu-item index="/pc/polyglot">PC多语言工具</el-menu-item>
    <el-menu-item index="/add/addLocale">添加多语言项</el-menu-item>
    <el-menu-item index="/excel/excel-to-json">表格工具</el-menu-item>
    <el-menu-item index="/system/tableKey">表格键值管理</el-menu-item>
  </el-menu>

  <RouterView />

</template>

<style scoped>
.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>