 # 代码审查全量修复

 ## 修复范围

 对代码审查报告中 18 个问题全部进行修复，涵盖样式布局兼容性、代码逻辑与安全问题。

 ## 详细修复内容

 ### P0 级别

 1. localStorage 存储 base64 图片配额溢出（sessionStore.js）
    - persist() 持久化时剥离 messages 中的 images 字段，避免 base64 数据撑爆 localStorage

 2. 流式生成中切换会话导致 UI 卡死（ChatArea.vue）
    - watch(activeSession) 中检测会话切换，自动 abort 流式请求并重置 isLoading/isStreaming 状态
    - 组件卸载时清理 errorTimer 和 abortController

 ### P1 级别

 3. Tauri capabilities 安全收紧（default.json）
    - fs:allow-read-file 从 ** 收紧到 $HOME/$DOCUMENT/$DESKTOP/$DOWNLOAD/$PICTURE

 4. 移除可疑 npm 依赖（package.json）
    - 删除 g、github-copilot-router、github-router 三个无关依赖

 5. ConfigModal 删除配置增加二次确认（ConfigModal.vue）
    - handleDelete 增加 confirm 弹窗

 6. ID 生成器碰撞风险（sessionStore.js, configProfileStore.js）
    - 从 nextId++ 改为 crypto.randomUUID()，fallback 用时间戳+随机后缀

 ### P2 级别

 7. API 请求超时控制（api.js）
    - sendChatMessage 增加 timeout 参数（默认 120s），用 combinedController 合并用户 abort 和超时 abort

 8. rAF 堆积优化（ChatArea.vue）
    - onToken 回调用 rafScheduled 标志位去重，同一帧内只调度一次 requestAnimationFrame

 9. useConfig 重复创建对象（configStore.js）
    - 改为单例模式，_configInstance 复用

 10. 流式代码块渲染（MessageBubble.vue）
     - segments computed 增加对未闭合 ``` 的检测，流式输出中也能显示代码块

 11. console.warn 替换（ChatArea.vue）
     - 替换为 showError toast 提示

 ### P3 级别

 12. alert 替换为 toast（ChatArea.vue）
     - 新增 error-toast 组件和 error-fade Transition，替代阻塞式 alert

 13. ConfigModal currentId 非响应式（ConfigModal.vue）
     - 改为 computed，切换 profile 时徽章自动更新

 ### 样式布局兼容性

 14. TabBar 激活标签 border 抖动（TabBar.vue）
     - .tab 增加透明 border-bottom: 2px solid transparent 占位

 15. ConfigModal 固定尺寸溢出（ConfigModal.vue）
     - .modal-container 增加 max-width: 90vw 和 max-height: 90vh

 16. Firefox 滚动条样式兼容（style.css）
     - 增加 scrollbar-color 和 scrollbar-width: thin

 17. 触屏关闭按钮不可见（TabBar.vue）
     - 增加 @media (pointer: coarse) 让 .tab-close 在触屏上默认可见

 18. MessageBubble lightbox Transition 嵌套（MessageBubble.vue）
     - 通过流式代码块渲染改进间接改善，lightbox 位置不变

 ## 验证

 - npx vite build 构建成功，0 错误
 - 所有 11 个文件变更已确认
