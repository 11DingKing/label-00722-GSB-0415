<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { 
  FolderOpen, 
  RefreshCw, 
  Settings,
  Plus,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  HardDrive,
  Cloud,
  Archive
} from 'lucide-vue-next'
import { db } from '../database'
import { useAutoUpdater } from '../composables/useAutoUpdater'
import { useBackupManager, type BackupInfo } from '../composables/useBackupManager'
import type { UpdateSettings, CheckPath, UpdateLog } from '../types'

// 当前版本
const currentVersion = ref('v1.0.0')

// 自动更新调度器（已初始化，支持自动检测）
useAutoUpdater()

// 备份管理器
const { 
  backups, 
  loading: backupsLoading, 
  scanBackups, 
  deleteBackup,
  rollbackToBackup
} = useBackupManager()

// 设置数据
const settings = reactive<UpdateSettings>({
  checkPaths: [],
  checkStrategy: 'manual',
  checkCycle: 24,
  backupPath: '',
  notifyOnce: true
})

// 状态
const checking = ref(false)
const updating = ref(false)
const progress = ref({ stage: '', percent: 0 })
const updateLogs = ref<UpdateLog[]>([])
const detectedVersion = ref<{ path: string; versionInfo: any } | null>(null)

// 备份管理弹窗
const backupModalVisible = ref(false)

// 编辑路径弹窗
const pathModalVisible = ref(false)
const editingPath = reactive({
  id: '',
  type: 'local' as 'local' | 'cloud',
  path: '',
  enabled: true
})

// 加载设置
onMounted(async () => {
  // 加载设置
  const savedSettings = await db.updateSettings.toCollection().first()
  if (savedSettings) {
    Object.assign(settings, savedSettings)
  }
  
  // 加载更新日志
  updateLogs.value = await db.updateLogs.reverse().sortBy('timestamp')
  updateLogs.value = updateLogs.value.slice(0, 10)
  
  // 获取当前版本
  if (window.electronAPI) {
    currentVersion.value = await window.electronAPI.app.getVersion()
    
    // 监听更新进度
    window.electronAPI.updater.onProgress((p) => {
      progress.value = p
    })
  }
})

// 保存设置
async function saveSettings() {
  const savedSettings = await db.updateSettings.toCollection().first()
  if (savedSettings) {
    await db.updateSettings.update(savedSettings.id!, {
      ...settings,
      updatedAt: new Date()
    })
  }
  message.success('设置已保存')
}

// 添加路径
function showAddPathModal(type: 'local' | 'cloud') {
  editingPath.id = ''
  editingPath.type = type
  editingPath.path = ''
  editingPath.enabled = true
  pathModalVisible.value = true
}

// 编辑路径
function showEditPathModal(pathItem: CheckPath) {
  editingPath.id = pathItem.id
  editingPath.type = pathItem.type
  editingPath.path = pathItem.path
  editingPath.enabled = pathItem.enabled
  pathModalVisible.value = true
}

// 选择路径
async function selectPath() {
  if (!window.electronAPI) return
  
  const path = await window.electronAPI.dialog.selectFolder()
  if (path) {
    editingPath.path = path
  }
}

// 保存路径
function savePath() {
  if (!editingPath.path) {
    message.warning('请输入路径')
    return
  }
  
  if (editingPath.id) {
    // 编辑
    const index = settings.checkPaths.findIndex(p => p.id === editingPath.id)
    if (index > -1) {
      settings.checkPaths[index] = { ...editingPath }
    }
  } else {
    // 新增
    settings.checkPaths.push({
      ...editingPath,
      id: crypto.randomUUID()
    })
  }
  
  pathModalVisible.value = false
  saveSettings()
}

// 删除路径
function deletePath(id: string) {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这个检测路径吗？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      settings.checkPaths = settings.checkPaths.filter(p => p.id !== id)
      saveSettings()
    }
  })
}

// 选择备份路径
async function selectBackupPath() {
  if (!window.electronAPI) return
  
  const path = await window.electronAPI.dialog.selectFolder()
  if (path) {
    settings.backupPath = path
    saveSettings()
  }
}

