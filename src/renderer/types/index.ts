// 版本信息
export interface VersionInfo {
  versionCode: string
  releaseTime: string
  updateContent: string
  md5?: string
}

// 打包配置
export interface PackConfig {
  id?: string
  templateName?: string
  sourcePath: string
  outputPath: string
  packageName: string
  packageType: 'zip' | 'folder'
  fileTypes: string[]
  createdAt?: Date
  updatedAt?: Date
}

// 检测路径
export interface CheckPath {
  id: string
  type: 'local' | 'cloud'
  path: string
  enabled: boolean
}

// 更新设置
export interface UpdateSettings {
  id?: string
  checkPaths: CheckPath[]
  checkStrategy: 'manual' | 'auto'
  checkCycle: number
  backupPath: string
  notifyOnce: boolean
  updatedAt?: Date
}

// 更新日志
export interface UpdateLog {
  id?: string
  timestamp: Date
  fromVersion: string
  toVersion: string
  result: 'success' | 'failed' | 'rollback'
  errorMessage?: string
}

// 打包进度
export interface PackageProgress {
  stage: string
  percent: number
}

// 更新检测结果
export interface UpdateCheckResult {
  path: string
  versionInfo: VersionInfo
}

// 菜单项
export interface MenuItem {
  key: string
  label: string
  icon?: string
  path?: string
  children?: MenuItem[]
}
