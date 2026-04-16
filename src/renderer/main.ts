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
  console.log('[App] Starting application...')
  
  const dbResult = await initializeDatabase()
  if (!dbResult.success) {
    console.error('[App] Database initialization failed:', dbResult.error)
  } else if (dbResult.error) {
    console.warn('[App] Database initialized with warning:', dbResult.error)
  }
  
  const app = createApp(App)

  app.use(Antd)
  app.use(router)

  app.mount('#app')
}

bootstrap().catch((error) => {
  console.error('[App] Bootstrap failed:', error)
})
