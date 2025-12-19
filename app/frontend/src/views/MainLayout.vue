<template>
  <div class="main-layout">
    <el-container class="root-container">
      <!-- 顶部工具栏 -->
      <el-header class="toolbar">
        <div class="toolbar-left">
          <el-button @click="goBack" text size="small">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <div class="menu-items">
            <el-dropdown trigger="click" @command="handleFileCommand" popper-class="run-dropdown-popper">
              <div class="menu-item">
                文件
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="export">导出</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click" @command="handleEditCommand" popper-class="run-dropdown-popper">
              <div class="menu-item">
                编辑
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="save">保存</el-dropdown-item>
                  <el-dropdown-item command="save-as-action">保存为自定义动作</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click" @command="handleViewCommand" popper-class="run-dropdown-popper">
              <div class="menu-item">
                视图
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="show-editor">显示编辑页面</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click" @command="handleRunCommand" popper-class="run-dropdown-popper">
              <div class="menu-item">
                运行
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="build">封装</el-dropdown-item>
                  <el-dropdown-item command="run">运行</el-dropdown-item>
                  <el-dropdown-item command="build-and-run">封装并运行</el-dropdown-item>
                  <el-dropdown-item command="stop" divided :disabled="!currentExecutionId">停止</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click" @command="handleHelpCommand" popper-class="run-dropdown-popper">
              <div class="menu-item">
                帮助
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="open-help">打开帮助</el-dropdown-item>
                  <el-dropdown-item command="about">关于</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
              :class="{ active: activeView === 'history' }"
              @click="toggleView('history')"
              title="历史记录"
            >
              <el-icon><Clock /></el-icon>
            </div>
            <div 
              class="activity-icon" 
              :class="{ active: activeView === 'actions' }"
              @click="toggleView('actions')"
              title="动作列表"
            >
              <el-icon><VideoPlay /></el-icon>
            </div>
          </div>
        </div>

        <!-- 左侧面板 -->
        <el-aside v-show="showLeftPanel" width="250px" class="left-panel">
          <div class="panel-header">
            <h3>{{ getPanelTitle }}</h3>
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
          <div v-show="activeView === 'explorer'" class="file-explorer">
            <el-tree
              :data="fileTree"
              :props="treeProps"
              node-key="path"
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
          <div v-show="activeView === 'robots'" class="robot-list">
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
          
          <!-- 动作列表 -->
          <div v-show="activeView === 'actions'" class="action-list-panel">
            <ActionList />
          </div>

          <!-- 历史记录容器 -->
          <div v-show="activeView === 'history'" id="history-panel-container" class="history-container">
            <!-- TimelineEditor 将会 Teleport 到这里 -->
            <el-empty v-if="!hasActiveEditor" description="无活动编辑器" />
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
            <div v-if="tabs.length === 0" class="empty-state">
              <div class="empty-content">
                <el-icon class="empty-icon"><Monitor /></el-icon>
                <p>没有打开的编辑器</p>
                <p class="sub-text">请从左侧资源管理器打开文件或使用菜单栏打开视图</p>
              </div>
            </div>
            <router-view v-else v-slot="{ Component }">
              <keep-alive>
                <component 
                  :is="Component" 
                  ref="routerViewRef"
                  :key="$route.fullPath"
                  :robots="robots"
                  :selectedRobot="selectedRobot"
                  :initialContent="fileContent"
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
import { ref, computed, watch, markRaw, onMounted, onUnmounted, nextTick, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Close, EditPen, Menu, Bottom, Grid, Setting, Plus, Monitor, Folder, Refresh, Document, FolderOpened, ArrowDown, QuestionFilled, InfoFilled, Clock, VideoPlay } from '@element-plus/icons-vue'
import TimelineEditor from '@/components/timeline/TimelineEditor.vue'
import ActionList from './ActionList.vue'
import { projectApi } from '@/api/project'
import { wsClient } from '@/services/websocket'

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
  } else if (route.name === 'FileEditor') {
    // 这里需要根据查询参数找到对应的标签ID
    // 我们可以遍历 tabs 找到 route 匹配的 tab
    const currentTab = tabs.value.find(t => t.route === route.fullPath)
    if (currentTab) {
      return currentTab.id
    }
    // 如果找不到精确匹配，尝试模糊匹配（因为 query 参数顺序可能不同）
    const fileName = route.query.name
    if (fileName) {
      // 注意：这里假设文件名是唯一的，或者我们需要更复杂的逻辑来匹配路径
      // 由于我们之前用 file-${path} 作为 ID，但这里只拿到了文件名，所以可能需要改进
      // 实际上，我们在创建 tab 时保存了 route，所以上面的精确匹配应该能工作
      // 如果不行，可能需要重新设计 tab ID 的生成方式或者路由参数传递方式
      
      // 尝试从 tabs 中找到 label 匹配的
      const tab = tabs.value.find(t => t.label === fileName)
      return tab ? tab.id : ''
    }
    return ''
  }
  return `editor-${projectUuid}`
})

