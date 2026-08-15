 # 代码变更汇总

 ## 变更文件列表（11 个文件）

 1. src/style.css - 增加 Firefox 滚动条兼容样式
 2. src/stores/sessionStore.js - 修复 ID 碰撞、localStorage 配额溢出
 3. src/stores/configProfileStore.js - 修复 ID 碰撞
 4. src/stores/configStore.js - useConfig 改为单例模式
 5. src/utils/api.js - 增加请求超时控制
 6. src/components/TabBar.vue - 修复 border 抖动、触屏兼容
 7. src/components/ConfigModal.vue - 响应式 currentId、删除确认、模态尺寸适配
 8. src/components/MessageBubble.vue - 流式代码块渲染
 9. src/components/ChatArea.vue - 流式中断处理、toast 提示、rAF 优化、卸载清理
 10. package.json - 移除可疑依赖
 11. src-tauri/capabilities/default.json - 收紧 fs/http 权限

 ## 构建验证

 npx vite build 构建成功，0 错误，0 警告。
