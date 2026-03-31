<template>
  <div class="page">
    <PageHeader
      title="更新管理"
      :icon="UploadFilled"
    />

    <div class="content">
      <!-- ==================== APP 安装包 / 机器狗包上传 ==================== -->
      <el-row :gutter="16">
        <el-col
          :xs="24"
          :lg="12"
        >
          <el-card
            shadow="hover"
            class="card"
          >
            <template #header>
              <div class="card-header">
                <span>APP 安装包上传</span>
              </div>
            </template>

            <el-form
              :model="uploadForm"
              label-width="96px"
              label-position="left"
            >
              <el-form-item label="版本号">
                <el-input
                  v-model="uploadForm.version"
                  placeholder="例如 1.0.1"
                />
              </el-form-item>

              <el-form-item label="自动编码">
                <el-input-number
                  v-model="uploadForm.versionCode"
                  :min="1"
                  style="width: 100%"
                  readonly
                  :controls="false"
                />
              </el-form-item>

              <el-form-item label="发布渠道">
                <el-radio-group v-model="uploadForm.channel">
                  <el-radio value="stable">
                    稳定版
                  </el-radio>
                  <el-radio value="beta">
                    测试版
                  </el-radio>
                </el-radio-group>
              </el-form-item>

              <el-form-item label="更新日志">
                <el-input
                  v-model="uploadForm.changelog"
                  type="textarea"
                  :rows="4"
                  placeholder="填写本次更新内容（可选）"
                />
              </el-form-item>

              <el-form-item label="安装包">
                <el-upload
                  ref="uploadRef"
                  v-model:file-list="fileList"
                  :auto-upload="false"
                  :show-file-list="true"
                  :limit="1"
                  :on-change="handleFileChange"
                  :on-remove="handleFileRemove"
                  accept=".apk"
                >
                  <el-button
                    type="primary"
                    plain
                  >
                    选择 APK 文件
                  </el-button>
                  <template #tip>
                    <div class="upload-tip">
                      仅支持 .apk 文件，上传后自动设为该渠道最新版本
                    </div>
                  </template>
                </el-upload>
                <div
                  v-if="currentSelectedFile"
                  class="selected-file"
                >
                  已选择：{{ currentSelectedFile.name }}（{{ formatSize(currentSelectedFile.size) }}）
                </div>
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :loading="uploading"
                  @click="submitUpload"
                >
                  上传安装包
                </el-button>
                <el-button @click="resetUploadForm">
                  重置
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <el-col
          :xs="24"
          :lg="12"
        >
          <el-card
            shadow="hover"
            class="card"
          >
            <template #header>
              <div class="card-header">
                <span>机器狗包上传</span>
              </div>
            </template>

            <el-form
              :model="pkgForm"
              label-width="96px"
              label-position="left"
            >
              <el-form-item label="版本号">
                <el-input
                  v-model="pkgForm.version"
                  placeholder="例如 1.0.1"
                />
              </el-form-item>

              <el-form-item label="自动编码">
                <el-input-number
                  v-model="pkgForm.versionCode"
                  :min="1"
                  style="width: 100%"
                  readonly
                  :controls="false"
                />
              </el-form-item>

              <el-form-item label="发布渠道">
                <el-radio-group v-model="pkgForm.channel">
                  <el-radio value="stable">
                    稳定版
                  </el-radio>
                  <el-radio value="beta">
                    测试版
                  </el-radio>
                </el-radio-group>
              </el-form-item>

              <el-form-item label="更新日志">
                <el-input
                  v-model="pkgForm.changelog"
                  type="textarea"
                  :rows="2"
                  placeholder="填写本次更新内容（可选）"
                />
              </el-form-item>

              <el-form-item label="robot-agent">
                <el-upload
                  ref="agentUploadRef"
                  v-model:file-list="agentFileList"
                  :auto-upload="false"
                  :show-file-list="true"
                  :limit="1"
                  :on-change="(f: UploadFile) => handlePkgFileChange(f, 'agent')"
                  :on-remove="() => handlePkgFileRemove('agent')"
                  accept=".gz,.tgz"
                >
                  <el-button plain>
                    选择文件
                  </el-button>
                </el-upload>
                <div
                  v-if="pkgFiles.agent"
                  class="selected-file"
                >
                  {{ pkgFiles.agent.name }}（{{ formatSize(pkgFiles.agent.size) }}）
                </div>
              </el-form-item>

              <el-form-item label="robot-server">
                <el-upload
                  ref="serverUploadRef"
                  v-model:file-list="serverFileList"
                  :auto-upload="false"
                  :show-file-list="true"
                  :limit="1"
                  :on-change="(f: UploadFile) => handlePkgFileChange(f, 'server')"
                  :on-remove="() => handlePkgFileRemove('server')"
                  accept=".gz,.tgz"
                >
                  <el-button plain>
                    选择文件
                  </el-button>
                </el-upload>
                <div
                  v-if="pkgFiles.server"
                  class="selected-file"
                >
                  {{ pkgFiles.server.name }}（{{ formatSize(pkgFiles.server.size) }}）
                </div>
              </el-form-item>

              <el-form-item label="sparkrobot-common">
                <el-upload
                  ref="commonUploadRef"
                  v-model:file-list="commonFileList"
                  :auto-upload="false"
                  :show-file-list="true"
                  :limit="1"
                  :on-change="(f: UploadFile) => handlePkgFileChange(f, 'common')"
                  :on-remove="() => handlePkgFileRemove('common')"
                  accept=".gz,.tgz"
                >
                  <el-button plain>
                    选择文件
                  </el-button>
                </el-upload>
                <div
                  v-if="pkgFiles.common"
                  class="selected-file"
                >
                  {{ pkgFiles.common.name }}（{{ formatSize(pkgFiles.common.size) }}）
                </div>
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :loading="pkgUploading"
                  :disabled="!hasPkgFiles"
                  @click="submitPkgUpload"
                >
                  上传包
                </el-button>
                <el-button @click="resetPkgForm">
                  重置
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>

      <el-card
        shadow="hover"
        class="card table-card"
      >
        <template #header>
          <div class="card-header table-header">
            <span>APP 版本列表</span>
            <div class="table-actions">
              <el-select
                v-model="queryChannel"
                placeholder="渠道筛选"
                style="width: 120px"
                @change="loadVersions"
              >
                <el-option
                  label="全部"
                  value="all"
                />
                <el-option
                  label="稳定版"
                  value="stable"
                />
                <el-option
                  label="测试版"
                  value="beta"
                />
              </el-select>
              <el-button
                :icon="Refresh"
                circle
                @click="loadVersions"
              />
            </div>
          </div>
        </template>

        <el-table
          v-loading="loadingVersions"
          :data="versions"
          border
          stripe
        >
          <el-table-column
            label="版本"
            min-width="120"
          >
            <template #default="{ row }">
              <el-tooltip
                placement="top"
                :content="String(row.versionCode)"
              >
                <span>{{ versionCodeToSemver(row.versionCode) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column
            prop="versionCode"
            label="版本号"
            width="100"
          />
          <el-table-column
            label="渠道"
            width="100"
          >
            <template #default="{ row }">
              <el-tag :type="row.channel === 'stable' ? 'success' : 'warning'">
                {{ row.channel === 'stable' ? '稳定版' : '测试版' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="状态"
            width="90"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.isActive"
                type="primary"
              >
                当前
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            label="大小"
            width="110"
          >
            <template #default="{ row }">
              {{ formatSize(row.fileSize) }}
            </template>
          </el-table-column>
          <el-table-column
            label="上传时间"
            min-width="170"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.uploadedAt) }}
            </template>
          </el-table-column>
          <el-table-column
            label="更新日志"
            min-width="220"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.changelog || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="180"
            fixed="right"
          >
            <template #default="{ row }">
              <el-button
                size="small"
                type="warning"
                plain
                :disabled="row.isActive"
                @click="handleRollback(row.id)"
              >
                回滚到此版本
              </el-button>
              <el-popconfirm
                title="确认删除该版本吗？"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- ==================== 机器狗包版本列表 ==================== -->
      <el-card
        shadow="hover"
        class="card table-card"
      >
        <template #header>
          <div class="card-header table-header">
            <span>机器狗包版本列表</span>
            <div class="table-actions">
              <el-select
                v-model="pkgQueryChannel"
                placeholder="渠道筛选"
                style="width: 120px"
                @change="loadPkgVersions"
              >
                <el-option
                  label="全部"
                  value="all"
                />
                <el-option
                  label="稳定版"
                  value="stable"
                />
                <el-option
                  label="测试版"
                  value="beta"
                />
              </el-select>
              <el-button
                :icon="Refresh"
                circle
                @click="loadPkgVersions"
              />
            </div>
          </div>
        </template>

        <el-table
          v-loading="loadingPkgVersions"
          :data="pkgVersions"
          border
          stripe
        >
          <el-table-column
            label="版本"
            min-width="120"
          >
            <template #default="{ row }">
              <el-tooltip
                placement="top"
                :content="String(row.versionCode)"
              >
                <span>{{ versionCodeToSemver(row.versionCode) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column
            prop="versionCode"
            label="版本号"
            width="100"
          />
          <el-table-column
            label="渠道"
            width="100"
          >
            <template #default="{ row }">
              <el-tag :type="row.channel === 'stable' ? 'success' : 'warning'">
                {{ row.channel === 'stable' ? '稳定版' : '测试版' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="状态"
            width="90"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.isActive"
                type="primary"
              >
                当前
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            label="包含"
            min-width="220"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.agent"
                type="info"
                style="margin-right: 4px"
              >
                robot-agent
              </el-tag>
              <el-tag
                v-if="row.server"
                type="info"
                style="margin-right: 4px"
              >
                robot-server
              </el-tag>
              <el-tag
                v-if="row.common"
                type="info"
              >
                sparkrobot-common
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="总大小"
            width="110"
          >
            <template #default="{ row }">
              {{ formatSize(pkgTotalSize(row)) }}
            </template>
          </el-table-column>
          <el-table-column
            label="上传时间"
            min-width="170"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.uploadedAt) }}
            </template>
          </el-table-column>
          <el-table-column
            label="更新日志"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.changelog || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="180"
            fixed="right"
          >
            <template #default="{ row }">
              <el-button
                size="small"
                type="warning"
                plain
                :disabled="row.isActive"
                @click="handlePkgRollback(row.id)"
              >
                回滚到此版本
              </el-button>
              <el-popconfirm
                title="确认删除该版本吗？"
                @confirm="handlePkgDelete(row.id)"
              >
                <template #reference>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  deleteAppVersion,
  deleteRobotPackage,
  getAppVersions,
  getRobotPackageVersions,
  rollbackAppVersion,
  rollbackRobotPackage,
  uploadAppPackage,
  uploadRobotPackages,
} from '@/features/settings/api'
import type { AppVersionInfo, ReleaseChannel, RobotPackageInfo } from '@/features/settings/types'
import PageHeader from '@/share/components/PageHeader.vue'
import { formatDateTime } from '@/share/utils/date'
import { Refresh, UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile, UploadInstance, UploadUserFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { sha256 } from 'js-sha256'
import { computed, onMounted, reactive, ref, watch } from 'vue'

type QueryChannel = ReleaseChannel | 'all'
type PkgKey = 'agent' | 'server' | 'common'

/* ================================================================
   APK 上传相关
================================================================ */

const uploadForm = reactive({
  version: '',
  versionCode: 1,
  channel: 'stable' as ReleaseChannel,
  changelog: '',
})

const uploadRef = ref<UploadInstance>()
const fileList = ref<UploadUserFile[]>([])
const selectedFile = ref<File | null>(null)
const uploading = ref(false)

const versions = ref<AppVersionInfo[]>([])
const loadingVersions = ref(false)
const queryChannel = ref<QueryChannel>('all')

const currentSelectedFile = computed(() => {
  if (selectedFile.value) return selectedFile.value
  const fromList = fileList.value.find((item) => item.raw)?.raw as File | undefined
  return fromList || null
})

/* ================================================================
   机器狗包上传相关
================================================================ */

const pkgForm = reactive({
  version: '',
  versionCode: 1,
  channel: 'stable' as ReleaseChannel,
  changelog: '',
})

const agentUploadRef = ref<UploadInstance>()
const serverUploadRef = ref<UploadInstance>()
const commonUploadRef = ref<UploadInstance>()

const agentFileList = ref<UploadUserFile[]>([])
const serverFileList = ref<UploadUserFile[]>([])
const commonFileList = ref<UploadUserFile[]>([])

const pkgFiles = reactive<Record<PkgKey, File | null>>({
  agent: null,
  server: null,
  common: null,
})

const pkgUploading = ref(false)
const pkgVersions = ref<RobotPackageInfo[]>([])
const loadingPkgVersions = ref(false)
const pkgQueryChannel = ref<QueryChannel>('all')

const hasPkgFiles = computed(
  () => pkgFiles.agent !== null || pkgFiles.server !== null || pkgFiles.common !== null
)

/* ================================================================
   通用工具函数
================================================================ */

const semverToVersionCode = (version: string): number | null => {
  const m = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return null
  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3])
  if (minor > 999 || patch > 999) return null
  return major * 1000000 + minor * 1000 + patch
}

