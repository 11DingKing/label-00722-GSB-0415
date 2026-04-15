import { ipcMain, dialog } from 'electron'

export function setupDialogHandlers() {
  // 选择文件夹
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  })

  // 选择文件
  ipcMain.handle('dialog:selectFile', async (_, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  })

  // 保存文件对话框
  ipcMain.handle('dialog:saveFile', async (_, defaultPath?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    
    if (result.canceled || !result.filePath) {
      return null
    }
    
    return result.filePath
  })
}