// 当前项目名称
const currentProjectName = ref('项目编辑器')

// 侧栏显示状态
const showLeftPanel = ref(true)
const showBottomPanel = ref(true)
const showRightPanel = ref(false)
const activeView = ref<'explorer' | 'robots' | 'actions' | 'preview' | 'history' | null>('robots')

// 计算当前是否有活动编辑器
const hasActiveEditor = computed(() => {
  return tabs.value.length > 0 && activeTab.value
})

// 计算面板标题
const getPanelTitle = computed(() => {
  switch (activeView.value) {
    case 'explorer':
      return '资源管理器'
    case 'robots':
      return '机器人列表'
    case 'actions':
      return '动作列表'
    case 'history':
      return '历史记录'
    default:
      return ''
  }
})

// 当前执行ID
const currentExecutionId = ref<string | null>(null)

// 切换侧栏视图
const toggleView = (view: 'explorer' | 'robots' | 'actions' | 'preview' | 'history') => {
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

// 路由视图引用
const routerViewRef = ref<any>(null)

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
    
    if ((route.name === 'ProjectEditor' || route.name === 'RobotManager' || route.name === 'Help' || route.name === 'About') && projectUuid) {
      // 检查 query 参数，如果包含 empty=true，则不自动创建标签
      if (route.query.empty === 'true') {
        return
      }

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
      } else if (route.name === 'Help') {
        const tabId = `help-${projectUuid}`
        
        // 如果标签不存在，添加新标签
        const existingTab = tabs.value.find(tab => tab.id === tabId)
        if (!existingTab) {
          console.log('添加帮助标签:', tabId)
          tabs.value.push({
            id: tabId,
            label: '帮助',
            icon: markRaw(QuestionFilled),
            route: `/project/${projectUuid}/help`,
            closable: true
          })
        }
      } else if (route.name === 'About') {
        const tabId = `about-${projectUuid}`
        
        // 如果标签不存在，添加新标签
        const existingTab = tabs.value.find(tab => tab.id === tabId)
        if (!existingTab) {
          console.log('添加关于标签:', tabId)
          tabs.value.push({
            id: tabId,
            label: '关于',
            icon: markRaw(InfoFilled),
            route: `/project/${projectUuid}/about`,
            closable: true
          })
        }
      }
      
      console.log('更新后标签列表:', tabs.value.map(t => ({ id: t.id, label: t.label })))
    }
  },
  { immediate: true }
)

// WebSocket 消息监听器
const handleExecutionOutput = (data: any) => {
  if (data.output) {
    addLog(`[输出] ${data.output}`)
  }
}

const handleExecutionError = (data: any) => {
  if (data.error) {
    addLog(`[错误] ${data.error}`)
  }
}

const handleExecutionComplete = (data: any) => {
  addLog(`执行完成，退出码: ${data.code}`)
  if (data.code === 0) {
    ElMessage.success('执行成功')
  } else {
    ElMessage.error('执行失败')
  }
  // 清除当前执行ID
  currentExecutionId.value = null
}

// 组件挂载时设置WebSocket监听器
onMounted(() => {
  wsClient.on('execution_output', handleExecutionOutput)
  wsClient.on('execution_error', handleExecutionError)
  wsClient.on('execution_complete', handleExecutionComplete)
})

// 组件卸载时移除监听器
onUnmounted(() => {
  wsClient.off('execution_output', handleExecutionOutput)
  wsClient.off('execution_error', handleExecutionError)
  wsClient.off('execution_complete', handleExecutionComplete)
})

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
  logs.value.push(`[${timestamp}] ${message}`)
  if (logs.value.length > 100) {
    logs.value.shift()
  }
}

// 文件菜单命令处理
const handleFileCommand = async (command: string) => {
  if (command === 'export') {
    await exportProject()
  } else if (command === 'save') {
    await saveProject()
  }
}

