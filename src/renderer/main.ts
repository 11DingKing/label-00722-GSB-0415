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

async function bootstrap() {
  const app = createApp(App)

  app.use(Antd)
  app.use(router)

  try {
    const result = await initializeDatabase()
    if (!result.success) {
      console.error('Database initialization failed:', result.error)
    }
  } catch (error) {
    console.error('Unexpected error during database initialization:', error)
  }

  app.mount('#app')
}

bootstrap()
