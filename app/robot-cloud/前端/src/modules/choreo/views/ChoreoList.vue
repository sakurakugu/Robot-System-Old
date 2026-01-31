<template>
  <div class="choreo-list">
    <el-container>
      <el-aside width="60px" class="left-bar">
        <div class="left-bar-content">
          <div class="top-icons">
            <el-button class="left-icon" text>
              <el-icon><Folder /></el-icon>
            </el-button>
          </div>
          <div class="bottom-settings">
            <el-button class="settings-btn" text @click="openSettings" title="设置">
              <el-icon><Setting /></el-icon>
            </el-button>
          </div>
        </div>
      </el-aside>
      <el-container>
        <el-header>
          <div class="header-content">
            <h1>机器狗编舞系统</h1>
            <div class="header-actions">
              <el-radio-group v-model="viewMode" size="default">
                <el-radio-button value="grid">
                  <el-icon><Menu /></el-icon>
                  卡片
                </el-radio-button>
                <el-radio-button value="list">
                  <el-icon><List /></el-icon>
                  列表
                </el-radio-button>
              </el-radio-group>
              <el-button @click="handleImportClick">
                <el-icon class="import-btn"><Upload /></el-icon>
                导入工程
              </el-button>
              <el-button type="primary" @click="showCreateDialog = true">
                <el-icon><Plus /></el-icon>
                新建项目
              </el-button>
            </div>
          </div>
        </el-header>

        <el-main>
          <div v-if="loading" class="loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <p>加载中...</p>
          </div>

          <div v-else-if="projects.length === 0" class="empty">
            <el-empty description="暂无项目">
              <el-button type="primary" @click="showCreateDialog = true">创建第一个项目</el-button>
            </el-empty>
          </div>

          <div v-else class="projects-container">
            <div v-if="viewMode === 'grid'" class="projects-grid">
              <el-card
                v-for="project in projects"
                :key="project.uuid"
                class="project-card"
                shadow="hover"
                @click="openProject(project.uuid)"
              >
                <div class="project-thumbnail">
                  <el-icon><VideoPlay /></el-icon>
                </div>
                <div class="project-info">
                  <h3>{{ project.name }}</h3>
                  <p class="description">{{ project.description || '无描述' }}</p>
                  <div class="project-meta">
                    <span>创建于: {{ formatDate(project.created_at) }}</span>
                    <span v-if="project.updated_at">最后修改: {{ formatDate(project.updated_at) }}</span>
                  </div>
                </div>
                <div class="project-actions" @click.stop>
                  <el-dropdown trigger="click">
                    <el-button type="primary" size="small" circle>
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="editProject(project)">
                          <el-icon><Edit /></el-icon>
                          编辑
                        </el-dropdown-item>
                        <el-dropdown-item @click="exportProject(project)">
                          <el-icon><Download /></el-icon>
                          导出
                        </el-dropdown-item>
                        <el-dropdown-item divided @click="deleteProject(project)">
                          <el-icon><Delete /></el-icon>
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </el-card>
            </div>

            <div v-else class="projects-list">
              <el-card
                v-for="project in projects"
                :key="project.uuid"
                class="project-list-item"
                shadow="hover"
                @click="openProject(project.uuid)"
              >
                <div class="list-item-content">
                  <div class="list-item-icon">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                  <div class="list-item-info">
                    <h3>{{ project.name }}</h3>
                    <p class="description">{{ project.description || '无描述' }}</p>
                  </div>
                  <div class="list-item-meta">
                    <div class="meta-item">
                      <span class="meta-label">创建于</span>
                      <span class="meta-value">{{ formatDate(project.created_at) }}</span>
                    </div>
                    <div v-if="project.updated_at" class="meta-item">
                      <span class="meta-label">最后修改</span>
                      <span class="meta-value">{{ formatDate(project.updated_at) }}</span>
                    </div>
                  </div>
                  <div class="list-item-actions" @click.stop>
                    <el-button size="small" @click="editProject(project)">编辑</el-button>
                    <el-button type="danger" size="small" @click="deleteProject(project)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <!-- 隐藏的文件选择器 -->
    <input
      ref="fileInput"
      type="file"
      accept=".zip,.hhzip"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 创建/编辑项目对话框 -->
    <el-dialog v-model="showCreateDialog" :title="editingProject ? '编辑项目' : '创建新项目'" width="500px" @closed="resetForm">
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px">
        <el-form-item label="项目名称" prop="name" required>
          <el-input v-model="formData.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="项目描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入项目描述（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingProject ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Delete, Download, Edit, Folder, List, Loading, Menu, MoreFilled, Plus, Setting, Upload, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { choreoApi } from '../api'
import type { ChoreoProject, CreateProjectDto } from '../types'

const router = useRouter()
const projects = ref<ChoreoProject[]>([])
const loading = ref(false)
const showCreateDialog = ref(false)
const submitting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const viewMode = ref<'grid' | 'list'>('grid')
const editingProject = ref<ChoreoProject | null>(null)
const formRef = ref<FormInstance>()

