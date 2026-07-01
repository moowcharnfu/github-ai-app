# GitHub AI Chat

基于 GitHub AI Inference API 的桌面聊天客户端，基于 Tauri v2 构建，支持多 Profile 配置管理和 SSE 流式响应。

## 功能

- **桌面原生应用** — 基于 Tauri v2 构建的真实桌面窗口，支持 macOS / Windows / Linux 三平台
- **浏览器风格界面** — 标题栏 + Tab 栏 + 工具栏布局，类浏览器体验，不依赖浏览器运行
- **多配置 Profile** — 管理多组 API 配置（地址、密钥、模型），下拉即时切换
- **Tab 会话管理** — 通过顶部 Tab 栏新建、切换、关闭会话
- **流式对话** — SSE 逐 token 输出，打字机效果，支持中断
- **自动降级** — 流式请求失败时自动 fallback 到非流式模式
- **代码渲染** — 消息中代码块自动格式化显示
- **自定义下拉菜单** — 工具栏 Profile 切换替换为自定义暗色风格下拉组件，当前配置带勾选标记
- **密钥可见切换** — 配置弹窗中 API 密钥支持点击眼睛图标切换显示/隐藏
- **一键复制** — 配置弹窗所有输入框支持点击复制内容到剪贴板，带「已复制」反馈
- **响应耗时** — AI 回复气泡右下角显示响应耗时（秒）
- **图片对话** — 支持选择本地图片（PNG/JPG）以 base64 编码发送给视觉模型，无需公网地址
- **Sensenova API 兼容** — 自动检测 Sensenova API，图片消息使用原生 `{image, prompt, model}` 格式传输

## 快速开始

```bash
# 安装依赖
npm install

# 启动桌面应用开发模式（Tauri 原生窗口）
npm run tauri:dev

# Web 开发模式（浏览器访问 http://localhost:3008）
npm run dev

# 生产构建
npm run tauri:build    # 构建桌面安装包（当前平台）
```

## 使用

1. 点击工具栏齿轮图标打开配置管理弹窗，填入 API 地址、密钥（Bearer Token）和模型名
2. 支持创建多个命名 Profile，通过工具栏下拉快速切换
3. 点击 Tab 栏「+」新建会话
4. 在输入框输入消息，按 Enter 或点击「发送」开始对话
5. 流式响应实时显示，可点击「⏹」停止生成
6. 鼠标悬停 AI 回复右下角查看响应耗时
7. 配置弹窗中可点击眼睛图标查看 API 密钥，点击复制按钮复制任意输入框内容
8. 点击输入框左侧图片按钮选择本地图片（PNG/JPG），支持向视觉模型发送图片进行识别

## 跨平台构建

在对应平台运行 `npm run tauri:build` 即可生成该平台的原生安装包：

| 平台 | 构建产物 |
|------|---------|
| macOS | `.dmg` / `.app` |
| Windows | `.msi`（需在 Windows 上构建） |
| Linux | `.AppImage` / `.deb`（需在 Linux 上构建） |

构建产物位于 `src-tauri/target/release/bundle/` 目录下。

## 默认配置

| 配置项 | 默认值 |
|--------|--------|
| API 地址 | `https://models.github.ai/inference/chat/completions` |
| 模型 | `openai/gpt-4o` |

## 技术栈

- [Vue 3](https://vuejs.org/) — UI 框架
- [Vite](https://vitejs.dev/) — 构建工具
- [Tauri v2](https://v2.tauri.app/) — 桌面应用框架（Rust 后端）
- Fetch API ReadableStream — SSE 流式请求
