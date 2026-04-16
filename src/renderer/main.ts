import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import { initializeDatabase } from './database'

// Load Electron API mock for web development
import './utils/electronMock'

// 样式
import 'ant-design-vue/dist/reset.css'
import './assets/styles/variables.css'
import './assets/styles/global.css'

// 等待数据库初始化完成后再挂载应用
async function initApp() {
  try {
    await initializeDatabase()
    const app = createApp(App)
    
    app.use(Antd)
    app.use(router)
    
    app.mount('#app')
  } catch (error) {
    console.error('应用初始化失败:', error)
    // 即使数据库初始化失败，也尝试挂载应用，避免完全白屏
    const app = createApp(App)
    
    app.use(Antd)
    app.use(router)
    
    app.mount('#app')
  }
}

initApp()
