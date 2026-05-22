# 🌍 你就用吧老铁 (Locale LOL)

> **多语言处理神器 · 一用一个不吱声**

## 😎 项目简介

这是一个基于 **Vue 3 + Electron + Vite** 开发的桌面端多语言管理工具，专为国际化项目开发设计。无论是 H5 还是 PC 端，都能让你轻松处理多语言文件的合并、对比、新增和转换。

## ✨ 核心功能

| 功能模块 | 说明 |
|----------|------|
| **H5多语言工具** | 合并标准文件与 uni-app 文件，导出对照表或筛选缺失项 |
| **批量新增词条** | 通过 JSON 模板批量添加多语言到所有语言文件，支持 H5/PC 切换 |
| **表格转JSON** | 从 Excel 提取指定列数据生成 JSON，并直接合并到项目文件 |
| **表格键值管理** | 持久化管理表格列名映射配置，方便后续使用 |

## 🚀 快速开始

### 环境要求

- Node.js >= 20.19.0 或 >= 22.12.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run electron:dev
```

### 打包发布

```bash
npm run electron:build
```

打包后的安装包位于 `release` 目录，支持自定义安装路径和桌面快捷方式。

## 📂 项目结构

```
├── electron/                  # Electron 主进程
│   ├── main.cjs               # 主入口 + IPC 路由
│   ├── preload.cjs            # 预加载脚本
│   ├── localeProcessor.cjs    # H5多语言处理逻辑
│   └── addLocaleProcessor.cjs # 批量新增词条逻辑
│
├── src/                       # Vue 渲染进程
│   ├── views/                 # 页面组件
│   │   ├── h5/                # H5多语言工具
│   │   ├── add/               # 批量新增词条
│   │   ├── excel/             # 表格转JSON
│   │   └── system/            # 系统配置管理
│   ├── router/                # 路由配置
│   ├── types/                 # TypeScript 类型定义
│   ├── App.vue                # 根组件
│   └── main.ts                # 入口文件
│
├── public/                    # 静态资源
│   └── favicon.ico
│
├── build/                     # 打包资源
│   └── icon.ico
│
├── package.json               # 项目配置
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
└── README.md                  # 项目说明
```

## 💾 持久化配置

应用数据存储在系统的 `userData` 目录下：

| 文件名 | 用途 |
|--------|------|
| `titleKeys.json` | 表格列名映射配置 |
| `langMap-h5.json` | H5 语言代码映射 |
| `langMap-pc.json` | PC 语言代码映射 |

## 🛠️ 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **桌面框架**: Electron 42
- **UI 组件**: Element Plus
- **样式方案**: UnoCSS
- **打包工具**: electron-builder

## 📝 开发规范

- 主进程文件使用 `.cjs` 扩展名（CommonJS）
- 渲染进程使用 ES Module
- IPC 通信统一使用 JSON 字符串传输
- 代码注释使用块注释，禁止行尾注释

## 🤝 贡献指南

欢迎提交 Issue 和 PR！

## 📄 License

MIT

---

**你就用吧老铁，一用一个不吱声！** 😎
