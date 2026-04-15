import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'

// Load Electron API mock for web development
import './utils/electronMock'

// 样式
import 'ant-design-vue/dist/reset.css'
import './assets/styles/variables.css'
import './assets/styles/global.css'

const app = createApp(App)

app.use(Antd)
app.use(router)

app.mount('#app')
