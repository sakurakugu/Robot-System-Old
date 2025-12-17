<template>
  <div class="main-layout">
    <el-container>
      <!-- 顶部工具栏 -->
      <el-header class="toolbar">
        <div class="toolbar-left">
          <el-button @click="goBack" text size="small">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <div class="menu-items">
            <div class="menu-item">文件</div>
            <div class="menu-item">编辑</div>
            <div class="menu-item">视图</div>
            <div class="menu-item">运行</div>
            <div class="menu-item">帮助</div>
          </div>
        </div>
        <div class="toolbar-center">
          <span class="project-title">{{ currentProjectName }}</span>
        </div>
        <div class="toolbar-right">
          <el-button-group class="panel-toggles">
            <el-button :type="showLeftPanel ? 'primary' : ''" size="small" @click="showLeftPanel = !showLeftPanel">
              <el-icon><Menu /></el-icon>
              左侧栏
            </el-button>
            <el-button :type="showBottomPanel ? 'primary' : ''" size="small" @click="showBottomPanel = !showBottomPanel">
              <el-icon><Bottom /></el-icon>
              底栏
            </el-button>
            <el-button :type="showRightPanel ? 'primary' : ''" size="small" @click="showRightPanel = !showRightPanel">
              <el-icon><Grid /></el-icon>
              右侧栏
            </el-button>
          </el-button-group>
          <el-button size="small" @click="exportProject">导出</el-button>
          <el-button size="small" type="primary" @click="saveProject">保存</el-button>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-container class="main-container">
        <!-- 左侧活动栏 -->
        <div class="activity-bar">
          <div class="activity-icons">
            <div 
              class="activity-icon" 
              :class="{ active: activeView === 'explorer' }"
              @click="toggleView('explorer')"
              title="资源管理器"
            >
              <el-icon><Folder /></el-icon>
            </div>
            <div 
              class="activity-icon" 
              :class="{ active: activeView === 'robots' }"
              @click="toggleView('robots')"
              title="机器人列表"
            >
              <el-icon><Setting /></el-icon>
            </div>
            <div 
              class="activity-icon" 
              :class="{ active: activeView === 'preview' }"
              @click="toggleView('preview')"
              title="预览"
            >
              <el-icon><Monitor /></el-icon>
            </div>
          </div>
        </div>

        <!-- 左侧面板 -->
        <el-aside v-show="showLeftPanel" width="250px" class="left-panel">
          <div class="panel-header">
            <h3>{{ activeView === 'explorer' ? '资源管理器' : '机器人列表' }}</h3>
            <div class="header-actions" v-if="activeView === 'robots'">
              <el-button size="small" @click="goToRobotManager">
                <el-icon><Setting /></el-icon>
              </el-button>
              <el-button size="small" @click="showAddRobotDialog = true">
                <el-icon><Plus /></el-icon>
              </el-button>
            </div>
            <div class="header-actions" v-if="activeView === 'explorer'">
              <el-button size="small" @click="refreshFileTree">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </div>
          
          <!-- 文件浏览器 -->
          <div v-if="activeView === 'explorer'" class="file-explorer">
            <el-tree
              :data="fileTree"
              :props="treeProps"
              node-key="path"
              default-expand-all
              :expand-on-click-node="false"
              @node-click="handleFileClick"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <el-icon class="node-icon">
                    <component :is="getFileIcon(data)" />
                  </el-icon>
                  <span class="node-label">{{ node.label }}</span>
                </div>
              </template>
            </el-tree>
            <el-empty v-if="!fileTree || fileTree.length === 0" description="暂无文件" :image-size="60" />
          </div>
          
          <!-- 机器人列表 -->
          <div v-if="activeView === 'robots'" class="robot-list">
            <div
              v-for="robot in robots"
              :key="robot.uuid"
              class="robot-item"
              :class="{ active: selectedRobot === robot.uuid }"
              @click="selectRobot(robot.uuid)"
            >
              <div class="robot-status" :class="robot.status"></div>
              <span class="robot-name">{{ robot.name }}</span>
            </div>
            <el-empty v-if="robots.length === 0" description="暂无机器人" />
          </div>
        </el-aside>

        <!-- 中间内容区 -->
        <el-container class="center-container">
          <!-- 标签栏 -->
          <div v-show="tabs.length > 0" class="tab-bar">
            <div class="tab-list">
              <div
                v-for="tab in tabs"
                :key="tab.id"
                class="tab-item"
                :class="{ active: activeTab === tab.id }"
                @click="switchTab(tab.id)"
              >
                <el-icon class="tab-icon">
                  <component :is="tab.icon" />
                </el-icon>
                <span class="tab-label">{{ tab.label }}</span>
                <el-icon
                  v-if="tab.closable"
                  class="tab-close"
                  @click.stop="closeTab(tab.id)"
                >
                  <Close />
                </el-icon>
              </div>
            </div>
          </div>

          <el-main class="content-area">
            <router-view v-slot="{ Component }">
              <keep-alive>
                <component 
                  :is="Component" 
                  :key="$route.fullPath"
                  :robots="robots"
                  :selectedRobot="selectedRobot"
                  @update:logs="updateLogs"
                />
              </keep-alive>
            </router-view>
          </el-main>

          <!-- 底部日志面板 -->
          <div v-show="showBottomPanel" class="bottom-panel">
            <div class="panel-header">
              <h3>日志</h3>
              <div class="header-actions">
                <el-button size="small" @click="clearLogs">清除</el-button>
                <el-button size="small" @click="showBottomPanel = false">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="logs-content">
              <div v-for="(log, index) in logs" :key="index" class="log-item">
                {{ log }}
              </div>
              <p v-if="logs.length === 0" class="empty-logs">暂无日志</p>
            </div>
          </div>
        </el-container>

        <!-- 右侧预览面板 -->
        <el-aside v-show="showRightPanel" width="300px" class="right-panel">
          <div class="panel-header">
            <h3>实时预览</h3>
          </div>
          <div class="preview-content">
            <div class="preview-placeholder">
              <el-icon style="font-size: 64px"><Monitor /></el-icon>
              <p>机器人状态预览</p>
            </div>
          </div>
        </el-aside>
      </el-container>

      <!-- 底部状态栏 -->
      <div class="status-bar">
        <div class="status-left">
          <span class="status-item">就绪</span>
          <span class="status-item">机器人: {{ robots.length }}</span>
        </div>
        <div class="status-right">
          <!-- <span class="status-item">{{ currentProjectName }}</span> -->
        </div>
      </div>
    </el-container>

    <!-- 添加机器人对话框 -->
    <el-dialog v-model="showAddRobotDialog" title="添加机器人" width="500px">
      <el-form :model="newRobot" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="newRobot.name" placeholder="例如: 131" />
        </el-form-item>
        <el-form-item label="机器人IP" required>
          <el-input v-model="newRobot.robot_ip" placeholder="例如: 192.168.0.2" />
        </el-form-item>
        <el-form-item label="本地IP" required>
          <el-input v-model="newRobot.local_ip" placeholder="例如: 192.168.0.214" />
        </el-form-item>
        <el-form-item label="本地端口" required>
          <el-input v-model.number="newRobot.local_port" placeholder="例如: 10131" />
        </el-form-item>
        <el-form-item label="分组">
          <el-input v-model="newRobot.group_name" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRobotDialog = false">取消</el-button>
        <el-button type="primary" @click="addRobot">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Close, EditPen, Menu, Bottom, Grid, Setting, Plus, Monitor, Folder, Refresh, Document, FolderOpened } from '@element-plus/icons-vue'
