import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'

import { setupDialogHandlers } from './ipc/dialog'
import { setupPackagerHandlers } from './ipc/packager'
import { setupUpdaterHandlers } from './ipc/updater'

// 禁用 GPU 加速（Docker 环境）
if (process.env.ELECTRON_DISABLE_GPU) {
  app.disableHardwareAcceleration()
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0D0D0D',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? true : false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  // 开发环境加载 Vite 开发服务器
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 打印启动成功日志
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('========================================')
    console.log('  Startup Success!')
    console.log('  Application: HTML Release Updater')
    console.log('  Version: 1.0.0')
    console.log('========================================')
  })
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow()

  // 注册 IPC 处理器
  setupDialogHandlers()
  setupPackagerHandlers()
  setupUpdaterHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 重启应用
ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit(0)
})

// 打开外部链接
ipcMain.handle('app:openExternal', async (_, url: string) => {
  await shell.openExternal(url)
})

// 在文件管理器中打开路径
ipcMain.handle('app:showInFolder', async (_, path: string) => {
  shell.showItemInFolder(path)
})

// 获取应用版本
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})
