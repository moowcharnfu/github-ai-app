<template>
  <div class="app-layout">
    <TitleBar />
    <TabBar />
    <ToolBar @openConfig="showConfig = true" />
    <main class="main-content">
      <ChatArea />
    </main>
    <ConfigModal :visible="showConfig" @close="showConfig = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TitleBar from './components/TitleBar.vue'
import TabBar from './components/TabBar.vue'
import ToolBar from './components/ToolBar.vue'
import ConfigModal from './components/ConfigModal.vue'
import ChatArea from './components/ChatArea.vue'

const showConfig = ref(false)
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