import { projectApi } from '@/api/project'

interface Tab {
  id: string
  label: string
  icon: any
  route: string
  closable: boolean
}

const route = useRoute()
const router = useRouter()

// 标签列表
const tabs = ref<Tab[]>([])

// 当前激活的标签
const activeTab = computed(() => {
  const projectUuid = route.params.uuid as string
  if (!projectUuid) return ''
  
  if (route.name === 'RobotManager') {
    return `robots-${projectUuid}`
  }
  return `editor-${projectUuid}`
})

// 当前项目名称
const currentProjectName = ref('项目编辑器')

// 侧栏显示状态
const showLeftPanel = ref(true)
const showBottomPanel = ref(true)
const showRightPanel = ref(false)
const activeView = ref<'explorer' | 'robots' | 'preview' | null>('robots')

// 切换侧栏视图
const toggleView = (view: 'explorer' | 'robots' | 'preview') => {
  if (view === 'preview') {
    // 预览视图只控制右侧面板
    if (activeView.value === 'preview') {
      showRightPanel.value = !showRightPanel.value
      if (!showRightPanel.value) {
        activeView.value = null
      }
    } else {
      activeView.value = 'preview'
      showRightPanel.value = true
    }
  } else {
    // explorer 和 robots 视图只控制左侧面板
    if (activeView.value === view) {
      // 如果点击的是当前激活的视图，关闭左侧面板
      showLeftPanel.value = !showLeftPanel.value
      if (!showLeftPanel.value) {
        activeView.value = null
      }
    } else {
      // 切换到新视图
      activeView.value = view
      showLeftPanel.value = true
    }
  }
}