const formData = reactive<CreateProjectDto>({
  name: '',
  description: ''
})

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 1, max: 50, message: '项目名称长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}

const openSettings = () => {
  router.push('/settings')
}

const loadProjects = async () => {
  loading.value = true
  try {
    const res = await choreoApi.getProjects()
    if (res.success) {
      projects.value = res.data
    }
  } catch (error) {
    ElMessage.error('加载项目列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (editingProject.value) {
      const res = await choreoApi.updateProject(editingProject.value.uuid, formData)
      if (res.success) {
        ElMessage.success('项目更新成功')
        showCreateDialog.value = false
        resetForm()
        await loadProjects()
      }
    } else {
      const res = await choreoApi.createProject(formData)
      if (res.success) {
        ElMessage.success('项目创建成功')
        showCreateDialog.value = false
        resetForm()
        await loadProjects()
        router.push(`/choreo/${res.data.uuid}`)
      }
    }
  } catch (error) {
    ElMessage.error(editingProject.value ? '更新项目失败' : '创建项目失败')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

const openProject = async (uuid: string) => {
  try {
    await choreoApi.openProject(uuid)
    router.push(`/choreo/${uuid}`)
  } catch (error) {
    ElMessage.error('打开项目失败')
    console.error(error)
  }
}

const editProject = (project: ChoreoProject) => {
  editingProject.value = project
  formData.name = project.name
  formData.description = project.description || ''
  showCreateDialog.value = true
}

const deleteProject = async (project: ChoreoProject) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目 "${project.name}" 吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await choreoApi.deleteProject(project.uuid)
    if (res.success) {
      ElMessage.success('项目已删除')
      await loadProjects()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除项目失败')
      console.error(error)
    }
  }
}

const exportProject = async (project: ChoreoProject) => {
  try {
    ElMessage.info('正在导出工程...')
    const blob = await choreoApi.exportProject(project.uuid)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name}.hhzip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('工程导出成功')
  } catch (error) {
    console.error('导出工程失败:', error)
    ElMessage.error('导出失败')
  }
}

const resetForm = () => {
  editingProject.value = null
  formData.name = ''
  formData.description = ''
  formRef.value?.resetFields()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const handleImportClick = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) {
    return
  }

  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.zip') && !fileName.endsWith('.hhzip')) {
    ElMessage.error('请选择 .zip 或 .hhzip 格式的工程文件')
    target.value = ''
    return
  }

  try {
    ElMessage.info('正在导入工程...')
    const res = await choreoApi.importProject(file)
    
    if (res.success) {
      ElMessage.success('工程导入成功')
      await loadProjects()
      router.push(`/choreo/${res.data.uuid}`)
    } else {
      ElMessage.error('工程导入失败')
    }
  } catch (error: any) {
    console.error('导入工程失败:', error)
    ElMessage.error(error.response?.data?.error || '工程导入失败')
  } finally {
    target.value = ''
  }
}

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.choreo-list {
  width: 100%;
  height: 100%;
  background: var(--el-bg-color-page);
}

.choreo-list > .el-container {
  height: 100%;
}

.left-bar {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  height: 100%;
}

.left-bar-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
}

.left-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

.bottom-settings {
  padding-bottom: 8px;
}

.settings-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

.el-header {
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  padding: 0 40px;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-actions .el-radio-group {
  margin-right: 20px;
}

.header-actions :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
  height: 32px;
  padding: 0 12px;
}

.header-actions :deep(.el-radio-button__inner .el-icon) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.header-actions .import-btn {
  margin-right: 8px;
}

.header-actions .el-button .el-icon {
  margin-right: 8px;
}

.header-content h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.el-main {
  padding: 40px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  font-size: 48px;
  color: var(--el-color-primary);
}

.loading p {
  margin-top: 20px;
  font-size: 16px;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.projects-container {
  width: 100%;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-card {
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.project-card:hover {
  transform: translateY(-5px);
}

.project-list-item {
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.project-list-item:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.15);
}

.list-item-content {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px;
}

.list-item-icon {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: rgba(255, 255, 255, 0.9);
}

.list-item-info {
  flex: 1;
  min-width: 0;
}

.list-item-info h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 5px;
  color: var(--el-text-color-primary);
}

.list-item-info .description {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-item-meta {
  display: flex;
  gap: 30px;
  flex-shrink: 0;
}

.meta-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.meta-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.meta-value {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.list-item-actions {
  flex-shrink: 0;
  margin-left: 20px;
}

.project-thumbnail {
  height: 150px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64px;
  color: rgba(255, 255, 255, 0.9);
  margin: -20px -20px 20px -20px;
  border-radius: 4px 4px 0 0;
}

.project-info h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}

.project-info .description {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
  min-height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.project-meta {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.project-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  opacity: 0;
  transition: opacity 0.3s;
}

.project-card:hover .project-actions {
  opacity: 1;
}
</style>