// 编辑菜单命令处理
const handleEditCommand = (command: string) => {
  if (command === 'show-editor') {
    // 这里的逻辑可能需要调整，因为 show-editor 移到了视图菜单
    // 保持兼容性或根据需求移除
  } else if (command === 'save') {
    saveProject()
  } else if (command === 'save-as-action') {
    const projectUuid = route.params.uuid as string
    if (!projectUuid) return
    if (route.name !== 'ProjectEditor') {
      ElMessage.warning('请在项目编辑页面进行保存为动作')
      return
    }
    const name = window.prompt('输入自定义动作名称')
    if (!name) return
    const event = new CustomEvent('save-as-action', { detail: { projectUuid, name } })
    window.dispatchEvent(event)
  }
}

const handleViewCommand = (command: string) => {
  if (command === 'show-editor') {
    const projectUuid = route.params.uuid as string
    router.push({
      name: 'ProjectEditor',
      params: { uuid: projectUuid }
    })
  }
}

const handleHelpCommand = (command: string) => {
  const projectUuid = route.params.uuid as string
  if (command === 'open-help') {
    router.push({
      name: 'Help',
      params: { uuid: projectUuid }
    })
  } else if (command === 'about') {
    router.push({
      name: 'About',
      params: { uuid: projectUuid }
    })
  }
}

// 运行菜单命令处理
const handleRunCommand = async (command: string) => {
  const projectUuid = route.params.uuid as string
  if (!projectUuid) return

  try {
    if (command === 'build') {
      // 封装
      // 先校验项目
      const currentTab = tabs.value.find(t => t.id === activeTab.value)
      if (currentTab && currentTab.route.includes('/project/')) {
        // 如果在项目编辑页面，尝试获取编辑器组件实例进行校验
        // 这里需要一种方式获取到 ProjectEditor 的实例
        // 由于我们是在 router-view 中渲染组件，可以通过 ref 获取
        // 但这里我们简单起见，假设如果存在未绑定的机器狗，后端也会校验
        // 不过用户要求前端校验，我们需要在 router-view 上添加 ref
      }

      // 获取当前激活的组件实例
      const component = routerViewRef.value
      if (component && component.validate) {
        const validation = component.validate()
        if (!validation.valid) {
          ElMessage.warning(validation.message)
          return
        }
      }

      addLog('开始封装项目...')
      showBottomPanel.value = true
      const res = await projectApi.buildProject(projectUuid)
      if (res.success) {
        ElMessage.success('封装成功')
        addLog(`封装成功: ${res.data.pythonFile}`)
        addLog(`输出目录: ${res.data.buildPath}`)
      } else {
        ElMessage.error('封装失败')
        addLog('封装失败')
      }
    } else if (command === 'run') {
      // 运行
      addLog('开始运行项目...')
      showBottomPanel.value = true
      const res = await projectApi.runProject(projectUuid)
      console.log('运行项目响应:', res)
      if (res.success && res.data?.executionId) {
        currentExecutionId.value = res.data.executionId
        addLog(`执行ID: ${res.data.executionId}`)
        console.log('设置executionId:', currentExecutionId.value)
      } else {
        ElMessage.error('运行失败')
        addLog('运行失败')
      }
    } else if (command === 'build-and-run') {
      // 封装并运行
      // 校验
      const component = routerViewRef.value
      if (component && component.validate) {
        const validation = component.validate()
        if (!validation.valid) {
          ElMessage.warning(validation.message)
          return
        }
      }

      addLog('开始封装并运行项目...')
      showBottomPanel.value = true
      const res = await projectApi.buildAndRunProject(projectUuid)
      console.log('封装并运行响应:', res)
      if (res.success && res.data?.executionId) {
        currentExecutionId.value = res.data.executionId
        addLog(`执行ID: ${res.data.executionId}`)
        console.log('设置executionId:', currentExecutionId.value)
      } else {
        ElMessage.error('封装并运行失败')
        addLog('封装并运行失败')
      }
    } else if (command === 'stop') {
      // 停止执行
      if (!currentExecutionId.value) {
        ElMessage.warning('没有正在运行的任务')
        return
      }
      addLog('正在停止执行...')
      const res = await projectApi.stopExecution(projectUuid, currentExecutionId.value)
      if (res.success) {
        ElMessage.success('已停止执行')
        addLog('执行已停止')
        currentExecutionId.value = null
      } else {
        ElMessage.error('停止失败')
        addLog(`停止失败: ${res.message || ''}`)
      }
    }
  } catch (error: any) {
    console.error('运行命令失败:', error)
    ElMessage.error(error.message || '操作失败')
    addLog(`错误: ${error.message || '操作失败'}`)
  }
}

