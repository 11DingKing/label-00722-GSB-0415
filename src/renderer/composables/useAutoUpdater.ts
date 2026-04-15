import { ref, onMounted, onUnmounted } from 'vue'
import { db } from '../database'
import type { UpdateSettings } from '../types'

const LAST_CHECK_KEY = 'lastUpdateCheck'
const NOTIFIED_VERSIONS_KEY = 'notifiedVersions'

export function useAutoUpdater() {
  const isChecking = ref(false)
  const lastCheckTime = ref<Date | null>(null)
  const settings = ref<UpdateSettings | null>(null)
  const detectedUpdate = ref<{ path: string; versionInfo: any } | null>(null)
  
  let checkInterval: ReturnType<typeof setInterval> | null = null

  // 加载设置
  async function loadSettings() {
    settings.value = await db.updateSettings.toCollection().first() || null
  }

  // 获取上次检测时间
  function getLastCheckTime(): Date | null {
    const stored = localStorage.getItem(LAST_CHECK_KEY)
    return stored ? new Date(stored) : null
  }

  // 保存检测时间
  function saveLastCheckTime() {
    const now = new Date()
    localStorage.setItem(LAST_CHECK_KEY, now.toISOString())
    lastCheckTime.value = now
  }

  // 获取已通知的版本列表
  function getNotifiedVersions(): string[] {
    const stored = localStorage.getItem(NOTIFIED_VERSIONS_KEY)
    return stored ? JSON.parse(stored) : []
  }

  // 添加到已通知列表
  function addNotifiedVersion(version: string) {
    const versions = getNotifiedVersions()
    if (!versions.includes(version)) {
      versions.push(version)
      localStorage.setItem(NOTIFIED_VERSIONS_KEY, JSON.stringify(versions))
    }
  }

  // 检查是否应该通知
  function shouldNotify(version: string): boolean {
    if (!settings.value?.notifyOnce) return true
    return !getNotifiedVersions().includes(version)
  }

  // 检查是否需要执行检测
  function shouldCheck(): boolean {
    if (!settings.value) return false
    if (settings.value.checkStrategy !== 'auto') return false
    if (settings.value.checkPaths.length === 0) return false

    const lastCheck = getLastCheckTime()
    if (!lastCheck) return true

    const hoursSinceLastCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60)
    return hoursSinceLastCheck >= settings.value.checkCycle
  }

  // 执行检测
  async function performCheck(): Promise<{ path: string; versionInfo: any } | null> {
    if (!settings.value || !window.electronAPI) return null
    
    isChecking.value = true
    
    try {
      const enabledPaths = settings.value.checkPaths
        .filter(p => p.enabled)
        .map(p => p.path)
      
      if (enabledPaths.length === 0) return null

      const results = await window.electronAPI.updater.checkPaths(enabledPaths)
      
      if (results.length === 0) return null

      // 找到最新版本
      let latestVersion = results[0]
      for (const result of results.slice(1)) {
        const compare = await window.electronAPI.updater.compareVersions(
          latestVersion.versionInfo.versionCode,
          result.versionInfo.versionCode
        )
        if (compare > 0) {
          latestVersion = result
        }
      }

      // 与当前版本对比
      const currentVersion = await window.electronAPI.app.getVersion()
      const compare = await window.electronAPI.updater.compareVersions(
        currentVersion,
        latestVersion.versionInfo.versionCode
      )

      saveLastCheckTime()

      if (compare > 0) {
        detectedUpdate.value = latestVersion
        return latestVersion
      }

      return null
    } catch (error) {
      console.error('Auto update check failed:', error)
      return null
    } finally {
      isChecking.value = false
    }
  }

  // 启动自动检测
  async function startAutoCheck() {
    await loadSettings()
    lastCheckTime.value = getLastCheckTime()

    // 启动时检测
    if (shouldCheck()) {
      const update = await performCheck()
      if (update && shouldNotify(update.versionInfo.versionCode)) {
        // 返回检测到的更新，由组件处理通知
      }
    }

    // 设置定时检测（每小时检查一次是否需要执行）
    checkInterval = setInterval(async () => {
      if (shouldCheck()) {
        const update = await performCheck()
        if (update && shouldNotify(update.versionInfo.versionCode)) {
          // 触发更新通知
        }
      }
    }, 60 * 60 * 1000) // 每小时检查
  }

  // 停止自动检测
  function stopAutoCheck() {
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
  }

  // 标记版本已通知
  function markNotified(version: string) {
    addNotifiedVersion(version)
  }

  // 手动触发检测
  async function manualCheck() {
    await loadSettings()
    return performCheck()
  }

  // 重新加载设置
  async function reloadSettings() {
    await loadSettings()
    // 如果切换到自动模式，重新启动调度器
    if (settings.value?.checkStrategy === 'auto') {
      stopAutoCheck()
      startAutoCheck()
    }
  }

  onMounted(() => {
    startAutoCheck()
  })

  onUnmounted(() => {
    stopAutoCheck()
  })

  return {
    isChecking,
    lastCheckTime,
    detectedUpdate,
    settings,
    performCheck,
    manualCheck,
    markNotified,
    reloadSettings,
    shouldNotify
  }
}