// 机器人相关
const robots = ref<any[]>([])
const selectedRobot = ref<string | null>(null)
const showAddRobotDialog = ref(false)
const newRobot = ref({
  name: '',
  robot_ip: '',
  local_ip: '',
  local_port: 10000,
  group_name: ''
})

// 日志
const logs = ref<string[]>([])

// 文件树相关
const fileTree = ref<any[]>([])
const treeProps = {
  label: 'name',
  children: 'children',
  isLeaf: (data: any) => !data.isDirectory
}

// 加载项目信息
const loadProject = async (projectUuid: string) => {
  try {
    const res = await projectApi.getProject(projectUuid)
    if (res.success) {
      currentProjectName.value = res.data.name
    }
  } catch (error) {
    console.error('加载项目失败:', error)
  }
}

// 加载机器人列表
const loadRobots = async (projectUuid: string) => {
  try {
    const res = await projectApi.getRobots(projectUuid)
    if (res.success) {
      robots.value = res.data || []
    }
  } catch (error) {
    console.error('加载机器人列表失败:', error)
  }
}

// 监听路由变化，自动添加标签
watch(
  () => route.path,
  async () => {
    const projectUuid = route.params.uuid as string
    
    console.log('路由变化:', route.name, route.path, projectUuid)
    console.log('当前标签数量:', tabs.value.length)
    
    if ((route.name === 'ProjectEditor' || route.name === 'RobotManager') && projectUuid) {
      // 加载项目信息
      await loadProject(projectUuid)
      
      console.log('项目名称:', currentProjectName.value)
      
      // 加载机器人列表
      await loadRobots(projectUuid)
      
      // 加载文件树
      await loadFileTree(projectUuid)
      
      if (route.name === 'ProjectEditor') {
        const tabId = `editor-${projectUuid}`
        
        // 如果标签不存在，添加新标签
        const existingTab = tabs.value.find(tab => tab.id === tabId)
        if (!existingTab) {
          console.log('添加编辑标签:', tabId)
          tabs.value.push({
            id: tabId,
            label: currentProjectName.value,
            icon: markRaw(EditPen),
            route: `/project/${projectUuid}`,
            closable: true
          })
        } else {
          // 更新现有标签的名称
          console.log('更新编辑标签:', tabId)
          existingTab.label = currentProjectName.value
        }
      } else if (route.name === 'RobotManager') {
        const tabId = `robots-${projectUuid}`
        
        // 如果标签不存在，添加新标签
        const existingTab = tabs.value.find(tab => tab.id === tabId)
        if (!existingTab) {
          console.log('添加机器人管理标签:', tabId)
          tabs.value.push({
            id: tabId,
            label: `${currentProjectName.value} - 机器人管理`,
            icon: markRaw(Setting),
            route: `/project/${projectUuid}/robots`,
            closable: true
          })
        } else {
          // 更新现有标签的名称
          console.log('更新机器人管理标签:', tabId)
          existingTab.label = `${currentProjectName.value} - 机器人管理`
        }
      }
      
      console.log('更新后标签列表:', tabs.value.map(t => ({ id: t.id, label: t.label })))
    }
  },
  { immediate: true }
)

// 选择机器人
const selectRobot = (uuid: string) => {
  selectedRobot.value = uuid
}

