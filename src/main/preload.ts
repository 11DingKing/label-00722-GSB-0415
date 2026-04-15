import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用相关
  app: {
    restart: () => ipcRenderer.invoke('app:restart'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    showInFolder: (path: string) => ipcRenderer.invoke('app:showInFolder', path),
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },

  // 对话框相关
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    selectFile: (filters?: { name: string; extensions: string[] }[]) => 
      ipcRenderer.invoke('dialog:selectFile', filters),
    saveFile: (defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath)
  },

  // 打包相关
  packager: {
    scanFolder: (path: string, fileTypes: string[]) => 
      ipcRenderer.invoke('packager:scanFolder', path, fileTypes),
    createPackage: (config: {
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
    }) => ipcRenderer.invoke('packager:createPackage', config),
    validatePackage: (packagePath: string) => 
      ipcRenderer.invoke('packager:validatePackage', packagePath),
    onProgress: (callback: (progress: { stage: string; percent: number }) => void) => {
      ipcRenderer.on('packager:progress', (_, progress) => callback(progress))
      return () => ipcRenderer.removeAllListeners('packager:progress')
    }
  },

  // 更新相关
  updater: {
    checkPaths: (paths: string[]) => ipcRenderer.invoke('updater:checkPaths', paths),
    compareVersions: (current: string, target: string) => 
      ipcRenderer.invoke('updater:compareVersions', current, target),
    backup: (sourcePath: string, backupPath: string) => 
      ipcRenderer.invoke('updater:backup', sourcePath, backupPath),
    applyUpdate: (config: {
      packagePath: string
      targetPath: string
      backupPath: string
    }) => ipcRenderer.invoke('updater:applyUpdate', config),
    rollback: (backupPath: string, targetPath: string) => 
      ipcRenderer.invoke('updater:rollback', backupPath, targetPath),
    exportIndexedDB: (dbName: string, exportPath: string) => 
      ipcRenderer.invoke('updater:exportIndexedDB', dbName, exportPath),
    importIndexedDB: (dbName: string, importPath: string) => 
      ipcRenderer.invoke('updater:importIndexedDB', dbName, importPath),
    onProgress: (callback: (progress: { stage: string; percent: number }) => void) => {
      ipcRenderer.on('updater:progress', (_, progress) => callback(progress))
      return () => ipcRenderer.removeAllListeners('updater:progress')
    }
  },

  // 文件系统相关
  fs: {
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    readJson: (path: string) => ipcRenderer.invoke('fs:readJson', path),
    writeJson: (path: string, data: unknown) => ipcRenderer.invoke('fs:writeJson', path, data),
    readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
    getStats: (path: string) => ipcRenderer.invoke('fs:getStats', path)
  }
})

// 定义类型
export interface ElectronAPI {
  app: {
    restart: () => Promise<void>
    openExternal: (url: string) => Promise<void>
    showInFolder: (path: string) => Promise<void>
    getVersion: () => Promise<string>
  }
  dialog: {
    selectFolder: () => Promise<string | null>
    selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    saveFile: (defaultPath?: string) => Promise<string | null>
  }
  packager: {
    scanFolder: (path: string, fileTypes: string[]) => Promise<{ files: string[]; totalSize: number }>
    createPackage: (config: {
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
    }) => Promise<{ success: boolean; outputPath: string; md5?: string; error?: string }>
    validatePackage: (packagePath: string) => Promise<{ valid: boolean; errors: string[] }>
    onProgress: (callback: (progress: { stage: string; percent: number }) => void) => () => void
  }
  updater: {
    checkPaths: (paths: string[]) => Promise<{ path: string; versionInfo: any }[]>
    compareVersions: (current: string, target: string) => Promise<number>
    backup: (sourcePath: string, backupPath: string) => Promise<{ success: boolean; error?: string }>
    applyUpdate: (config: {
      packagePath: string
      targetPath: string
      backupPath: string
    }) => Promise<{ success: boolean; error?: string }>
    rollback: (backupPath: string, targetPath: string) => Promise<{ success: boolean; error?: string }>
    exportIndexedDB: (dbName: string, exportPath: string) => Promise<{ success: boolean; error?: string }>
    importIndexedDB: (dbName: string, importPath: string) => Promise<{ success: boolean; error?: string }>
    onProgress: (callback: (progress: { stage: string; percent: number }) => void) => () => void
  }
  fs: {
    exists: (path: string) => Promise<boolean>
    readJson: (path: string) => Promise<any>
    writeJson: (path: string, data: unknown) => Promise<void>
    readDir: (path: string) => Promise<string[]>
    getStats: (path: string) => Promise<{ size: number; isDirectory: boolean; mtime: Date }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
