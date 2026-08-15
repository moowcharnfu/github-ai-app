# 代码变更汇总
- `src/utils/api.js`：请求边界稳定性增强，避免空解析配置和空响应崩溃。
- `src/components/ChatArea.vue`：输入状态机与错误分支更稳健，减少用户输入丢失和异常提示不一致。
- `src/components/ConfigModal.vue`：拆弹与响应式布局优化，减小小视窗操作摩擦。
- `src/components/ToolBar.vue`：下拉行为与空间占用优化，降低小屏被遮挡概率。