// 添加机器人
const addRobot = async () => {
  const projectUuid = route.params.uuid as string
  try {
    const res = await projectApi.addRobot(projectUuid, newRobot.value)
    if (res.success) {
      ElMessage.success('添加机器人成功')
      showAddRobotDialog.value = false
      newRobot.value = {
        name: '',
        robot_ip: '',
        local_ip: '',
        local_port: 10000,
        group_name: ''
      }
      loadRobots(projectUuid)
    } else {
      ElMessage.error('添加机器人失败')
    }
  } catch (error) {
    ElMessage.error('添加机器人失败')
    console.error(error)
  }
}

// 前往机器人管理器
const goToRobotManager = () => {
  const projectUuid = route.params.uuid as string
  router.push(`/project/${projectUuid}/robots`)
}

// 日志相关
const updateLogs = (newLogs: string[]) => {
  logs.value = newLogs
}

const clearLogs = () => {
  logs.value = []
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN')
  logs.value.unshift(`[${timestamp}] ${message}`)
  if (logs.value.length > 100) {
    logs.value.pop()
  }
}

// 导出项目
const exportProject = () => {
  ElMessage.info('导出功能开发中...')
}

// 保存项目
const saveProject = () => {
  // 触发子组件保存
  ElMessage.info('保存功能开发中...')
}

// 切换标签
const switchTab = (tabId: string) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab && tab.route !== route.path) {
    router.push(tab.route)
  }
}

// 关闭标签
const closeTab = (tabId: string) => {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  const closingTab = tabs.value[index]
  const projectUuid = route.params.uuid as string
  
  // 移除标签
  tabs.value.splice(index, 1)

  // 如果关闭的是当前标签，需要切换到其他页面
  if (tabId === activeTab.value) {
    // 如果关闭的是机器人管理页，返回到同一项目的编辑页
    if (closingTab.id.startsWith('robots-') && projectUuid) {
      // 检查是否存在编辑标签
      const editorTab = tabs.value.find(t => t.id === `editor-${projectUuid}`)
      if (editorTab) {
        // 如果存在编辑标签，跳转到编辑页
        router.push(editorTab.route)
      } else {
        // 如果不存在编辑标签，直接跳转到编辑页面（会自动创建标签）
        router.push(`/project/${projectUuid}`)
      }
      return
    }
    
    // 否则切换到其他标签或返回项目列表
    if (tabs.value.length > 0) {
      // 切换到上一个或下一个标签
      const nextIndex = index > 0 ? index - 1 : 0
      router.push(tabs.value[nextIndex].route)
    } else {
      // 没有其他标签，返回项目列表
      router.push('/')
    }
  }
}

// 返回项目列表
const goBack = () => {
  router.push('/')
}

// 获取文件图标
const getFileIcon = (data: any) => {
  if (data.isDirectory) {
    return markRaw(FolderOpened)
  }
  return markRaw(Document)
}

// 加载文件树
const loadFileTree = async (projectUuid: string) => {
  try {
    const res = await projectApi.getProjectFiles(projectUuid)
    if (res.success) {
      fileTree.value = res.data || []
    }
  } catch (error) {
    console.error('加载文件树失败:', error)
  }
}

// 刷新文件树
const refreshFileTree = () => {
  const projectUuid = route.params.uuid as string
  if (projectUuid) {
    loadFileTree(projectUuid)
  }
}

// 处理文件点击
const handleFileClick = (data: any) => {
  if (!data.isDirectory) {
    ElMessage.info(`点击了文件: ${data.name}`)
    // TODO: 打开文件编辑器
  }
}
</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #1e1e1e;
}

/* 顶部工具栏 */
.toolbar {
  height: 38px !important;
  background: #2d2d30;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 菜单项 */
.menu-items {
  display: flex;
  gap: 5px;
}

.menu-item {
  padding: 4px 12px;
  font-size: 13px;
  color: #cccccc;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #505050;
}

.project-title {
  font-size: 13px;
  color: #cccccc;
  font-weight: 400;
}

.panel-toggles {
  display: flex;
  gap: 0;
  margin-right: 10px;
}

.panel-toggles .el-button {
  font-size: 12px;
  padding: 5px 12px;
}

/* 主容器 */
.main-container {
  flex: 1;
  overflow: hidden;
}

/* 左侧活动栏 */
.activity-bar {
  width: 48px;
  background: #333333;
  border-right: 1px solid #2d2d30;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-shrink: 0;
}

.activity-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 5px;
}

.activity-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #858585;
  font-size: 24px;
  transition: all 0.2s;
  position: relative;
  border-left: 2px solid transparent;
}

