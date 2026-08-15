 # 代码汇总
 
 本批次修复代码审查报告中的 12 项问题。
 
 ## api.js
 - 删除 `sendStreamingRequest` 中引用未定义 `combinedController`/`timeout` 的 per-read 超时逻辑
 - 恢复为简单的 `reader.read()` 循环，由外层 `sendChatMessage` 的统一 `timeout` 控制
 - 修正 `sendChatMessage` 内部变量缩进
 - 移除 `onConnected` 参数（不再需要连接阶段单独清除超时）
 
 ## ChatArea.vue
 - 移除未使用的 `const savedText = text` 死代码
 - fallback 请求前检查 `abortController` 是否为 null，防止空指针
 - 给 `.input-bar` 的 `position: relative` 加注释
 
 ## ConfigModal.vue
 - 将 `const pendingDelete = ref(false)` 移到所有 import 之后
 - `.modal-container` 添加 `min-width: 320px`
 
 ## TabBar.vue
 - `@media (pointer: coarse)` 中增大 `.tab-close` 的 padding 为 `6px 10px`
 
 ## sessionStore.js
 - 初始化时从 storage 读取 `active-session-id` 恢复上次活跃会话
 - `createSession` 写入 `active-session-id`
 - `deleteSession` 在切换活跃会话时同步写入 `active-session-id`