// 导出项目
const exportProject = async () => {
  const projectUuid = route.params.uuid as string
  if (!projectUuid) return
  
  try {
    ElMessage.info('正在导出工程...')
    const blob = await projectApi.exportProject(projectUuid)
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProjectName.value}.hhzip`
    document.body.appendChild(a)
    a.click()
    
    // 清理
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 保存项目
const saveProject = async () => {
  const projectUuid = route.params.uuid as string
  if (!projectUuid) return
  
  try {
    // 检查当前是否在项目编辑页面
    if (route.name !== 'ProjectEditor') {
      ElMessage.warning('请在项目编辑页面进行保存')
      return
    }
    
    ElMessage.info('正在保存...')
    
    // 通过事件总线通知子组件保存
    // 由于我们需要直接访问ProjectEditor组件，这里使用window自定义事件
    const saveEvent = new CustomEvent('save-project', {
      detail: { projectUuid }
    })
    window.dispatchEvent(saveEvent)
    
    // 给子组件一点时间处理保存
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 然后调用后端保存API
    const res = await projectApi.saveProject(projectUuid)
    if (res.success) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error('保存失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
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
      // 没有其他标签，不返回项目列表，而是保持在当前路由但不显示内容（或显示空状态）
      // 这里我们可以跳转到一个专门的空状态路由，或者仅仅是不做任何跳转（但需要处理路由视图的显示）
      // 考虑到MainLayout是父路由，子路由控制中间内容区
      // 我们可以让activeTab为空，并且不进行路由跳转到其他页面，而是跳转到一个空页面或者不做处理
      // 但由于router-view依赖路由，如果路径还是/project/:uuid，那么默认子路由ProjectEditor会被激活
      // 除非我们定义一个专门的空子路由，或者我们在MainLayout中控制router-view的显示
      
      // 简单的做法：如果不跳转回首页，我们可能需要一个"空"的子路由来显示"没有打开的编辑器"
      // 或者我们可以简单地不跳转，让用户手动去打开文件或视图
      // 但当前路由配置下，/project/:uuid 对应 ProjectEditor
      // 所以如果我们要关闭所有标签但保留在项目内，我们需要一种状态来表示"无编辑器打开"
      
      // 方案：当没有标签时，我们可以将路由推到一个特定的 query 参数或者不做任何操作但隐藏 router-view
      // 但更好的体验可能是显示一个"空状态"组件
      // 这里我们暂时不做路由跳转，只清空 activeTab
      activeTab.value = ''
      
      // 如果当前路由是某个具体的功能页（如机器人管理），关闭后应该去哪里？
      // 如果关闭的是最后一个标签，我们可以留在一个空状态
      // 为了实现这一点，我们需要确保 router-view 不显示内容，或者显示空内容
      // 由于 vue-router 的机制，如果 URL 匹配，组件就会渲染
      // 所以我们可以控制 router-view 的显示
      
      // 如果是最后一个标签被关闭，且它是 ProjectEditor，那么路由本身就是 /project/:uuid
      // 这会导致它被重新创建（因为我们有 watcher 监听路由变化自动添加标签）
      // 这就是为什么之前会"自动打开"或者"关闭整个工程"（因为之前的逻辑是跳转回首页）
      
      // 现在的需求是：关闭编辑页面（标签），不关闭整个工程（不跳转回首页）
      // 我们可以尝试跳转到一个 dummy 路由，或者修改 watcher 逻辑不自动添加标签（如果是由关闭操作触发的）
      
      // 这里我们简单地跳转到一个不存在的子路径，或者保持当前路径但通过状态控制显示
      // 但最简单且符合习惯的是：不做路由跳转（如果已经是当前项目路径），但清空 activeTab
      // 并且在 watcher 中添加逻辑：如果是因为关闭标签导致的路由变化或状态变化，不要自动重新打开标签
      
      // 但问题是：如果路由还是 /project/:uuid，ProjectEditor 组件依然挂载
      // 我们可以在 MainLayout 中增加一个变量控制是否显示 router-view
      
      // 或者，更简单的：
      // 不要跳转回首页
      // 如果 tabs 为空，我们可以显示一个 Empty 状态
      
      router.push({ path: `/project/${projectUuid}`, query: { empty: 'true' } })
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

const fileContent = ref('')

// 处理文件点击
const handleFileClick = async (data: any) => {
  if (!data.isDirectory) {
    const projectUuid = route.params.uuid as string
    
    // 如果是文本文件，尝试打开
    // 这里简单通过扩展名判断是否是文本文件
    const textExtensions = ['.txt', '.json', '.js', '.ts', '.py', '.md', '.html', '.css', '.vue']
    const isTextFile = textExtensions.some(ext => data.name.endsWith(ext))
    
    if (isTextFile) {
      try {
        const res = await projectApi.getFileContent(projectUuid, data.path)
        if (res.success) {
          fileContent.value = res.data
          
          const tabId = `file-${data.path}`
          
          // 如果标签不存在，添加新标签
          const existingTab = tabs.value.find(tab => tab.id === tabId)
          if (!existingTab) {
            tabs.value.push({
              id: tabId,
              label: data.name,
              icon: markRaw(Document),
              route: `/project/${projectUuid}/file?name=${encodeURIComponent(data.name)}`,
              closable: true
            })
          }
          
          // 跳转到文件编辑页
          // 注意：这里我们需要通过 state 传递内容，因为内容可能很大不适合放在 URL 参数中
          // 但是 vue-router 的 state 在刷新后会丢失，所以理想情况是再次请求
          // 这里为了简化，我们通过 params 传递（需要在路由配置中支持）或者通过 store/props 传递
          router.push({
            name: 'FileEditor',
            params: { 
              uuid: projectUuid,
              content: res.data 
            },
            query: {
              name: data.name
            }
          })
          
          // 更新激活的标签
          // activeTab 是计算属性，依赖路由，所以路由跳转后会自动更新
        }
      } catch (error) {
        console.error('读取文件失败:', error)
        ElMessage.error('读取文件失败')
      }
    } else {
      ElMessage.info(`点击了文件: ${data.name}`)
    }
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
  align-items: center;
}

.menu-item {
  padding: 4px 12px;
  font-size: 13px;
  color: #cccccc;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.menu-item:hover {
  background: #505050;
}

/* 下拉菜单样式 */
:deep(.el-dropdown) {
  display: flex;
  align-items: center;
}

:deep(.el-dropdown .menu-item) {
  margin: 0;
}

:deep(.el-icon--right) {
  margin-left: 0;
  font-size: 12px;
}

/* 运行下拉菜单深色主题 */
.run-dropdown-popper {
  background: #252526 !important;
  border: 1px solid #3c3c3c !important;
  padding: 4px 0 !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5) !important;
}

.run-dropdown-popper .el-dropdown-menu {
  background: #252526 !important;
  border: 1px solid #3c3c3c !important;
  box-shadow: none !important;
}

.run-dropdown-popper .el-dropdown-menu__item {
  color: #cccccc !important;
  font-size: 13px !important;
  padding: 8px 20px !important;
  transition: background 0.2s !important;
}

.run-dropdown-popper .el-dropdown-menu__item:hover {
  background: #2a2d2e !important;
  color: #ffffff !important;
}

.run-dropdown-popper .el-dropdown-menu__item.is-disabled {
  color: #666666 !important;
  cursor: not-allowed !important;
}

.run-dropdown-popper .el-dropdown-menu__item.is-disabled:hover {
  background: transparent !important;
  color: #666666 !important;
}

/* Popper箭头样式 */
.run-dropdown-popper .el-popper__arrow::before {
  background: #252526 !important;
  border: 1px solid #3c3c3c !important;
}

/* 覆盖Element Plus的默认白色边框 */
:global(.run-dropdown-popper) {
  border-color: #3c3c3c !important;
}

:global(.run-dropdown-popper .el-dropdown-menu) {
  border-color: #3c3c3c !important;
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
  min-height: 0;
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
  height: 100%;
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
  min-height: 0;
}

/* 侧边栏样式 */
.left-panel,
.right-panel {
  background: #252526;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.left-panel {
  min-height: 0;
  overflow-y: auto !important;
}

.right-panel {
  border-right: none;
  border-left: 1px solid #3c3c3c;
  min-height: 0;
  overflow: hidden;
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
  min-height: 0;
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
  min-height: 0;
}

.history-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
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

.action-list-panel {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

/* 中间内容区 */
.center-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.root-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 0;
  background: #1e1e1e;
  min-height: 0;
}

/* 空状态样式 */
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e1e;
  color: #cccccc;
}

.empty-content {
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  color: #3c3c3c;
  margin-bottom: 20px;
}

.sub-text {
  font-size: 13px;
  color: #666;
  margin-top: 10px;
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
  height: 100%;
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
