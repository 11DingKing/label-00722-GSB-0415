import { ipcMain, BrowserWindow } from 'electron'

import * as fs from 'fs'
import * as path from 'path'
import archiver from 'archiver'
import md5File from 'md5-file'

// 发送进度更新
function sendProgress(stage: string, percent: number) {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send('packager:progress', { stage, percent })
  })
}

// 递归扫描文件夹
async function scanDirectory(
  dir: string, 
  fileTypes: string[], 
  baseDir: string
): Promise<{ files: string[]; totalSize: number }> {
  const files: string[] = []
  let totalSize = 0

  async function scan(currentDir: string) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        // 跳过特定目录
        if (['node_modules', '.git', '.idea', '.vscode'].includes(entry.name)) {
          continue
        }
        await scan(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (fileTypes.includes(ext) || fileTypes.includes('*')) {
          const relativePath = path.relative(baseDir, fullPath)
          files.push(relativePath)
          const stats = await fs.promises.stat(fullPath)
          totalSize += stats.size
        }
      }
    }
  }

  await scan(dir)
  return { files, totalSize }
}

// 复制目录
async function copyDirectory(src: string, dest: string, fileTypes: string[]) {
  await fs.promises.mkdir(dest, { recursive: true })
  
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.idea', '.vscode'].includes(entry.name)) {
        continue
      }
      await copyDirectory(srcPath, destPath, fileTypes)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (fileTypes.includes(ext) || fileTypes.includes('*')) {
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
  }
}

export function setupPackagerHandlers() {
  // 扫描文件夹
  ipcMain.handle('packager:scanFolder', async (_, folderPath: string, fileTypes: string[]) => {
    try {
      sendProgress('扫描文件中...', 0)
      const result = await scanDirectory(folderPath, fileTypes, folderPath)
      sendProgress('扫描完成', 100)
      return result
    } catch (error: any) {
      throw new Error(`扫描失败: ${error.message}`)
    }
  })

  // 创建软件包
  ipcMain.handle('packager:createPackage', async (_, config: {
    sourcePath: string
    outputPath: string
    packageName: string
    packageType: 'zip' | 'folder'
    versionInfo: {
      versionCode: string
      releaseTime: string
      updateContent: string
    }
    fileTypes: string[]
  }) => {
    try {
      const { sourcePath, outputPath, packageName, packageType, versionInfo, fileTypes } = config
      
      // 确保输出目录存在
      await fs.promises.mkdir(outputPath, { recursive: true })
      
      sendProgress('准备打包...', 5)
      
      // 扫描文件
      sendProgress('扫描源文件...', 10)
      const { files } = await scanDirectory(sourcePath, fileTypes, sourcePath)
      
      if (files.length === 0) {
        throw new Error('没有找到匹配的文件')
      }

      let finalOutputPath: string
      
      if (packageType === 'folder') {
        // 文件夹模式
        finalOutputPath = path.join(outputPath, packageName)
        
        sendProgress('复制文件...', 30)
        await copyDirectory(sourcePath, finalOutputPath, fileTypes)
        
        // 写入版本信息
        sendProgress('生成版本信息...', 80)
        const versionFilePath = path.join(finalOutputPath, 'version.json')
        await fs.promises.writeFile(
          versionFilePath,
          JSON.stringify({ ...versionInfo, md5: '' }, null, 2)
        )
        
        sendProgress('打包完成', 100)
        return { success: true, outputPath: finalOutputPath }
        
      } else {
        // ZIP 模式
        finalOutputPath = path.join(outputPath, `${packageName}.zip`)
        
        return new Promise((resolve, reject) => {
          const output = fs.createWriteStream(finalOutputPath)
          const archive = archiver('zip', { zlib: { level: 9 } })
          
          output.on('close', async () => {
            sendProgress('计算校验值...', 95)
            const md5 = await md5File(finalOutputPath)
            sendProgress('打包完成', 100)
            resolve({ success: true, outputPath: finalOutputPath, md5 })
          })
          
          archive.on('error', (err) => {
            reject(new Error(`压缩失败: ${err.message}`))
          })
          
          archive.on('progress', (progress) => {
            const percent = 30 + Math.floor((progress.entries.processed / progress.entries.total) * 50)
            sendProgress('压缩文件中...', percent)
          })
          
          archive.pipe(output)
          
          // 添加文件到压缩包
          sendProgress('添加文件到压缩包...', 30)
          for (const file of files) {
            const filePath = path.join(sourcePath, file)
            archive.file(filePath, { name: file })
          }
          
          // 添加版本信息文件
          archive.append(JSON.stringify({ ...versionInfo, md5: '' }, null, 2), {
            name: 'version.json'
          })
          
          archive.finalize()
        })
      }
    } catch (error: any) {
      return { success: false, outputPath: '', error: error.message }
    }
  })

  // 验证软件包
  ipcMain.handle('packager:validatePackage', async (_, packagePath: string) => {
    const errors: string[] = []
    
    try {
      const stats = await fs.promises.stat(packagePath)
      
      let versionJsonPath: string
      
      if (stats.isDirectory()) {
        versionJsonPath = path.join(packagePath, 'version.json')
      } else if (packagePath.endsWith('.zip')) {
        // 对于 ZIP 文件，暂时跳过详细验证
        return { valid: true, errors: [] }
      } else {
        errors.push('无效的软件包格式')
        return { valid: false, errors }
      }
      
      // 检查 version.json
      if (!fs.existsSync(versionJsonPath)) {
        errors.push('缺少 version.json 文件')
      } else {
        try {
          const content = await fs.promises.readFile(versionJsonPath, 'utf-8')
          const versionInfo = JSON.parse(content)
          
          if (!versionInfo.versionCode) {
            errors.push('version.json 缺少 versionCode 字段')
          }
          if (!versionInfo.releaseTime) {
            errors.push('version.json 缺少 releaseTime 字段')
          }
        } catch {
          errors.push('version.json 格式无效')
        }
      }
      
      // 检查 index.html
      const indexPath = path.join(packagePath, 'index.html')
      if (!fs.existsSync(indexPath)) {
        errors.push('缺少 index.html 入口文件')
      }
      
      return { valid: errors.length === 0, errors }
    } catch (error: any) {
      errors.push(`验证失败: ${error.message}`)
      return { valid: false, errors }
    }
  })

  // 文件系统操作
  ipcMain.handle('fs:exists', async (_, filePath: string) => {
    return fs.existsSync(filePath)
  })

  ipcMain.handle('fs:readJson', async (_, filePath: string) => {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  })

  ipcMain.handle('fs:writeJson', async (_, filePath: string, data: unknown) => {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2))
  })

  ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    return fs.promises.readdir(dirPath)
  })

  ipcMain.handle('fs:getStats', async (_, filePath: string) => {
    const stats = await fs.promises.stat(filePath)
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      mtime: stats.mtime
    }
  })
}
