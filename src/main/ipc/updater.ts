import { ipcMain, BrowserWindow } from 'electron'

import * as fs from 'fs'
import * as path from 'path'
import * as semver from 'semver'
import extractZip from 'extract-zip'

// 发送进度更新
function sendProgress(stage: string, percent: number) {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send('updater:progress', { stage, percent })
  })
}

// 复制目录（递归）
async function copyDir(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}

// 删除目录（递归）
async function removeDir(dir: string) {
  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}

export function setupUpdaterHandlers() {
  // 检查更新路径
  ipcMain.handle('updater:checkPaths', async (_, paths: string[]) => {
    const results: { path: string; versionInfo: any }[] = []
    
    for (const checkPath of paths) {
      try {
        if (!fs.existsSync(checkPath)) {
          continue
        }
        
        const stats = await fs.promises.stat(checkPath)
        
        if (stats.isDirectory()) {
          // 在目录中查找 version.json
          const versionPath = path.join(checkPath, 'version.json')
          if (fs.existsSync(versionPath)) {
            const content = await fs.promises.readFile(versionPath, 'utf-8')
            const versionInfo = JSON.parse(content)
            results.push({ path: checkPath, versionInfo })
          }
          
          // 也检查子目录
          const entries = await fs.promises.readdir(checkPath, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const subVersionPath = path.join(checkPath, entry.name, 'version.json')
              if (fs.existsSync(subVersionPath)) {
                const content = await fs.promises.readFile(subVersionPath, 'utf-8')
                const versionInfo = JSON.parse(content)
                results.push({ 
                  path: path.join(checkPath, entry.name), 
                  versionInfo 
                })
              }
            } else if (entry.name.endsWith('.zip')) {
              // ZIP 包暂时跳过，后续可以解压检查
            }
          }
        }
      } catch (error) {
        console.error(`检查路径失败 ${checkPath}:`, error)
      }
    }
    
    return results
  })

  // 比较版本号
  ipcMain.handle('updater:compareVersions', async (_, current: string, target: string) => {
    // 清理版本号
    const cleanCurrent = current.replace(/^v/, '')
    const cleanTarget = target.replace(/^v/, '')
    
    if (semver.valid(cleanCurrent) && semver.valid(cleanTarget)) {
      return semver.compare(cleanTarget, cleanCurrent)
    }
    
    // 简单字符串比较
    return cleanTarget.localeCompare(cleanCurrent)
  })

  // 备份当前版本
  ipcMain.handle('updater:backup', async (_, sourcePath: string, backupPath: string) => {
    try {
      sendProgress('备份当前版本...', 0)
      
      // 创建备份目录
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupDir = path.join(backupPath, `backup-${timestamp}`)
      
      await fs.promises.mkdir(backupDir, { recursive: true })
      
      // 复制文件
      sendProgress('复制文件...', 30)
      await copyDir(sourcePath, backupDir)
      
      sendProgress('备份完成', 100)
      return { success: true, backupDir }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 应用更新
  ipcMain.handle('updater:applyUpdate', async (_, config: {
    packagePath: string
    targetPath: string
    backupPath: string
  }) => {
    const { packagePath, targetPath } = config
    // backupPath 可用于扩展备份逻辑
    void config.backupPath
    
    try {
      sendProgress('准备更新...', 0)
      
      // 检查软件包类型
      const stats = await fs.promises.stat(packagePath)
      let updateSourcePath = packagePath
      
      if (!stats.isDirectory() && packagePath.endsWith('.zip')) {
        // 解压 ZIP 包
        sendProgress('解压软件包...', 20)
        const extractPath = path.join(path.dirname(packagePath), 'update-temp')
        await removeDir(extractPath)
        await extractZip(packagePath, { dir: extractPath })
        updateSourcePath = extractPath
      }
      
      // 保留用户数据目录列表
      const preserveDirs = ['userdata', 'config', 'database']
      
      // 替换文件
      sendProgress('替换文件...', 50)
      
      const entries = await fs.promises.readdir(updateSourcePath, { withFileTypes: true })
      
      for (const entry of entries) {
        // 跳过需要保留的目录
        if (preserveDirs.includes(entry.name)) {
          continue
        }
        
        const srcPath = path.join(updateSourcePath, entry.name)
        const destPath = path.join(targetPath, entry.name)
        
        // 删除目标位置的旧文件/目录
        if (fs.existsSync(destPath)) {
          await removeDir(destPath)
        }
        
        // 复制新文件
        if (entry.isDirectory()) {
          await copyDir(srcPath, destPath)
        } else {
          await fs.promises.copyFile(srcPath, destPath)
        }
      }
      
      // 清理临时文件
      sendProgress('清理临时文件...', 90)
      if (updateSourcePath !== packagePath) {
        await removeDir(updateSourcePath)
      }
      
      sendProgress('更新完成', 100)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 回滚到备份版本
  ipcMain.handle('updater:rollback', async (_, backupPath: string, targetPath: string) => {
    try {
      sendProgress('准备回滚...', 0)
      
      // 清理目标目录
      sendProgress('清理当前版本...', 30)
      await removeDir(targetPath)
      
      // 从备份恢复
      sendProgress('恢复备份版本...', 50)
      await copyDir(backupPath, targetPath)
      
      sendProgress('回滚完成', 100)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 导出 IndexedDB 数据（在渲染进程通过 Dexie 实现）
  ipcMain.handle('updater:exportIndexedDB', async (_event, _dbName: string, _exportPath: string) => {
    return { success: true }
  })

  // 导入 IndexedDB 数据（在渲染进程通过 Dexie 实现）
  ipcMain.handle('updater:importIndexedDB', async (_event, _dbName: string, _importPath: string) => {
    return { success: true }
  })
}
