# HTML Release Updater

> 纯本地桌面版 HTML 交互系统 - 软件发布与更新模块

[![Electron](https://img.shields.io/badge/Electron-28.x-47848F?logo=electron)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

```
░█░█░▀█▀░█▄█░█░░░░░█▀▄░█▀▀░█░░░█▀▀░█▀█░█▀▀░█▀▀
░█▀█░░█░░█░█░█░░░░░█▀▄░█▀▀░█░░░█▀▀░█▀█░▀▀█░█▀▀
░▀░▀░░▀░░▀░▀░▀▀▀░░░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀
```

## 功能特性

### 🚀 软件快速发布
- 一键打包源码文件夹
- 支持 ZIP 压缩包 / 文件夹两种格式
- 自动生成版本信息文件 (version.json)
- 文件类型白名单配置
- 打包配置模板保存/加载
- MD5 完整性校验

### 🔄 软件更新设置
- 本地/网盘路径检测
- 手动/自动检测策略
- 语义化版本对比
- 一键更新 + 自动备份
- IndexedDB 数据迁移
- 更新失败自动回滚
- 备份管理与版本回滚

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 28 + Vue 3 |
| 语言 | TypeScript 5 |
| UI | Ant Design Vue 4 + Tailwind CSS |
| 存储 | IndexedDB (Dexie.js) |
| 打包 | archiver + semver |
| 构建 | Vite + electron-builder |

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建应用
npm run build
```

### Docker 运行（推荐用于交付验证）

```bash
# 构建并启动容器（一键启动，无需本地安装 Node/Electron）
docker compose up --build
```

启动成功后，终端日志会显式输出 **Startup Success!** 及访问地址：

- **noVNC Web 界面**: http://localhost:6080/vnc.html  
- **VNC 密码**: `geek2026`  
- VNC 原始端口: 5900（可选）

后台运行可使用 `docker compose up -d --build`。

## 项目结构

```
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── index.ts           # 主进程入口
│   │   ├── preload.ts         # 预加载脚本
│   │   └── ipc/               # IPC 处理器
│   │       ├── dialog.ts      # 文件对话框
│   │       ├── packager.ts    # 打包引擎
│   │       └── updater.ts     # 更新引擎
│   └── renderer/              # Vue 渲染进程
│       ├── components/        # 组件
│       ├── composables/       # 组合式函数
│       ├── database/          # IndexedDB
│       ├── views/             # 页面
│       └── assets/            # 静态资源
├── docker/                    # Docker 配置
├── docs/                      # 项目文档
└── docker-compose.yml
```

## 使用指南

### 软件发布

1. 进入「开发者管理 > 软件快速发布」
2. 选择源码文件夹路径
3. 配置打包参数（版本号、输出路径、格式）
4. 点击「一键打包」
5. 打包完成后可打开输出路径查看

### 软件更新

1. 进入「系统管理 > 软件更新设置」
2. 添加检测路径（本地/网盘同步路径）
3. 配置检测策略（手动/自动）
4. 点击「检查更新」
5. 检测到新版本后点击「立即更新」
6. 更新完成后重启软件

## 设计风格

采用 **Geek Terminal Style** 设计：
- 深色主题 + 霓虹配色
- 等宽字体 + 终端风格
- 发光效果 + 渐变边框

## 文档

- [需求规格说明书](docs/Requirements.md)
- [设计规范](docs/DesignSpec.md)
- [开发路线图](docs/Roadmap.md)

## 许可证

MIT License

---

> 🖥️ **Geek System** | Built with Electron + Vue 3
