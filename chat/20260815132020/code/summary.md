# 代码变更汇总

- `src/utils/api.js`：增加有效性检查和更稳健的错误传播，提升请求边界稳定性。
- `src/components/ChatArea.vue`：完善输入框状态机和用户提示，降低错误路径下的可用性问题。
- `src/components/ConfigModal.vue`：改进表单弹窗响应式布局，减少小视窗操作风险。
- `src/components/ToolBar.vue`：改进下拉展开和空间占用，减小小屏幕被挤压的概率。