const versionCodeToSemver = (versionCode: number): string => {
  const safe = Math.max(0, Math.floor(Number(versionCode) || 0))
  const major = Math.floor(safe / 1000000)
  const minor = Math.floor((safe % 1000000) / 1000)
  const patch = safe % 1000
  return `${major}.${minor}.${patch}`
}

// 使用 js-sha256 包计算文件 SHA-256，兼容所有网络上下文（不依赖 crypto.subtle）
const fileToSha256 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const hash = sha256(e.target!.result as ArrayBuffer)
        resolve(hash)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const pkgTotalSize = (row: RobotPackageInfo): number =>
  (row.agent?.fileSize ?? 0) + (row.server?.fileSize ?? 0) + (row.common?.fileSize ?? 0)

/* ================================================================
   版本码自动计算（APK & 机器狗包各自独立监听）
================================================================ */

watch(
  () => uploadForm.version,
  (value) => {
    const code = semverToVersionCode(value)
    uploadForm.versionCode = code ?? 0
  },
  { immediate: true }
)

watch(
  () => pkgForm.version,
  (value) => {
    const code = semverToVersionCode(value)
    pkgForm.versionCode = code ?? 0
  },
  { immediate: true }
)

/* ================================================================
   APK 上传操作
================================================================ */

const handleFileChange = (file: UploadFile) => {
  selectedFile.value = (file.raw as File) || null
}