.activity-icon:hover {
  color: #ffffff;
}

.activity-icon.active {
  color: #ffffff;
  border-left-color: #007acc;
}

.activity-icon.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #007acc;
}

/* VS Code 风格标签栏 */
.tab-bar {
  height: 35px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
}

.tab-bar::-webkit-scrollbar {
  height: 3px;
}

.tab-bar::-webkit-scrollbar-thumb {
  background: #424242;
}

.tab-list {
  display: flex;
  align-items: center;
  height: 100%;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 12px;
  background: #2d2d30;
  color: #969696;
  cursor: pointer;
  user-select: none;
  transition: all 0.1s;
  border-right: 1px solid #252526;
  position: relative;
  flex-shrink: 0;
}

.tab-item:hover {
  background: #2a2d2e;
  color: #cccccc;
}

.tab-item.active {
  background: #1e1e1e;
  color: #ffffff;
  border-bottom: 2px solid #007acc;
}

.tab-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tab-label {
  font-size: 13px;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  font-size: 16px;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
}

.tab-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab-item:hover .tab-close,
.tab-item.active .tab-close {
  opacity: 0.7;
}

.tab-close:hover {
  opacity: 1 !important;
}

/* 主容器 */
.main-container {
  flex: 1;
  overflow: hidden;
}

/* 侧边栏样式 */
.left-panel,
.right-panel {
  background: #252526;
  border-right: 1px solid #3c3c3c;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.right-panel {
  border-right: none;
  border-left: 1px solid #3c3c3c;
}

.panel-header {
  padding: 12px 15px;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: #2d2d30;
}

.panel-header h3 {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  color: #cccccc;
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  gap: 5px;
}

/* 机器人列表 */
.robot-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.robot-list::-webkit-scrollbar {
  width: 10px;
}

.robot-list::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

/* 文件浏览器 */
.file-explorer {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.file-explorer::-webkit-scrollbar {
  width: 10px;
}

.file-explorer::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.node-icon {
  font-size: 16px;
  color: #cccccc;
  flex-shrink: 0;
}

.node-label {
  font-size: 13px;
  color: #cccccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-tree) {
  background: transparent;
  color: #cccccc;
}

:deep(.el-tree-node__content) {
  height: 28px;
  padding: 0 8px;
  border-radius: 3px;
  background: transparent;
}

:deep(.el-tree-node__content:hover) {
  background: #2a2d2e;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #094771;
}

:deep(.el-tree-node__expand-icon) {
  color: #cccccc;
  font-size: 12px;
}

.robot-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 4px;
  background: #2d2d30;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  color: #cccccc;
}

.robot-item:hover {
  background: #37373d;
}

.robot-item.active {
  background: #094771;
  color: #ffffff;
}

.robot-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}

.robot-status.connected {
  background: #4ec9b0;
}

.robot-status.disconnected {
  background: #f48771;
}

.robot-name {
  font-size: 13px;
  flex: 1;
}

/* 中间内容区 */
.center-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 0;
  background: #1e1e1e;
}

/* 底部面板 */
.bottom-panel {
  height: 200px;
  background: #252526;
  border-top: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 15px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.logs-content::-webkit-scrollbar {
  width: 10px;
}

.logs-content::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

.log-item {
  padding: 2px 0;
  color: #cccccc;
  line-height: 1.5;
}

.empty-logs {
  color: #666;
  text-align: center;
  margin-top: 20px;
}

/* 预览面板 */
.preview-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.preview-placeholder {
  background: #1e1e1e;
  border: 2px dashed #3c3c3c;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: #666;
}

/* 底部状态栏 */
.status-bar {
  height: 22px;
  background: #007acc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  flex-shrink: 0;
  font-size: 12px;
  color: #ffffff;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Element Plus 样式覆盖 */
:deep(.el-aside) {
  overflow: hidden;
}

:deep(.el-button) {
  background: #0e639c;
  border-color: #0e639c;
  color: #fff;
}

:deep(.el-button:hover) {
  background: #1177bb;
  border-color: #1177bb;
}

:deep(.el-button--primary) {
  background: #0e639c;
  border-color: #0e639c;
}

:deep(.el-button--primary:hover) {
  background: #1177bb;
  border-color: #1177bb;
}
</style>
