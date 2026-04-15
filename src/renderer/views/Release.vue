<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { 
  FolderOpen, 
  Package, 
  FileCode, 
  Save,
  Play,
  ExternalLink
} from 'lucide-vue-next'
import { db } from '../database'
import type { PackConfig } from '../types'

// 默认文件类型
const defaultFileTypes = ['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot']

// 表单数据
const formData = reactive({
  sourcePath: '',
  outputPath: '',
  packageName: '',
  packageType: 'zip' as 'zip' | 'folder',
  versionCode: 'v1.0.0',
  updateContent: '',
  fileTypes: [...defaultFileTypes]
})

// 状态
const scanning = ref(false)
const packaging = ref(false)
const progress = ref({ stage: '', percent: 0 })
const scanResult = ref<{ files: string[]; totalSize: number } | null>(null)
const savedTemplates = ref<PackConfig[]>([])
const recentPaths = ref<string[]>([])

// 加载保存的模板和最近路径
onMounted(async () => {
  savedTemplates.value = await db.packConfigs.toArray()
  const paths = await db.recentPaths.where('type').equals('source').reverse().sortBy('usedAt')
  recentPaths.value = paths.slice(0, 5).map(p => p.path)
  
  // 监听打包进度
  if (window.electronAPI) {
    window.electronAPI.packager.onProgress((p) => {
      progress.value = p
    })
  }
})

// 选择源码文件夹
async function selectSourceFolder() {
  if (!window.electronAPI) return
  
  const path = await window.electronAPI.dialog.selectFolder()
  if (path) {
    formData.sourcePath = path
    // 自动设置包名
    const folderName = path.split(/[/\\]/).pop() || 'package'
    formData.packageName = folderName
    
    // 保存到最近路径
    await db.recentPaths.add({
      id: crypto.randomUUID(),
      path,
      type: 'source',
      usedAt: new Date()
    })
  }
}

// 选择输出路径
async function selectOutputFolder() {
  if (!window.electronAPI) return
  
  const path = await window.electronAPI.dialog.selectFolder()
  if (path) {
    formData.outputPath = path
  }
}

// 扫描文件
async function scanFiles() {
  if (!formData.sourcePath) {
    message.warning('请先选择源码文件夹')
    return
  }
  
  scanning.value = true
  scanResult.value = null
  
  try {
    const result = await window.electronAPI.packager.scanFolder(
      formData.sourcePath,
      formData.fileTypes
    )
    scanResult.value = result
    message.success(`扫描完成，共 ${result.files.length} 个文件`)
  } catch (error: any) {
    message.error(`扫描失败: ${error.message}`)
  } finally {
    scanning.value = false
  }
}

// 打开输出文件夹
async function openOutputFolder() {
  if (formData.outputPath && window.electronAPI) {
    await window.electronAPI.app.showInFolder(formData.outputPath)
  }
}

// 一键打包
async function startPackaging() {
  // 验证表单
  if (!formData.sourcePath) {
    message.warning('请选择源码文件夹')
    return
  }
  if (!formData.outputPath) {
    message.warning('请选择输出路径')
    return
  }
  if (!formData.packageName) {
    message.warning('请输入软件包名称')
    return
  }
  if (!formData.versionCode) {
    message.warning('请输入版本号')
    return
  }
  
  packaging.value = true
  progress.value = { stage: '准备中...', percent: 0 }
  
  try {
    const result = await window.electronAPI.packager.createPackage({
      sourcePath: formData.sourcePath,
      outputPath: formData.outputPath,
      packageName: formData.packageName,
      packageType: formData.packageType,
      versionInfo: {
        versionCode: formData.versionCode,
        releaseTime: new Date().toISOString(),
        updateContent: formData.updateContent
      },
      fileTypes: formData.fileTypes
    })
    
    if (result.success) {
      Modal.success({
        title: '打包成功',
        content: `软件包已生成: ${result.outputPath}`,
        okText: '打开输出路径',
        onOk: () => {
          window.electronAPI.app.showInFolder(result.outputPath)
        }
      })
    } else {
      message.error(`打包失败: ${result.error}`)
    }
  } catch (error: any) {
    message.error(`打包失败: ${error.message}`)
  } finally {
    packaging.value = false
    progress.value = { stage: '', percent: 0 }
  }
}

