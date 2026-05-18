<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <nav style="padding: 20px; background: #f5f5f5;">
    <RouterLink to="/h5/polyglot" class="mr-1">H5多语言工具</RouterLink>
    <RouterLink to="/pc/polyglot">PC多语言工具</RouterLink>
    <RouterLink to="/system/tableKey">表格键值管理</RouterLink>
  </nav>

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
