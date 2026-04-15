<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Package, RefreshCw, FileCode, Database } from 'lucide-vue-next'

const router = useRouter()

const appVersion = ref('v1.0.0')

onMounted(async () => {
  if (window.electronAPI) {
    appVersion.value = await window.electronAPI.app.getVersion()
  }
})

const features = [
  {
    icon: Package,
    title: '软件快速发布',
    description: '一键打包源码文件夹，生成可分发的软件包',
    path: '/release',
    color: 'green'
  },
  {
    icon: RefreshCw,
    title: '软件更新设置',
    description: '配置更新检测路径，自动检测并升级新版本',
    path: '/update',
    color: 'cyan'
  }
]

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="home-page">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="ascii-art">
        <pre class="ascii-text">
░█░█░▀█▀░█▄█░█░░░░░█▀▄░█▀▀░█░░░█▀▀░█▀█░█▀▀░█▀▀
░█▀█░░█░░█░█░█░░░░░█▀▄░█▀▀░█░░░█▀▀░█▀█░▀▀█░█▀▀
░▀░▀░░▀░░▀░▀░▀▀▀░░░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀
        </pre>
      </div>
      <p class="welcome-subtitle">
        纯本地桌面版 HTML 交互系统 - 软件发布与更新模块
      </p>
      <div class="version-info">
        <span class="version-label">当前版本:</span>
        <span class="version-value">{{ appVersion }}</span>
      </div>
    </div>

    <!-- 功能卡片 -->
    <div class="features-grid">
      <div 
        v-for="feature in features" 
        :key="feature.path"
        class="feature-card"
        :class="feature.color"
        @click="navigateTo(feature.path)"
      >
        <div class="feature-icon">
          <component :is="feature.icon" :size="32" />
        </div>
        <div class="feature-content">
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-desc">{{ feature.description }}</p>
        </div>
        <div class="feature-arrow">→</div>
      </div>
    </div>

    <!-- 系统信息 -->
    <div class="system-info">
      <div class="info-card">
        <FileCode :size="20" />
        <div class="info-text">
          <span class="info-label">技术栈</span>
          <span class="info-value">Electron + Vue 3 + TypeScript</span>
        </div>
      </div>
      <div class="info-card">
        <Database :size="20" />
        <div class="info-text">
          <span class="info-label">本地存储</span>
          <span class="info-value">IndexedDB (Dexie.js)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--spacing-xl) 0;
}

/* Welcome Section */
.welcome-section {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.ascii-art {
  margin-bottom: var(--spacing-lg);
}

.ascii-text {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.2;
  color: var(--color-terminal-green);
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.welcome-subtitle {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-bottom: var(--spacing-md);
}

.version-info {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--color-terminal-dark);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-dark);
}

.version-label {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.version-value {
  color: var(--color-terminal-green);
  font-family: var(--font-mono);
  font-weight: 600;
}

/* Features Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.feature-card {
  background: var(--color-terminal-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-terminal-green);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
}

.feature-card.green {
  border-top: 2px solid var(--color-terminal-green);
}

.feature-card.green .feature-icon {
  color: var(--color-terminal-green);
}

.feature-card.cyan {
  border-top: 2px solid var(--color-cyber-cyan);
}

.feature-card.cyan .feature-icon {
  color: var(--color-cyber-cyan);
}

.feature-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-panel-gray);
  border-radius: var(--radius-md);
}

.feature-content {
  flex: 1;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.feature-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.feature-arrow {
  color: var(--color-text-placeholder);
  font-size: 20px;
  transition: transform var(--transition-fast);
}

.feature-card:hover .feature-arrow {
  transform: translateX(4px);
  color: var(--color-terminal-green);
}

/* System Info */
.system-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
}

.info-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  background: var(--color-panel-gray);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.info-card svg {
  color: var(--color-cyber-cyan);
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 12px;
  color: var(--color-text-primary);
}
</style>