const handleFileRemove = () => {
  selectedFile.value = null
}

const resetUploadForm = () => {
  uploadForm.version = ''
  uploadForm.versionCode = 1
  uploadForm.channel = 'stable'
  uploadForm.changelog = ''
  selectedFile.value = null
  fileList.value = []
  uploadRef.value?.clearFiles()
}

const submitUpload = async () => {
  if (!uploadForm.version.trim()) {
    ElMessage.warning('请填写版本号（如 1.2.3）')
    return
  }
  if (!uploadForm.versionCode || uploadForm.versionCode < 1) {
    ElMessage.warning('版本号格式错误，请使用 x.y.z（如 1.2.3）')
    return
  }

  const file = currentSelectedFile.value
  if (!file) {
    ElMessage.warning('请先选择 APK 文件')
    return
  }

  try {
    uploading.value = true
    const fileHash = await fileToSha256(file)

    await uploadAppPackage({
      apk: file,
      version: uploadForm.version.trim(),
      versionCode: Number(uploadForm.versionCode),
      fileHash,
      channel: uploadForm.channel,
      changelog: uploadForm.changelog.trim() || undefined,
    })

    ElMessage.success('上传成功')
    resetUploadForm()
    await loadVersions()
  }
  finally {
    uploading.value = false
  }
}