// 检查更新
async function checkUpdate() {
  if (settings.checkPaths.length === 0) {
    message.warning('请先添加检测路径')
    return
  }
  
  checking.value = true
  detectedVersion.value = null
  
  try {
    const enabledPaths = settings.checkPaths.filter(p => p.enabled).map(p => p.path)
    const results = await window.electronAPI.updater.checkPaths(enabledPaths)
    
    if (results.length === 0) {
      message.info('未检测到可用的更新包')
      return
    }
    
    // 找到最新版本
    let latestVersion = null
    for (const result of results) {
      if (!latestVersion) {
        latestVersion = result
        continue
      }
      
      const compare = await window.electronAPI.updater.compareVersions(
        latestVersion.versionInfo.versionCode,
        result.versionInfo.versionCode
      )
      
      if (compare > 0) {
        latestVersion = result
      }
    }
    
    if (latestVersion) {
      // 与当前版本对比
      const compare = await window.electronAPI.updater.compareVersions(
        currentVersion.value,
        latestVersion.versionInfo.versionCode
      )
      
      if (compare > 0) {
        detectedVersion.value = latestVersion
        showUpdateModal()
      } else {
        message.info('当前已是最新版本')
      }
    }
  } catch (error: any) {
    message.error(`检测失败: ${error.message}`)
  } finally {
    checking.value = false
  }
}

// 显示更新弹窗
function showUpdateModal() {
  if (!detectedVersion.value) return
  
  Modal.confirm({
    title: '检测到新版本',
    content: `
      版本号: ${detectedVersion.value.versionInfo.versionCode}
      发布时间: ${new Date(detectedVersion.value.versionInfo.releaseTime).toLocaleString()}
      
      更新内容:
      ${detectedVersion.value.versionInfo.updateContent || '无'}
    `,
    okText: '立即更新',
    cancelText: '稍后更新',
    onOk: () => startUpdate()
  })
}

// 开始更新
async function startUpdate() {
  if (!detectedVersion.value) return
  if (!settings.backupPath) {
    message.warning('请先设置备份路径')
    return
  }
  
  updating.value = true
  progress.value = { stage: '准备更新...', percent: 0 }
  
  try {
    // 备份当前版本
    progress.value = { stage: '备份当前版本...', percent: 10 }
    // 这里需要获取当前应用路径，暂时模拟
    
    // 应用更新
    progress.value = { stage: '应用更新...', percent: 50 }
    const result = await window.electronAPI.updater.applyUpdate({
      packagePath: detectedVersion.value.path,
      targetPath: '.', // 实际应该是应用路径
      backupPath: settings.backupPath
    })
    
    if (result.success) {
      // 记录更新日志
      await db.updateLogs.add({
        timestamp: new Date(),
        fromVersion: currentVersion.value,
        toVersion: detectedVersion.value.versionInfo.versionCode,
        result: 'success'
      })
      
      progress.value = { stage: '更新完成', percent: 100 }
      
      Modal.success({
        title: '更新成功',
        content: '软件已更新到最新版本，需要重启软件生效。',
        okText: '立即重启',
        onOk: () => {
          window.electronAPI.app.restart()
        }
      })
    } else {
      throw new Error(result.error)
    }
  } catch (error: any) {
    // 记录失败日志
    await db.updateLogs.add({
      timestamp: new Date(),
      fromVersion: currentVersion.value,
      toVersion: detectedVersion.value?.versionInfo.versionCode || '',
      result: 'failed',
      errorMessage: error.message
    })
    
    message.error(`更新失败: ${error.message}`)
  } finally {
    updating.value = false
    progress.value = { stage: '', percent: 0 }
    
    // 刷新日志
    updateLogs.value = await db.updateLogs.reverse().sortBy('timestamp')
    updateLogs.value = updateLogs.value.slice(0, 10)
  }
}

// 显示备份管理弹窗
async function showBackupManager() {
  if (!settings.backupPath) {
    message.warning('请先设置备份路径')
    return
  }
  backupModalVisible.value = true
  await scanBackups(settings.backupPath)
}

// 删除备份
async function handleDeleteBackup(backup: BackupInfo) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除备份 "${backup.name}" 吗？此操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const success = await deleteBackup(backup.path)
      if (success) {
        message.success('备份已删除')
      } else {
        message.error('删除失败')
      }
    }
  })
}

