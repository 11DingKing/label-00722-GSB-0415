import Dexie, { type Table } from 'dexie'
import type { PackConfig, UpdateSettings, UpdateLog } from '../types'

// 数据库定义
class AppDatabase extends Dexie {
  packConfigs!: Table<PackConfig, string>
  updateSettings!: Table<UpdateSettings, string>
  updateLogs!: Table<UpdateLog, string>
  recentPaths!: Table<{ id: string; path: string; type: 'source' | 'output' | 'check'; usedAt: Date }, string>

  constructor() {
    super('HTMLReleaseUpdater')
    
    this.version(1).stores({
      packConfigs: '++id, templateName, sourcePath, createdAt',
      updateSettings: '++id',
      updateLogs: '++id, timestamp, result',
      recentPaths: '++id, path, type, usedAt'
    })
  }
}

export const db = new AppDatabase()

// 初始化默认设置
export async function initializeDatabase() {
  // 检查是否已有更新设置
  const settingsCount = await db.updateSettings.count()
  
  if (settingsCount === 0) {
    // 创建默认设置
    await db.updateSettings.add({
      checkPaths: [],
      checkStrategy: 'manual',
      checkCycle: 24,
      backupPath: '',
      notifyOnce: true
    })
  }
}

// 导出数据库数据（用于备份）
export async function exportDatabase(): Promise<string> {
  const data = {
    packConfigs: await db.packConfigs.toArray(),
    updateSettings: await db.updateSettings.toArray(),
    updateLogs: await db.updateLogs.toArray(),
    recentPaths: await db.recentPaths.toArray()
  }
  return JSON.stringify(data, null, 2)
}

// 导入数据库数据（用于恢复）
export async function importDatabase(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData)
  
  await db.transaction('rw', [db.packConfigs, db.updateSettings, db.updateLogs, db.recentPaths], async () => {
    // 清空现有数据
    await db.packConfigs.clear()
    await db.updateSettings.clear()
    await db.updateLogs.clear()
    await db.recentPaths.clear()
    
    // 导入新数据
    if (data.packConfigs?.length) {
      await db.packConfigs.bulkAdd(data.packConfigs)
    }
    if (data.updateSettings?.length) {
      await db.updateSettings.bulkAdd(data.updateSettings)
    }
    if (data.updateLogs?.length) {
      await db.updateLogs.bulkAdd(data.updateLogs)
    }
    if (data.recentPaths?.length) {
      await db.recentPaths.bulkAdd(data.recentPaths)
    }
  })
}
