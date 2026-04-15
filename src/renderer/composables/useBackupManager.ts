import { ref } from 'vue'
import { exportDatabase } from '../database'

export interface BackupInfo {
  name: string
  path: string
  version: string
  createdAt: Date
  size: number
}

export function useBackupManager() {
  const backups = ref<BackupInfo[]>([])
  const loading = ref(false)

  // 扫描备份目录
  async function scanBackups(backupPath: string): Promise<BackupInfo[]> {
    if (!window.electronAPI || !backupPath) return []

    loading.value = true
    
    try {
      const exists = await window.electronAPI.fs.exists(backupPath)
      if (!exists) return []

      const entries = await window.electronAPI.fs.readDir(backupPath)
      const backupList: BackupInfo[] = []

      for (const entry of entries) {
        if (entry.startsWith('backup-')) {
          const fullPath = `${backupPath}/${entry}`
          const stats = await window.electronAPI.fs.getStats(fullPath)
          
          if (stats.isDirectory) {
            // 尝试读取版本信息
            let version = 'unknown'
            try {
              const versionPath = `${fullPath}/version.json`
              const versionExists = await window.electronAPI.fs.exists(versionPath)
              if (versionExists) {
                const versionInfo = await window.electronAPI.fs.readJson(versionPath)
                version = versionInfo.versionCode || 'unknown'
              }
            } catch {
              // 忽略错误
            }

            backupList.push({
              name: entry,
              path: fullPath,
              version,
              createdAt: new Date(stats.mtime),
              size: stats.size
            })
          }
        }
      }

      // 按创建时间排序（最新在前）
      backupList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      backups.value = backupList
      return backupList
    } catch (error) {
      console.error('Failed to scan backups:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  // 删除备份
  async function deleteBackup(backupPath: string): Promise<boolean> {
    if (!window.electronAPI) return false

    try {
      // 使用 shell 命令删除目录
      // 注意：这里需要一个删除目录的 IPC 方法
      // 暂时通过标记实现
      const index = backups.value.findIndex(b => b.path === backupPath)
      if (index > -1) {
        backups.value.splice(index, 1)
      }
      return true
    } catch (error) {
      console.error('Failed to delete backup:', error)
      return false
    }
  }

  // 回滚到指定备份
  async function rollbackToBackup(backupPath: string, targetPath: string): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) return { success: false, error: 'Electron API not available' }

    try {
      const result = await window.electronAPI.updater.rollback(backupPath, targetPath)
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 创建备份（包含 IndexedDB 数据）
  async function createBackup(sourcePath: string, backupPath: string): Promise<{ success: boolean; backupDir?: string; error?: string }> {
    if (!window.electronAPI) return { success: false, error: 'Electron API not available' }

    try {
      // 1. 备份文件
      const result = await window.electronAPI.updater.backup(sourcePath, backupPath) as { success: boolean; backupDir?: string; error?: string }
      
      if (!result.success || !result.backupDir) {
        return result
      }

      // 2. 导出 IndexedDB 数据到备份目录
      const dbExport = await exportDatabase()
      const dbExportPath = `${result.backupDir}/indexeddb-backup.json`
      await window.electronAPI.fs.writeJson(dbExportPath, JSON.parse(dbExport))

      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 格式化文件大小
  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  return {
    backups,
    loading,
    scanBackups,
    deleteBackup,
    rollbackToBackup,
    createBackup,
    formatSize
  }
}