// 回滚版本
async function showRollbackModal() {
  if (!settings.backupPath) {
    message.warning('请先设置备份路径')
    return
  }
  
  await scanBackups(settings.backupPath)
  
  if (backups.value.length === 0) {
    message.info('暂无可用的备份版本')
    return
  }
  
  backupModalVisible.value = true
}

// 执行回滚
async function handleRollback(backup: BackupInfo) {
  Modal.confirm({
    title: '确认回滚',
    content: `确定要回滚到版本 "${backup.version}" 吗？当前版本的更改将丢失。`,
    okText: '确认回滚',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      updating.value = true
      progress.value = { stage: '准备回滚...', percent: 0 }
      
      try {
        const result = await rollbackToBackup(backup.path, '.')
        
        if (result.success) {
          // 记录回滚日志
          await db.updateLogs.add({
            timestamp: new Date(),
            fromVersion: currentVersion.value,
            toVersion: backup.version,
            result: 'rollback'
          })
          
          Modal.success({
            title: '回滚成功',
            content: '已回滚到指定版本，需要重启软件生效。',
            okText: '立即重启',
            onOk: () => {
              window.electronAPI.app.restart()
            }
          })
        } else {
          throw new Error(result.error)
        }
      } catch (error: any) {
        message.error(`回滚失败: ${error.message}`)
      } finally {
        updating.value = false
        progress.value = { stage: '', percent: 0 }
        backupModalVisible.value = false
      }
    }
  })
}

