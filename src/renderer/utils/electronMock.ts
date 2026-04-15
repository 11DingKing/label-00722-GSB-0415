// Mock Electron API for web development
// This allows the app to run in a browser without Electron

const isMocked = typeof window !== 'undefined' && !window.electronAPI

if (isMocked) {
  console.log('[DEV] Running in web mode with mocked Electron API')
  
  const mockElectronAPI = {
    app: {
      getVersion: async () => '1.0.0-dev',
      restart: async () => {
        console.log('[Mock] App restart requested')
        window.location.reload()
      },
      openExternal: async (url: string) => {
        window.open(url, '_blank')
      },
      showInFolder: async (path: string) => {
        console.log('[Mock] Show in folder:', path)
        alert(`无法在浏览器中打开文件夹: ${path}`)
      }
    },
    dialog: {
      selectFolder: async () => {
        const path = prompt('请输入文件夹路径 (Mock):')
        return path || null
      },
      selectFile: async () => {
        const path = prompt('请输入文件路径 (Mock):')
        return path || null
      },
      saveFile: async (defaultPath?: string) => {
        const path = prompt('请输入保存路径 (Mock):', defaultPath)
        return path || null
      }
    },
    packager: {
      scanFolder: async (folderPath: string, fileTypes: string[]) => {
        console.log('[Mock] Scan folder:', folderPath, fileTypes)
        return [
          { path: `${folderPath}/index.html`, size: 1024 },
          { path: `${folderPath}/style.css`, size: 512 },
          { path: `${folderPath}/script.js`, size: 2048 }
        ]
      },
      createPackage: async (config: any) => {
        console.log('[Mock] Create package:', config)
        return {
          success: true,
          outputPath: config.outputPath + '/' + config.packageName + '.zip',
          fileCount: 10,
          totalSize: 1024 * 100,
          md5: 'mock-md5-hash'
        }
      },
      validatePackage: async (packagePath: string) => {
        console.log('[Mock] Validate package:', packagePath)
        return {
          valid: true,
          hasVersionFile: true,
          hasIndexHtml: true,
          versionInfo: {
            versionCode: 'v1.0.0',
            releaseTime: new Date().toISOString(),
            updateContent: 'Mock version'
          }
        }
      }
    },
    updater: {
      checkPaths: async (paths: string[]) => {
        console.log('[Mock] Check paths:', paths)
        return paths.map(p => ({
          path: p,
          versionInfo: {
            versionCode: 'v1.1.0',
            releaseTime: new Date().toISOString(),
            updateContent: 'Mock update available'
          }
        }))
      },
      compareVersions: async (current: string, target: string) => {
        console.log('[Mock] Compare versions:', current, target)
        // 简单比较：如果 target 数字更大则返回正数
        const currentNum = parseInt(current.replace(/\D/g, ''))
        const targetNum = parseInt(target.replace(/\D/g, ''))
        return targetNum - currentNum
      },
      backup: async (sourcePath: string, backupPath: string) => {
        console.log('[Mock] Backup:', sourcePath, '->', backupPath)
        return {
          success: true,
          backupDir: `${backupPath}/backup-${Date.now()}`
        }
      },
      applyUpdate: async (packagePath: string, targetPath: string) => {
        console.log('[Mock] Apply update:', packagePath, '->', targetPath)
        return { success: true }
      },
      rollback: async (backupPath: string, targetPath: string) => {
        console.log('[Mock] Rollback:', backupPath, '->', targetPath)
        return { success: true }
      }
    },
    fs: {
      exists: async (path: string) => {
        console.log('[Mock] Check exists:', path)
        return true
      },
      readJson: async (path: string) => {
        console.log('[Mock] Read JSON:', path)
        return { mock: true }
      },
      writeJson: async (path: string, data: any) => {
        console.log('[Mock] Write JSON:', path, data)
      },
      readDir: async (path: string) => {
        console.log('[Mock] Read dir:', path)
        return ['file1.txt', 'file2.txt']
      },
      getStats: async (path: string) => {
        console.log('[Mock] Get stats:', path)
        return {
          isDirectory: true,
          mtime: Date.now(),
          size: 1024
        }
      }
    }
  }

  // @ts-ignore
  window.electronAPI = mockElectronAPI
}

export {}
