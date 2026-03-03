<template>
  <div class="page">
    <PageHeader
      title="更新管理"
      :icon="UploadFilled"
    />

    <div class="content">
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
                <span>机器狗更新</span>
              </div>
            </template>

            <el-empty description="预留区域：后续支持机器狗固件/资源包更新管理" />
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
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import {
    deleteAppVersion,
    getAppVersions,
    rollbackAppVersion,
    uploadAppPackage,
} from '@/modules/settings/api'
import type { AppVersionInfo, ReleaseChannel } from '@/modules/settings/types'
import { formatDateTime } from '@/utils/date'
import { Refresh, UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile, UploadInstance, UploadUserFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

type QueryChannel = ReleaseChannel | 'all'

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

const fileToSha256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

watch(
  () => uploadForm.version,
  (value) => {
    const code = semverToVersionCode(value)
    uploadForm.versionCode = code ?? 0
  },
  { immediate: true }
)

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

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

onMounted(() => {
  loadVersions()
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
