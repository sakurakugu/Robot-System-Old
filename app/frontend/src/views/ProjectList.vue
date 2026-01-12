<template>
  <div class="project-list">
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
            <h1>机器狗管理系统</h1>
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
                  <el-icon><Folder /></el-icon>
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
                  <el-button type="danger" size="small" @click="deleteProject(project)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
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
                    <el-icon><Folder /></el-icon>
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

    <!-- 创建项目对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建新项目" width="500px">
      <el-form :model="newProject" label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input v-model="newProject.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input
            v-model="newProject.description"
            type="textarea"
            :rows="3"
            placeholder="请输入项目描述（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createProject" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { projectApi, type Project } from '../api/project'

const router = useRouter()
const projects = ref<Project[]>([])
const loading = ref(false)
const showCreateDialog = ref(false)
const creating = ref(false)
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const viewMode = ref<'grid' | 'list'>('grid')
const newProject = ref({
  name: '',
  description: ''
})

const openSettings = () => {
  router.push('/settings')
}

const loadProjects = async () => {
  loading.value = true
  try {
    const res = await projectApi.getProjects()
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

const createProject = async () => {
  if (!newProject.value.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }

  creating.value = true
  try {
    const res = await projectApi.createProject(newProject.value)
    if (res.success) {
      ElMessage.success('项目创建成功')
      showCreateDialog.value = false
      newProject.value = { name: '', description: '' }
      await loadProjects()
      // 自动打开新项目
      router.push(`/project/${res.data.uuid}`)
    }
  } catch (error) {
    ElMessage.error('创建项目失败')
    console.error(error)
  } finally {
    creating.value = false
  }
}

const openProject = async (uuid: string) => {
  try {
    await projectApi.openProject(uuid)
    router.push(`/project/${uuid}`)
  } catch (error) {
    ElMessage.error('打开项目失败')
    console.error(error)
  }
}

const deleteProject = async (project: Project) => {
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

    const res = await projectApi.deleteProject(project.uuid)
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

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const handleImportClick = () => {
  // 选择 .zip 或 .hhzip 文件
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

  // 检查文件扩展名
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.zip') && !fileName.endsWith('.hhzip')) {
    ElMessage.error('请选择 .zip 或 .hhzip 格式的工程文件')
    target.value = ''
    return
  }

  try {
    importing.value = true
    ElMessage.info('正在导入工程...')

    // 调用导入API
    const res = await projectApi.importProject(file)
    
    if (res.success) {
      ElMessage.success('工程导入成功')
      await loadProjects()
      // 自动打开导入的项目
      router.push(`/project/${res.data.uuid}`)
    } else {
      ElMessage.error('工程导入失败')
    }
  } catch (error: any) {
    console.error('导入工程失败:', error)
    ElMessage.error(error.response?.data?.error || '工程导入失败')
  } finally {
    importing.value = false
    target.value = ''
  }
}

onMounted(() => {
  loadProjects()
})

</script>

<style scoped>
.project-list {
  width: 100%;
  height: 100%;
  background: var(--el-bg-color-page);
}

.project-list > .el-container {
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

.header-actions .el-radio-button__inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
  height: 32px;
  padding: 0 12px;
}

.header-actions .el-radio-button__inner .el-icon {
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