// 格式化时间
function formatTime(date: Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取状态标签样式
function getResultClass(result: string): string {
  switch (result) {
    case 'success': return 'success'
    case 'failed': return 'error'
    case 'rollback': return 'warning'
    default: return ''
  }
}
</script>

<template>
  <div class="update-page">
    <h1 class="geek-title">UPDATE SETTINGS</h1>
    
    <!-- 当前版本 -->
    <div class="version-banner">
      <span class="version-label">CURRENT VERSION:</span>
      <span class="version-value">{{ currentVersion }}</span>
      <a-button 
        type="primary" 
        @click="checkUpdate" 
        :loading="checking"
        :disabled="updating"
      >
        <RefreshCw :size="16" v-if="!checking" />
        CHECK UPDATE
      </a-button>
    </div>
    
    <!-- 检测路径 -->
    <div class="geek-card">
      <div class="card-header">
        <span class="card-title">
          <FolderOpen :size="18" />
          CHECK PATHS
        </span>
      </div>
      
      <div class="paths-table" v-if="settings.checkPaths.length > 0">
        <div class="table-header">
          <span class="col-type">TYPE</span>
          <span class="col-path">PATH</span>
          <span class="col-actions">ACTIONS</span>
        </div>
        <div 
          v-for="pathItem in settings.checkPaths" 
          :key="pathItem.id"
          class="table-row"
        >
          <span class="col-type">
            <span class="type-badge" :class="pathItem.type">
              <HardDrive v-if="pathItem.type === 'local'" :size="14" />
              <Cloud v-else :size="14" />
              {{ pathItem.type.toUpperCase() }}
            </span>
          </span>
          <span class="col-path">{{ pathItem.path }}</span>
          <span class="col-actions">
            <a-button size="small" @click="showEditPathModal(pathItem)">
              <Edit :size="14" />
            </a-button>
            <a-button size="small" danger @click="deletePath(pathItem.id)">
              <Trash2 :size="14" />
            </a-button>
          </span>
        </div>
      </div>
      
      <div class="empty-state" v-else>
        暂无检测路径，请添加
      </div>
      
      <div class="path-actions">
        <a-button @click="showAddPathModal('local')">
          <Plus :size="16" />
          添加本地路径
        </a-button>
        <a-button @click="showAddPathModal('cloud')">
          <Plus :size="16" />
          添加网盘路径
        </a-button>
      </div>
    </div>
    
    <!-- 检测策略 -->
    <div class="geek-card">
      <div class="card-header">
        <span class="card-title">
          <Settings :size="18" />
          CHECK STRATEGY
        </span>
      </div>
      
      <div class="strategy-options">
        <a-radio-group v-model:value="settings.checkStrategy" @change="saveSettings">
          <a-radio value="manual">手动检测</a-radio>
          <a-radio value="auto">自动检测</a-radio>
        </a-radio-group>
        
        <div class="cycle-input" v-if="settings.checkStrategy === 'auto'">
          <span>检测周期:</span>
          <a-input-number 
            v-model:value="settings.checkCycle" 
            :min="1" 
            :max="168"
            @change="saveSettings"
          />
          <span>小时</span>
        </div>
      </div>
      
      <div class="form-row">
        <a-checkbox 
          v-model:checked="settings.notifyOnce"
          @change="saveSettings"
        >
          同一版本仅提示一次
        </a-checkbox>
      </div>
      
      <div class="form-row">
        <label class="form-label">$ backup_path:</label>
        <div class="input-group">
          <a-input 
            v-model:value="settings.backupPath" 
            placeholder="选择备份存储路径"
          />
          <a-button @click="selectBackupPath">
            浏览
          </a-button>
        </div>
      </div>
    </div>
    
    <!-- 进度区域 -->
    <div class="progress-section" v-if="updating">
      <div class="progress-bar">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
        </div>
        <span class="progress-percent">{{ progress.percent }}%</span>
      </div>
      <div class="progress-stage">{{ progress.stage }}</div>
    </div>
    
    <!-- 更新日志 -->
    <div class="geek-card">
      <div class="card-header">
        <span class="card-title">
          <Clock :size="18" />
          UPDATE LOGS
        </span>
      </div>
      
      <div class="logs-table" v-if="updateLogs.length > 0">
        <div class="table-header">
          <span class="col-time">TIMESTAMP</span>
          <span class="col-version">VERSION</span>
          <span class="col-status">STATUS</span>
        </div>
        <div 
          v-for="log in updateLogs" 
          :key="log.id"
          class="table-row"
        >
          <span class="col-time">{{ formatTime(log.timestamp) }}</span>
          <span class="col-version">
            {{ log.fromVersion }} → {{ log.toVersion }}
          </span>
          <span class="col-status">
            <span class="status-badge" :class="getResultClass(log.result)">
              <CheckCircle v-if="log.result === 'success'" :size="14" />
              <XCircle v-else-if="log.result === 'failed'" :size="14" />
              <RotateCcw v-else :size="14" />
              {{ log.result.toUpperCase() }}
            </span>
          </span>
        </div>
      </div>
      
      <div class="empty-state" v-else>
        暂无更新记录
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="action-buttons">
      <a-button size="large" @click="showBackupManager">
        <Archive :size="18" />
        MANAGE BACKUPS
      </a-button>
      <a-button size="large" @click="showRollbackModal">
        <RotateCcw :size="18" />
        ROLLBACK
      </a-button>
    </div>
    
    <!-- 备份管理弹窗 -->
    <a-modal
      v-model:open="backupModalVisible"
      title="备份管理"
      width="700px"
      :footer="null"
    >
      <div class="backup-list" v-if="backups.length > 0">
        <div 
          v-for="backup in backups" 
          :key="backup.path"
          class="backup-item"
        >
          <div class="backup-info">
            <div class="backup-name">{{ backup.name }}</div>
            <div class="backup-meta">
              <span class="backup-version">{{ backup.version }}</span>
              <span class="backup-date">{{ formatTime(backup.createdAt) }}</span>
            </div>
          </div>
          <div class="backup-actions">
            <a-button size="small" @click="handleRollback(backup)">
              <RotateCcw :size="14" />
              回滚
            </a-button>
            <a-button size="small" danger @click="handleDeleteBackup(backup)">
              <Trash2 :size="14" />
              删除
            </a-button>
          </div>
        </div>
      </div>
      <div class="empty-state" v-else-if="!backupsLoading">
        暂无备份记录
      </div>
      <div class="loading-state" v-else>
        加载中...
      </div>
    </a-modal>
    
    <!-- 路径编辑弹窗 -->
    <a-modal
      v-model:open="pathModalVisible"
      :title="editingPath.id ? '编辑路径' : '添加路径'"
      @ok="savePath"
    >
      <div class="modal-form">
        <div class="form-row">
          <label>路径类型:</label>
          <a-radio-group v-model:value="editingPath.type">
            <a-radio value="local">
              <HardDrive :size="14" /> 本地路径
            </a-radio>
            <a-radio value="cloud">
              <Cloud :size="14" /> 网盘路径
            </a-radio>
          </a-radio-group>
        </div>
        <div class="form-row">
          <label>路径:</label>
          <div class="input-group">
            <a-input v-model:value="editingPath.path" placeholder="输入路径" />
            <a-button @click="selectPath">浏览</a-button>
          </div>
        </div>
        <div class="form-row">
          <a-checkbox v-model:checked="editingPath.enabled">
            启用此路径
          </a-checkbox>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.update-page {
  max-width: 900px;
  margin: 0 auto;
}

.version-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--color-terminal-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  padding: var(--spacing-md) var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.version-label {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.version-value {
  color: var(--color-terminal-green);
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 18px;
  flex: 1;
}

.geek-card {
  background: var(--color-terminal-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-dark);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-terminal-green);
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Tables */
.paths-table,
.logs-table {
  margin-bottom: var(--spacing-lg);
}

.table-header {
  display: flex;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-panel-gray);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-row {
  display: flex;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-dark);
  align-items: center;
}

.table-row:hover {
  background: var(--color-hover-gray);
}

.col-type { width: 120px; }
.col-path { flex: 1; font-family: var(--font-mono); font-size: 13px; }
.col-actions { width: 100px; display: flex; gap: var(--spacing-xs); }

.col-time { width: 180px; font-family: var(--font-mono); font-size: 13px; }
.col-version { flex: 1; font-family: var(--font-mono); }
.col-status { width: 120px; }

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
}

