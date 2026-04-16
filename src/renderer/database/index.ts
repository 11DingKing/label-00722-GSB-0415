import Dexie, { type Table, DexieError } from 'dexie'
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

    // 数据库打开失败处理
    this.on('blocked', () => {
      console.warn('数据库打开被阻塞，可能有旧版本页面仍在运行')
    })

    this.on('versionchange', (event) => {
      console.warn('数据库版本发生变化，建议刷新页面', event)
      // 不自动关闭数据库，防止数据丢失
      event.preventDefault()
    })
  }
}

// 数据库实例创建函数，添加错误处理和降级逻辑
async function createDatabaseInstance(): Promise<AppDatabase> {
  const db = new AppDatabase()
  
  try {
    // 尝试打开数据库
    await db.open()
    console.log('数据库打开成功，版本:', db.verno)
    return db
  } catch (error: any) {
    console.error('数据库打开失败:', error)
    
    // 如果是版本不兼容错误，尝试以兼容模式打开
    if (error.name === 'VersionError' || error.message.includes('version')) {
      console.warn('尝试以兼容模式打开数据库...')
      
      // 先关闭可能存在的连接
      try {
        db.close()
      } catch (e) {
        // 忽略关闭错误
      }
      
      // 创建临时数据库实例，不指定版本，用于数据迁移
      const tempDb = new Dexie('HTMLReleaseUpdater')
      
      try {
        // 打开现有数据库
        await tempDb.open()
        console.log('成功打开现有数据库，版本:', tempDb.verno)
        
        // 备份现有数据
        const backupData = {
          packConfigs: await tempDb.table('packConfigs').toArray().catch(() => []),
          updateSettings: await tempDb.table('updateSettings').toArray().catch(() => []),
          updateLogs: await tempDb.table('updateLogs').toArray().catch(() => []),
          recentPaths: await tempDb.table('recentPaths').toArray().catch(() => [])
        }
        
        // 关闭临时数据库
        tempDb.close()
        
        // 删除旧数据库
        await Dexie.delete('HTMLReleaseUpdater')
        
        // 创建新数据库
        const newDb = new AppDatabase()
        await newDb.open()
        
        // 恢复数据
        await newDb.transaction('rw', [newDb.packConfigs, newDb.updateSettings, newDb.updateLogs, newDb.recentPaths], async () => {
          if (backupData.packConfigs.length) {
            await newDb.packConfigs.bulkAdd(backupData.packConfigs)
          }
          if (backupData.updateSettings.length) {
            await newDb.updateSettings.bulkAdd(backupData.updateSettings)
          }
          if (backupData.updateLogs.length) {
            await newDb.updateLogs.bulkAdd(backupData.updateLogs)
          }
          if (backupData.recentPaths.length) {
            await newDb.recentPaths.bulkAdd(backupData.recentPaths)
          }
        })
        
        console.log('数据库迁移完成，数据已恢复')
        return newDb
      } catch (migrateError: any) {
        console.error('数据库迁移失败:', migrateError)
        tempDb.close()
        
        // 最后尝试：删除旧数据库，创建新的空数据库
        await Dexie.delete('HTMLReleaseUpdater')
        const fallbackDb = new AppDatabase()
        await fallbackDb.open()
        console.warn('已创建新的空数据库，用户数据可能丢失')
        return fallbackDb
      }
    }
    
    // 其他错误，重新抛出
    throw error
  }
}

export const db = await createDatabaseInstance()

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
