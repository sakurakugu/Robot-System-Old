<template>
  <div class="project-list">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>🐕 机器狗控制系统</h1>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建项目
          </el-button>
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

        <div v-else class="projects-grid">
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
                <span v-if="project.last_opened">最后打开: {{ formatDate(project.last_opened) }}</span>
              </div>
            </div>
            <div class="project-actions" @click.stop>
              <el-button type="danger" size="small" @click="deleteProject(project)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </el-card>
        </div>
      </el-main>
    </el-container>

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
const newProject = ref({
  name: '',
  description: ''
})

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

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.project-list {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
}

.el-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
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

.header-content h1 {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
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
  color: #409eff;
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

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.project-card {
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.project-card:hover {
  transform: translateY(-5px);
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
  color: #303133;
}

.project-info .description {
  font-size: 14px;
  color: #909399;
  margin-bottom: 10px;
  min-height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.project-meta {
  font-size: 12px;
  color: #c0c4cc;
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