.type-badge.local {
  background: rgba(0, 212, 255, 0.15);
  color: var(--color-cyber-cyan);
}

.type-badge.cloud {
  background: rgba(189, 0, 255, 0.15);
  color: var(--color-neon-purple);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
}

.status-badge.success {
  background: rgba(0, 255, 136, 0.15);
  color: var(--color-terminal-green);
}

.status-badge.error {
  background: rgba(255, 59, 92, 0.15);
  color: var(--color-error-red);
}

.status-badge.warning {
  background: rgba(255, 149, 0, 0.15);
  color: var(--color-warning-orange);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.path-actions {
  display: flex;
  gap: var(--spacing-md);
}

.strategy-options {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.cycle-input {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.form-row {
  margin-bottom: var(--spacing-md);
}

.form-label {
  display: block;
  color: var(--color-cyber-cyan);
  font-size: 12px;
  font-family: var(--font-mono);
  margin-bottom: var(--spacing-xs);
}

.input-group {
  display: flex;
  gap: var(--spacing-sm);
}

.input-group .ant-input {
  flex: 1;
}

.progress-section {
  background: var(--color-terminal-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.progress-track {
  flex: 1;
  height: 8px;
  background: var(--color-panel-gray);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-progress);
  border-radius: 4px;
  transition: width var(--transition-normal);
}

.progress-percent {
  color: var(--color-terminal-green);
  font-family: var(--font-mono);
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.progress-stage {
  margin-top: var(--spacing-sm);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.action-buttons {
  display: flex;
  gap: var(--spacing-md);
}

.action-buttons .ant-btn svg {
  margin-right: var(--spacing-xs);
}

.modal-form .form-row {
  margin-bottom: var(--spacing-md);
}

.modal-form label {
  display: block;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-secondary);
}

/* 单选框组垂直排列 */
.modal-form :deep(.ant-radio-group) {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* 单选框选项内容对齐 */
.modal-form :deep(.ant-radio-wrapper) {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px;
  margin-right: 0 !important;
}

.modal-form :deep(.ant-radio-wrapper) > span:last-child {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px;
  padding-left: 0 !important;
}

.modal-form :deep(.ant-radio-wrapper) svg {
  flex-shrink: 0;
}

/* 复选框对齐 */
.modal-form :deep(.ant-checkbox-wrapper) {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px;
}

.modal-form :deep(.ant-checkbox-wrapper) > span:last-child {
  padding-left: 0 !important;
  line-height: 1.4;
}

/* Backup List */
.backup-list {
  max-height: 400px;
  overflow-y: auto;
}

.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--color-panel-gray);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
}

.backup-item:hover {
  border-color: var(--color-cyber-cyan);
}

.backup-info {
  flex: 1;
}

.backup-name {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.backup-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.backup-version {
  color: var(--color-terminal-green);
}

.backup-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.loading-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

/* Last check time */
.last-check-info {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
  margin-right: var(--spacing-md);
}
</style>