const loadVersions = async () => {
  try {
    loadingVersions.value = true
    const channel = queryChannel.value === 'all' ? undefined : queryChannel.value
    const resp = await getAppVersions(channel)
    versions.value = resp.data || []
  }
  finally {
    loadingVersions.value = false
  }
}

const handleRollback = async (id: number) => {
  await rollbackAppVersion(id)
  ElMessage.success('回滚成功')
  await loadVersions()
}

const handleDelete = async (id: number) => {
  await deleteAppVersion(id)
  ElMessage.success('删除成功')
  await loadVersions()
}

/* ================================================================
   机器狗包上传操作
================================================================ */

const handlePkgFileChange = (file: UploadFile, key: PkgKey) => {
  pkgFiles[key] = (file.raw as File) || null
}

const handlePkgFileRemove = (key: PkgKey) => {
  pkgFiles[key] = null
}

const resetPkgForm = () => {
  pkgForm.version = ''
  pkgForm.versionCode = 1
  pkgForm.channel = 'stable'
  pkgForm.changelog = ''
  pkgFiles.agent = null
  pkgFiles.server = null
  pkgFiles.common = null
  agentFileList.value = []
  serverFileList.value = []
  commonFileList.value = []
  agentUploadRef.value?.clearFiles()
  serverUploadRef.value?.clearFiles()
  commonUploadRef.value?.clearFiles()
}

