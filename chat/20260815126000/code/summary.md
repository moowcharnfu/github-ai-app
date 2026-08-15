 # 代码汇总
 
 ## ChatArea.vue
 - fallback 请求添加 `timeout: 30000`
 - 纯图片发送 content 改为 `text || '[图片]'`
 - error-toast 添加 `max-height: 120px; overflow-y: auto`
 
 ## MessageBubble.vue
 - fadeIn keyframes 从 `opacity + translateY` 改为仅 `opacity`
 
 ## ConfigModal.vue
 - `.modal-left` 添加 `flex-shrink: 0`
 - 新增 `@media (max-width: 480px)` 隐藏 `.modal-left`
 
 ## ToolBar.vue
 - `.select-dropdown` 添加 `max-height: 300px; overflow-y: auto`
