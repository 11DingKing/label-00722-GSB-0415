<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  Home, 
  Package, 
  Settings, 
  ChevronDown,
  Terminal,
  RefreshCw
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const collapsed = ref(false)
const expandedKeys = ref<string[]>(['developer', 'system'])

// 菜单配置
const menuItems = [
  {
    key: 'home',
    label: '首页',
    icon: 'Home',
    path: '/'
  },
  {
    key: 'developer',
    label: '开发者管理',
    icon: 'Terminal',
    children: [
      {
        key: 'release',
        label: '软件快速发布',
        icon: 'Package',
        path: '/release'
      }
    ]
  },
  {
    key: 'system',
    label: '系统管理',
    icon: 'Settings',
    children: [
      {
        key: 'update',
        label: '软件更新设置',
        icon: 'RefreshCw',
        path: '/update'
      }
    ]
  }
]

const iconComponents: Record<string, any> = {
  Home,
  Package,
  Settings,
  Terminal,
  RefreshCw
}

// 当前选中的菜单
const selectedKey = computed(() => {
  return route.name as string || 'home'
})

// 切换展开状态
function toggleExpand(key: string) {
  const index = expandedKeys.value.indexOf(key)
  if (index > -1) {
    expandedKeys.value.splice(index, 1)
  } else {
    expandedKeys.value.push(key)
  }
}

// 是否展开
function isExpanded(key: string) {
  return expandedKeys.value.includes(key)
}

// 导航
function navigateTo(path: string) {
  router.push(path)
}

// 获取应用版本
const appVersion = ref('v1.0.0')
</script>

<template>
  <div class="geek-layout">
    <!-- 顶部栏 -->
    <header class="geek-header">
      <div class="header-left">
        <div class="logo">
          <Terminal class="logo-icon" :size="24" />
          <span class="logo-text" v-if="!collapsed">HTML Release Updater</span>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge">{{ appVersion }}</span>
      </div>
    </header>

    <div class="geek-body">
      <!-- 侧边栏 -->
      <aside class="geek-sidebar" :class="{ collapsed }">
        <nav class="sidebar-nav">
          <template v-for="item in menuItems" :key="item.key">
            <!-- 有子菜单的项 -->
            <template v-if="item.children">
              <div 
                class="nav-group"
                :class="{ expanded: isExpanded(item.key) }"
              >
                <div 
                  class="nav-item parent"
                  @click="toggleExpand(item.key)"
                >
                  <component 
                    :is="iconComponents[item.icon!]" 
                    class="nav-icon" 
                    :size="18" 
                  />
                  <span class="nav-label" v-if="!collapsed">{{ item.label }}</span>
                  <ChevronDown 
                    v-if="!collapsed"
                    class="nav-arrow" 
                    :size="16"
                    :class="{ rotated: !isExpanded(item.key) }"
                  />
                </div>
                <div 
                  class="nav-children"
                  v-show="isExpanded(item.key) && !collapsed"
                >
                  <div
                    v-for="child in item.children"
                    :key="child.key"
                    class="nav-item child"
                    :class="{ active: selectedKey.toLowerCase() === child.key }"
                    @click="navigateTo(child.path!)"
                  >
                    <component 
                      :is="iconComponents[child.icon!]" 
                      class="nav-icon" 
                      :size="16" 
                    />
                    <span class="nav-label">{{ child.label }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- 无子菜单的项 -->
            <template v-else>
              <div
                class="nav-item"
                :class="{ active: selectedKey.toLowerCase() === item.key }"
                @click="navigateTo(item.path!)"
              >
                <component 
                  :is="iconComponents[item.icon!]" 
                  class="nav-icon" 
                  :size="18" 
                />
                <span class="nav-label" v-if="!collapsed">{{ item.label }}</span>
              </div>
            </template>
          </template>
        </nav>
      </aside>

      <!-- 主内容区 -->
      <main class="geek-content">
        <slot />
      </main>
    </div>

    <!-- 底部栏 -->
    <footer class="geek-footer">
      <span class="status-indicator">
        <span class="status-dot"></span>
        READY
      </span>
      <span class="copyright">© 2026 Geek System</span>
    </footer>
  </div>
</template>

<style scoped>
.geek-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-deep-black);
}

/* Header */
.geek-header {
  height: var(--header-height);
  background: var(--color-terminal-dark);
  border-bottom: 1px solid var(--color-border-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  -webkit-app-region: no-drag;
}

.logo-icon {
  color: var(--color-terminal-green);
}

.logo-text {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  -webkit-app-region: no-drag;
}

.version-badge {
  background: rgba(0, 255, 136, 0.1);
  color: var(--color-terminal-green);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-mono);
}

/* Body */
.geek-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.geek-sidebar {
  width: var(--sidebar-width);
  background: var(--color-deep-black);
  border-right: 1px solid var(--color-border-dark);
  transition: width var(--transition-normal);
  overflow: hidden;
}

.geek-sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-nav {
  padding: var(--spacing-md);
}

.nav-group {
  margin-bottom: var(--spacing-xs);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-secondary);
}

.nav-item:hover {
  background: var(--color-hover-gray);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: rgba(0, 255, 136, 0.1);
  color: var(--color-terminal-green);
  border-left: 2px solid var(--color-terminal-green);
}

.nav-item.parent {
  font-weight: 500;
}

.nav-item.child {
  padding-left: var(--spacing-xl);
  font-size: 13px;
}

.nav-icon {
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-arrow {
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.nav-arrow.rotated {
  transform: rotate(-90deg);
}

.nav-children {
  margin-top: var(--spacing-xs);
}

/* Content */
.geek-content {
  flex: 1;
  overflow: auto;
  padding: var(--spacing-lg);
  background: var(--color-deep-black);
}

/* Footer */
.geek-footer {
  height: var(--footer-height);
  background: var(--color-terminal-dark);
  border-top: 1px solid var(--color-border-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--color-terminal-green);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--color-terminal-green);
}
</style>