const submitPkgUpload = async () => {
  if (!pkgForm.version.trim()) {
    ElMessage.warning('请填写版本号（如 1.2.3）')
    return
  }
  if (!pkgForm.versionCode || pkgForm.versionCode < 1) {
    ElMessage.warning('版本号格式错误，请使用 x.y.z（如 1.2.3）')
    return
  }
  if (!hasPkgFiles.value) {
    ElMessage.warning('请至少选择一个包文件')
    return
  }

  try {
    pkgUploading.value = true

    // 并行计算各文件 SHA-256 哈希
    const [agentHash, serverHash, commonHash] = await Promise.all([
      pkgFiles.agent ? fileToSha256(pkgFiles.agent) : Promise.resolve(null),
      pkgFiles.server ? fileToSha256(pkgFiles.server) : Promise.resolve(null),
      pkgFiles.common ? fileToSha256(pkgFiles.common) : Promise.resolve(null),
    ])

    await uploadRobotPackages({
      version: pkgForm.version.trim(),
      versionCode: Number(pkgForm.versionCode),
      channel: pkgForm.channel,
      changelog: pkgForm.changelog.trim() || undefined,
      agent: pkgFiles.agent && agentHash ? { file: pkgFiles.agent, hash: agentHash } : undefined,
      server: pkgFiles.server && serverHash ? { file: pkgFiles.server, hash: serverHash } : undefined,
      common: pkgFiles.common && commonHash ? { file: pkgFiles.common, hash: commonHash } : undefined,
    })

    ElMessage.success('上传成功')
    resetPkgForm()
    await loadPkgVersions()
  }
  finally {
    pkgUploading.value = false
  }
}

const loadPkgVersions = async () => {
  try {
    loadingPkgVersions.value = true
    const channel = pkgQueryChannel.value === 'all' ? undefined : pkgQueryChannel.value
    const resp = await getRobotPackageVersions(channel)
    pkgVersions.value = resp.data || []
  }
  finally {
    loadingPkgVersions.value = false
  }
}

const handlePkgRollback = async (id: number) => {
  await rollbackRobotPackage(id)
  ElMessage.success('回滚成功')
  await loadPkgVersions()
}

const handlePkgDelete = async (id: number) => {
  await deleteRobotPackage(id)
  ElMessage.success('删除成功')
  await loadPkgVersions()
}

onMounted(() => {
  loadVersions()
  loadPkgVersions()
})
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.upload-tip {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
}

.selected-file {
  margin-top: 8px;
  color: var(--el-color-success);
}

.table-card {
  width: 100%;
}

.table-header {
  gap: 12px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
