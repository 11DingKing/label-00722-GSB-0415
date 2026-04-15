import { ref } from 'vue'
import { importDatabase, db, DB_VERSION } from '../database'
import type { Table } from 'dexie'

export interface MigrationScript {
  fromVersion: number
  toVersion: number
  migrate: (tx: any) => Promise<void>
}

const migrationScripts: MigrationScript[] = []

export function useDbMigration() {
  const migrating = ref(false)
  const migrationProgress = ref({ step: '', percent: 0 })

  function registerMigration(script: MigrationScript) {
    migrationScripts.push(script)
    migrationScripts.sort((a, b) => a.fromVersion - b.fromVersion)
  }

  function findMigrationPath(fromVersion: number, toVersion: number): MigrationScript[] {
    const path: MigrationScript[] = []
    let currentVersion = fromVersion

    while (currentVersion < toVersion) {
      const script = migrationScripts.find(s => s.fromVersion === currentVersion)
      if (!script) {
        currentVersion++
        continue
      }
      
      path.push(script)
      currentVersion = script.toVersion

      if (path.length > 100) break
    }

    return path
  }

  async function executeManualMigration(
    fromVersion: number, 
    toVersion: number
  ): Promise<{ success: boolean; error?: string }> {
    migrating.value = true
    migrationProgress.value = { step: '准备迁移...', percent: 0 }

    try {
      const scripts = findMigrationPath(fromVersion, toVersion)

      if (scripts.length === 0) {
        migrationProgress.value = { step: '无需数据迁移', percent: 100 }
        return { success: true }
      }

      const totalSteps = scripts.length
      let currentStep = 0

      for (const script of scripts) {
        currentStep++
        migrationProgress.value = {
          step: `执行迁移: v${script.fromVersion} → v${script.toVersion}`,
          percent: Math.floor((currentStep / totalSteps) * 100)
        }

        await db.transaction('rw', db.tables, async (tx) => {
          await script.migrate(tx)
        })
      }

      migrationProgress.value = { step: '迁移完成', percent: 100 }
      return { success: true }
    } catch (error: any) {
      migrationProgress.value = { step: `迁移失败: ${error.message}`, percent: 0 }
      console.error('Migration failed:', error)
      return { success: false, error: error.message }
    } finally {
      migrating.value = false
    }
  }

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
      console.error('Restore failed:', error)
      return { success: false, error: error.message }
    } finally {
      migrating.value = false
    }
  }

  function needsMigration(fromVersion: number, toVersion: number): boolean {
    const scripts = findMigrationPath(fromVersion, toVersion)
    return scripts.length > 0
  }

  async function getCurrentDbVersion(): Promise<number> {
    try {
      if (!db.isOpen()) {
        await db.open()
      }
      return db.verno
    } catch (error) {
      console.error('Failed to get DB version:', error)
      return 0
    }
  }

  async function backupToFile(backupPath: string): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) return { success: false, error: 'Electron API not available' }

    migrating.value = true
    migrationProgress.value = { step: '备份数据...', percent: 30 }

    try {
      const data = {
        packConfigs: await db.packConfigs.toArray(),
        updateSettings: await db.updateSettings.toArray(),
        updateLogs: await db.updateLogs.toArray(),
        recentPaths: await db.recentPaths.toArray(),
        timestamp: new Date().toISOString(),
        version: db.verno
      }

      const dbBackupPath = `${backupPath}/indexeddb-backup.json`
      await window.electronAPI.fs.writeJson(dbBackupPath, data)

      migrationProgress.value = { step: '备份完成', percent: 100 }
      return { success: true }
    } catch (error: any) {
      migrationProgress.value = { step: `备份失败: ${error.message}`, percent: 0 }
      console.error('Backup failed:', error)
      return { success: false, error: error.message }
    } finally {
      migrating.value = false
    }
  }

  async function validateAndRepairData(): Promise<{ success: boolean; repaired: number }> {
    let repaired = 0

    try {
      const settings = await db.updateSettings.toArray()
      for (const setting of settings) {
        let needsRepair = false
        
        if (!Array.isArray(setting.checkPaths)) {
          (setting as any).checkPaths = []
          needsRepair = true
        }
        
        if (!setting.checkStrategy) {
          setting.checkStrategy = 'manual'
          needsRepair = true
        }
        
        if (typeof setting.checkCycle !== 'number') {
          setting.checkCycle = 24
          needsRepair = true
        }

        if (needsRepair) {
          await db.updateSettings.put(setting)
          repaired++
        }
      }

      const configs = await db.packConfigs.toArray()
      for (const config of configs) {
        let needsRepair = false
        
        if (!config.createdAt) {
          config.createdAt = new Date()
          needsRepair = true
        }
        
        if (!config.updatedAt) {
          config.updatedAt = new Date()
          needsRepair = true
        }

        if (needsRepair) {
          await db.packConfigs.put(config)
          repaired++
        }
      }

      return { success: true, repaired }
    } catch (error) {
      console.error('Data validation failed:', error)
      return { success: false, repaired }
    }
  }

  return {
    migrating,
    migrationProgress,
    registerMigration,
    executeManualMigration,
    restoreFromBackup,
    backupToFile,
    needsMigration,
    getCurrentDbVersion,
    validateAndRepairData
  }
}
