# Orvex

Orvex 是一个基于 `Tauri 2 + React + TypeScript + Vite` 构建的 Windows 桌面快速启动器项目。  
它提供了一个可定制的启动面板，用于集中管理常用应用、文件夹、工作区和网址，并内置待办小窗、拾色器、系统托盘与全局快捷键等能力。

## 项目特性

- 自定义启动面板
  - 支持按分类组织应用、文件夹、工作区和 URL
  - 支持拖拽导入本地可执行文件、快捷方式和目录
  - 支持按名称、使用次数或自定义顺序排序
- 丰富的右键与交互能力
  - 支持以管理员方式运行应用
  - 支持打开文件所在位置
  - 支持分类重命名、删除、启动项移除等操作
- 外观可配置
  - 支持浅色 / 深色主题
  - 支持纯色背景或图片背景
  - 支持毛玻璃、背景透明度、内容区透明度、图标背景等样式调节
  - 支持分类文字、应用文字、图标块背景、图标外壳等细节定制
- 辅助工具窗口
  - 待办清单窗口
  - 拾色器窗口
- 桌面集成
  - 系统托盘
  - 全局快捷键
  - 开机自启
  - 多窗口管理（主面板 / 设置 / 待办 / 拾色器）
- 数据持久化
  - 启动项和设置会保存到应用数据目录
  - 支持备份与恢复

## 技术栈

- 前端
  - `React 18`
  - `TypeScript`
  - `Vite 5`
  - `Tailwind CSS`
- 桌面端
  - `Tauri 2`
  - `Rust`
- 主要依赖
  - `@tauri-apps/api`
  - `@tauri-apps/plugin-dialog`
  - `tauri-plugin-global-shortcut`
  - `tauri-plugin-log`

## 目录结构

```text
Orvex/
├─ src/                     前端源码
│  ├─ components/           通用组件
│  ├─ hooks/                React Hooks
│  ├─ panel/                启动面板
│  ├─ settings/             设置窗口
│  ├─ tools/                待办 / 拾色器等工具窗口
│  ├─ lib/                  Tauri 调用封装
│  └─ types/                类型定义
├─ src-tauri/               Tauri / Rust 端源码
│  ├─ src/                  Rust 业务逻辑
│  ├─ icons/                应用图标资源
│  └─ tauri.conf.json       Tauri 配置
├─ public/                  静态资源
└─ README.md
```

## 开发环境要求

- Windows
- Node.js 18 或更高版本
- npm
- Rust 工具链
- Tauri 依赖环境

如果本机还没有安装 Rust，可先安装：

```powershell
winget install Rustlang.Rustup
```

安装完成后建议确认：

```powershell
rustup --version
cargo --version
node --version
npm --version
```

## 安装依赖

在项目根目录执行：

```powershell
npm install
```

## 开发运行

启动前端开发服务：

```powershell
npm run dev
```

启动 Tauri 桌面开发模式：

```powershell
npm run tauri:dev
```

## 构建

构建前端资源：

```powershell
npm run build
```

构建 Tauri 桌面应用：

```powershell
npm run tauri:build
```

如果只需要生成可运行的 `exe`，不需要安装包，可使用：

```powershell
npm run tauri:build -- --no-bundle
```

生成的可执行文件通常位于：

```text
src-tauri/target/release/orvex.exe
```

## 图标相关

桌面应用图标资源位于：

```text
src-tauri/icons/
```

Tauri 配置中实际引用的图标定义位于：

```text
src-tauri/tauri.conf.json
```

如果要重新生成图标资源，可使用：

```powershell
npx tauri icon "C:\path\to\icon.png" -o src-tauri/icons
```

前端浏览器标签页图标位于：

```text
public/favicon.svg
```

## 数据存储说明

应用会将启动项、配置、背景图缓存、图标缓存和备份文件保存到系统应用数据目录。  
相关逻辑位于 `src-tauri/src/storage.rs`。

## 常见问题

### 1. `tauri build` 在 Windows 上打包 MSI 失败

如果日志中提示下载 `WiX` 失败，通常是网络原因，不影响 `release exe` 的生成。  
这时可以直接使用：

```text
src-tauri/target/release/orvex.exe
```

或者执行：

```powershell
npm run tauri:build -- --no-bundle
```

### 2. 更换图标后没有立即生效

常见原因有两个：

- 旧的应用进程还在运行，导致新图标未重新编入 `exe`
- Windows 图标缓存没有刷新

建议先退出旧进程，再重新构建并启动新版本。

### 3. 托盘图标或文件图标仍显示旧图

这通常是 Windows 图标缓存问题，不一定代表 `exe` 内嵌图标未更新。  
可尝试重启资源管理器或更换输出文件名验证。

## 适合提交前执行的命令

```powershell
npm run build
```

如果需要同时确认 Rust 侧构建：

```powershell
cd src-tauri
cargo build
```

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。
