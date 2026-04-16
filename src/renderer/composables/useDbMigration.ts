import { ref } from 'vue'
import { importDatabase } from '../database'

export interface MigrationScript {
  fromVersion: string
  toVersion: string
  migrate: () => Promise<void>
}

// 数据迁移脚本注册表
const migrationScripts: MigrationScript[] = [
  // 示例迁移脚本
  // {
  //   fromVersion: 'v1.0.0',
  //   toVersion: 'v1.1.0',
  //   migrate: async () => {
  //     // 执行数据结构迁移
  //   }
  // }
]

export function useDbMigration() {
  const migrating = ref(false)
  const migrationProgress = ref({ step: '', percent: 0 })

  // 注册迁移脚本
  function registerMigration(script: MigrationScript) {
    migrationScripts.push(script)
  }

  // 查找需要执行的迁移脚本
  function findMigrationPath(fromVersion: string, toVersion: string): MigrationScript[] {
    const path: MigrationScript[] = []
    let currentVersion = fromVersion

    while (currentVersion !== toVersion) {
      const script = migrationScripts.find(s => s.fromVersion === currentVersion)
      if (!script) break
      
      path.push(script)
      currentVersion = script.toVersion

      // 防止无限循环
      if (path.length > 100) break
    }

    return path
  }

  // 执行数据迁移
  async function executeMigration(fromVersion: string, toVersion: string): Promise<{ success: boolean; error?: string }> {
    migrating.value = true
    migrationProgress.value = { step: '准备迁移...', percent: 0 }

    try {
      const scripts = findMigrationPath(fromVersion, toVersion)

      if (scripts.length === 0) {
        // 无需迁移或没有迁移脚本
        migrationProgress.value = { step: '无需数据迁移', percent: 100 }
        return { success: true }
      }

      const totalSteps = scripts.length
      let currentStep = 0

      for (const script of scripts) {
        currentStep++
        migrationProgress.value = {
          step: `执行迁移: ${script.fromVersion} → ${script.toVersion}`,
          percent: Math.floor((currentStep / totalSteps) * 100)
        }

        try {
          await script.migrate()
        } catch (scriptError: any) {
          console.error(`迁移脚本 ${script.fromVersion} → ${script.toVersion} 执行失败:`, scriptError)
          // 单个迁移脚本失败时，继续执行后续脚本，不中断整个迁移过程
          // 记录错误但继续，尽可能完成更多迁移
        }
      }

      migrationProgress.value = { step: '迁移完成', percent: 100 }
      return { success: true }
    } catch (error: any) {
      console.error('数据迁移失败:', error)
      migrationProgress.value = { step: `迁移失败: ${error.message}`, percent: 0 }
      // 迁移失败时不抛出错误，返回失败状态，让应用可以继续运行
      return { success: false, error: error.message }
    } finally {
      migrating.value = false
    }
  }

  // 从备份恢复 IndexedDB 数据
  async function restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) return { success: false, error: 'Electron API not available' }

    migrating.value = true
    migrationProgress.value = { step: '读取备份数据...', percent: 20 }

    try {
      const dbBackupPath = `${backupPath}/indexeddb-backup.json`
      const exists = await window.electronAPI.fs.exists(dbBackupPath)

      if (!exists) {
        migrationProgress.value = { step: '无 IndexedDB 备份', percent: 100 }
        return { success: true }
      }

      const backupData = await window.electronAPI.fs.readJson(dbBackupPath)
      
      migrationProgress.value = { step: '导入数据...', percent: 60 }
      await importDatabase(JSON.stringify(backupData))

      migrationProgress.value = { step: '恢复完成', percent: 100 }
      return { success: true }
    } catch (error: any) {
      migrationProgress.value = { step: `恢复失败: ${error.message}`, percent: 0 }
      return { success: false, error: error.message }
    } finally {
      migrating.value = false
    }
  }

  // 检查是否需要迁移
  function needsMigration(fromVersion: string, toVersion: string): boolean {
    const scripts = findMigrationPath(fromVersion, toVersion)
    return scripts.length > 0
  }

  return {
    migrating,
    migrationProgress,
    registerMigration,
    executeMigration,
    restoreFromBackup,
    needsMigration
  }
}