// 保存为模板
async function saveAsTemplate() {
  const name = formData.packageName || '未命名模板'
  
  await db.packConfigs.add({
    templateName: name,
    sourcePath: formData.sourcePath,
    outputPath: formData.outputPath,
    packageName: formData.packageName,
    packageType: formData.packageType,
    fileTypes: formData.fileTypes,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  
  savedTemplates.value = await db.packConfigs.toArray()
  message.success('模板已保存')
}

// 加载模板
function loadTemplate(template: PackConfig) {
  formData.sourcePath = template.sourcePath
  formData.outputPath = template.outputPath
  formData.packageName = template.packageName
  formData.packageType = template.packageType
  formData.fileTypes = template.fileTypes
  message.success('模板已加载')
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// 切换文件类型
function toggleFileType(type: string) {
  const index = formData.fileTypes.indexOf(type)
  if (index > -1) {
    formData.fileTypes.splice(index, 1)
  } else {
    formData.fileTypes.push(type)
  }
}
</script>

<template>
  <div class="release-page">
    <h1 class="geek-title">SOFTWARE RELEASE</h1>
    
    <!-- 源码文件夹 -->
    <div class="geek-card">
      <div class="card-header">
        <span class="card-title">
          <FolderOpen :size="18" />
          SOURCE FOLDER
        </span>
        <a-dropdown v-if="savedTemplates.length > 0">
          <a-button size="small">
            加载模板
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item 
                v-for="tpl in savedTemplates" 
                :key="tpl.id"
                @click="loadTemplate(tpl)"
              >
                {{ tpl.templateName }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
      
      <div class="form-row">
        <label class="form-label">$ path:</label>
        <div class="input-group">
          <a-input 
            v-model:value="formData.sourcePath" 
            placeholder="选择或输入源码文件夹路径"
            :disabled="packaging"
          />
          <a-button @click="selectSourceFolder" :disabled="packaging">
            浏览
          </a-button>
        </div>
      </div>
      
      <div class="form-row">
        <label class="form-label">文件类型:</label>
        <div class="file-types">
          <span 
            v-for="type in defaultFileTypes" 
            :key="type"
            class="file-type-tag"
            :class="{ active: formData.fileTypes.includes(type) }"
            @click="toggleFileType(type)"
          >
            {{ type }}
          </span>
        </div>
      </div>
      
      <div class="form-actions">
        <a-button @click="scanFiles" :loading="scanning" :disabled="packaging">
          <FileCode :size="16" />
          扫描文件
        </a-button>
        <span v-if="scanResult" class="scan-result">
          共 {{ scanResult.files.length }} 个文件，{{ formatSize(scanResult.totalSize) }}
        </span>
      </div>
    </div>
    
    <!-- 打包配置 -->
    <div class="geek-card">
      <div class="card-header">
        <span class="card-title">
          <Package :size="18" />
          PACKAGE CONFIG
        </span>
      </div>
      
      <div class="form-grid">
        <div class="form-row">
          <label class="form-label">$ version:</label>
          <a-input 
            v-model:value="formData.versionCode" 
            placeholder="v1.0.0"
            :disabled="packaging"
          />
        </div>
        
        <div class="form-row">
          <label class="form-label">$ name:</label>
          <a-input 
            v-model:value="formData.packageName" 
            placeholder="软件包名称"
            :disabled="packaging"
          />
        </div>
        
        <div class="form-row full-width">
          <label class="form-label">$ output:</label>
          <div class="input-group">
            <a-input 
              v-model:value="formData.outputPath" 
              placeholder="选择输出路径"
              :disabled="packaging"
            />
            <a-button @click="selectOutputFolder" :disabled="packaging">
              浏览
            </a-button>
          </div>
        </div>
        
        <div class="form-row">
          <label class="form-label">$ format:</label>
          <a-radio-group v-model:value="formData.packageType" :disabled="packaging">
            <a-radio value="zip">ZIP</a-radio>
            <a-radio value="folder">FOLDER</a-radio>
          </a-radio-group>
        </div>
        
        <div class="form-row full-width">
          <label class="form-label">$ update_content:</label>
          <a-textarea 
            v-model:value="formData.updateContent" 
            placeholder="本次更新的内容说明..."
            :rows="3"
            :disabled="packaging"
          />
        </div>
      </div>
      
      <div class="form-actions">
        <a-button @click="saveAsTemplate" :disabled="packaging">
          <Save :size="16" />
          保存为模板
        </a-button>
      </div>
    </div>
    
    <!-- 进度区域 -->
    <div class="progress-section" v-if="packaging || progress.percent > 0">
      <div class="progress-bar">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
        </div>
        <span class="progress-percent">{{ progress.percent }}%</span>
      </div>
      <div class="progress-stage">{{ progress.stage }}</div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="action-buttons">
      <a-button 
        type="primary" 
        size="large"
        @click="startPackaging"
        :loading="packaging"
      >
        <Play :size="18" v-if="!packaging" />
        > START PACKAGING_
      </a-button>
      
      <a-button 
        size="large"
        @click="openOutputFolder"
        :disabled="!formData.outputPath"
      >
        <ExternalLink :size="18" />
        OPEN OUTPUT
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.release-page {
  max-width: 900px;
  margin: 0 auto;
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-row.full-width {
  grid-column: span 2;
}

.form-label {
  color: var(--color-cyber-cyan);
  font-size: 12px;
  font-family: var(--font-mono);
}

.input-group {
  display: flex;
  gap: var(--spacing-sm);
}

.input-group .ant-input {
  flex: 1;
}

.file-types {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.file-type-tag {
  padding: 4px 8px;
  background: var(--color-panel-gray);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.file-type-tag:hover {
  border-color: var(--color-cyber-cyan);
  color: var(--color-cyber-cyan);
}

.file-type-tag.active {
  background: rgba(0, 255, 136, 0.1);
  border-color: var(--color-terminal-green);
  color: var(--color-terminal-green);
}

.form-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-dark);
}

.scan-result {
  color: var(--color-text-secondary);
  font-size: 13px;
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

.action-buttons .ant-btn-primary {
  min-width: 200px;
}

.action-buttons .ant-btn svg {
  margin-right: var(--spacing-xs);
}
</style>
