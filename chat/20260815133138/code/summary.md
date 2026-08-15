# 代码变更汇总

- `src/utils/api.js`：reader 释放 → 资源安全性提升
- `src/App.vue`：100vh → 100% → 移动端兼容
- `src/components/ChatArea.vue`：.input-bar position: relative
- `src/components/ConfigModal.vue`：.form-fields 增加滚动
- `src/components/ToolBar.vue`：resize 监听时机修正、死代码清除、onMounted 合并
- `src/components/MessageBubble.vue`：代码块语言标签、ESC 关闭灯箱、\\r\\n 归一
- `src/stores/sessionStore.js`：移除 updateLastMessage 死代码
