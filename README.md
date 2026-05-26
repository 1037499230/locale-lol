# 🌍 你就用吧老铁 (Locale LOL)

> **多语言处理神器 · 一用一个不吱声**

## 😎 项目简介

这是一个基于 **Vue 3 + Electron + Vite** 开发的桌面端多语言管理工具，专为国际化项目开发设计。支持 H5、PC、Admin 三种端的多语言文件处理，让你轻松完成合并、对比、新增和转换。

## ✨ 核心功能

| 功能模块 | H5 端 (JSON) | PC 端 (TS) | Admin 端 (TS 嵌套) | 说明 |
|----------|-------------|-----------|-------------------|------|
| **多语言工具** | ✅ | ✅ | ✅ | 提取/合并多语言文件，导出对照表或筛选缺失项 |
| **批量新增词条** | ✅ | ✅ | ✅ | 通过 JSON 模板批量添加多语言到所有语言文件 |
| **表格转JSON** | ✅ | ✅ | ✅ | 从 Excel 提取数据生成 JSON，并智能合并到项目文件 |
| **表格键值管理** | ✅ | ✅ | ✅ | 持久化管理表格列名映射配置 |

### 📋 功能详情

#### 1. H5/PC/Admin 多语言工具
- 选择源文件夹，自动识别语言文件
- 支持全选/多选操作
- 导出多语言对照表到 Excel
- 筛选缺失项，生成对比报告
- 支持第二对照文件（方便翻译参考）
- **Admin 端特殊处理**：先从嵌套 TS 结构提取生成 JSON，再复用 H5 逻辑进行对比导出

#### 2. 批量新增词条
- 通过 JSON 模板定义要添加的词条
- 支持嵌套属性路径（如 `account.withdrawal`）
- 自动识别文件语言，提取对应翻译
- **Admin 端适配**：支持按文件名定位（如 `common.submit.login`），自动匹配目标 TS 文件并合并

#### 3. 表格转 JSON / 智能合并
- 上传 Excel 文件，自动解析表头
- 选择键列和值列，提取数据
- **H5/PC 端**：支持合并到指定的 JSON 或 TS 文件
- **Admin 端**：支持选择语言文件夹，根据 Key 的路径结构（如 `module.sub.file.prop`）自动定位文件并写入

#### 4. 表格键值管理
- 自定义 Excel 导出时的列名映射
- 持久化配置，重启不丢失
- 支持多语言标题显示

## 🚀 快速开始

### 环境要求

- Node.js >= 20.19.0 或 >= 22.12.0
- npm >= 9.0.0

### 安装依赖

``` bash
npm install
```

### 开发模式

``` bash
npm run electron:dev
```

### 打包发布

``` bash
npm run electron:build
```

打包后的安装包位于 `release` 目录，支持自定义安装路径和桌面快捷方式。

## 📂 项目结构

```
├── electron/                       # Electron 主进程
│   ├── main.cjs                    # 主入口 + IPC 路由
│   ├── preload.cjs                 # 预加载脚本
│   ├── localeProcessor.cjs         # H5多语言处理逻辑
│   ├── pcLocaleProcessor.cjs       # pc多语言处理逻辑
│   ├── adminLocaleProcessor.cjs    # Admin多语言提取逻辑
│   └── addLocaleProcessor.cjs      # 批量新增词条逻辑
│
├── src/                            # Vue 渲染进程
│   ├── views/                      # 页面组件
│   │   ├── h5/                     # H5多语言工具
│   │   ├── pc/                     # PC多语言工具
│   │   ├── admin/                  # Admin多语言工具
│   │   ├── add/                    # 批量新增词条
│   │   ├── excel/                  # 表格转JSON
│   │   └── system/                 # 系统配置管理
│   ├── router/                     # 路由配置
│   ├── types/                      # TypeScript 类型定义
│   ├── App.vue                     # 根组件
│   └── main.ts                     # 入口文件
│       
├── public/                         # 静态资源
│   └── favicon.ico     
│       
├── build/                          # 打包资源
│   └── icon.ico        
│       
├── package.json                    # 项目配置
├── vite.config.ts                  # Vite 配置
├── tsconfig.json                   # TypeScript 配置
└── README.md                       # 项目说明
```

## 💾 持久化配置

应用数据存储在系统的 `userData` 目录下：

| 文件名 | 用途 |
|--------|------|
| `titleKeys.json` | 表格列名映射配置 |
| `langMap-h5.json` | H5 语言代码映射 |
| `langMap-pc.json` | PC 语言代码映射 |
| `langMap-admin.json` | Admin 语言代码映射 |

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

## 🔄 IPC 接口清单
| 接口名 | 参数 | 说明 |
|--------|------|------|
| `selectFolder` | - | 选择文件夹 |
| `getFolderFiles` | folderPath | 获取文件夹内文件列表 |
| `processLocales` | data, standardFile | 处理 H5 多语言合并 |
| `processPcLocales` | data, standardCode | 处理 PC 多语言合并 |
| `processMissingLocales` | data, zhCode, secondRefCode | 处理 H5 缺失项对比 |
| `processPcMissingLocales` | data, zhCode, secondRefCode | 处理 PC 缺失项对比 |
| `exportExcelToFolder` | data, folderPath | 导出 Excel 到指定目录 |
| `exportMissingExcel` | results, folderPath | 导出缺失项 Excel |
| `mergeLocaleFile` | tempData, type, filePath | 智能合并数据到目标文件/文件夹 |
| `batchAddLocale` | dirPath, excludePattern, targetProperty, objectsToAdd, type | 批量添加词条（H5） |
| `batchAddLocalePc` | dirPath, excludePattern, targetProperty, objectsToAdd, type | 批量添加词条（PC） |
| `batchAddLocaleAdmin` | localesPath, targetProperty, objectsToAdd, type | 批量添加词条（Admin） |
| `getAdminLocales` | localesPath | 获取 Admin 语言包列表 |
| `extractAdminLocales` | localesPath | 提取 Admin TS 结构生成 JSON |
| `saveTitleKeys` | data | 保存表格键值配置 |
| `getTitleKeys` | - | 获取表格键值配置 |
| `getLangMap` | type | 获取语言映射配置 |
| `saveLangMap` | data, type | 保存语言映射配置 |
## 🤝 贡献指南

欢迎提交 Issue 和 PR！

## 📄 License

MIT

---

**你就用吧老铁，一用一个不吱声！** 😎
