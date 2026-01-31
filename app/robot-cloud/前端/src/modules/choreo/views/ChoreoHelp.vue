<template>
  <div class="help-page">
    <div class="page-header">
      <el-button text @click="goBack" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>帮助</h2>
    </div>
    <div class="content">
      <el-card class="help-card">
        <template #header>
          <div class="card-header">
            <el-icon><QuestionFilled /></el-icon>
            <span>快速入门</span>
          </div>
        </template>
        <el-collapse v-model="activeNames">
          <el-collapse-item title="如何创建编舞项目？" name="1">
            <p>1. 在编舞列表页面点击"新建项目"按钮</p>
            <p>2. 输入项目名称和描述</p>
            <p>3. 点击"创建"完成项目创建</p>
          </el-collapse-item>
          <el-collapse-item title="如何添加机器人？" name="2">
            <p>1. 进入编舞编辑器</p>
            <p>2. 在左侧面板点击"添加机器人"</p>
            <p>3. 从已配置的机器人列表中选择</p>
            <p>4. 机器人将被添加到项目中</p>
          </el-collapse-item>
          <el-collapse-item title="如何创建动作轨道？" name="3">
            <p>1. 在时间轴编辑器中点击"动作轨道"按钮</p>
            <p>2. 新的动作轨道将被添加到时间轴</p>
            <p>3. 为轨道绑定对应的机器人</p>
            <p>4. 点击轨道上的"+"按钮添加动作块</p>
          </el-collapse-item>
          <el-collapse-item title="如何添加音频？" name="4">
            <p>1. 点击"音频轨道"按钮添加音频轨道</p>
            <p>2. 在轨道上点击上传音频文件</p>
            <p>3. 音频将自动与时间轴同步播放</p>
          </el-collapse-item>
          <el-collapse-item title="如何执行编舞？" name="5">
            <p>1. 确保所有动作轨道都绑定了机器人</p>
            <p>2. 点击右上角的"执行"按钮</p>
            <p>3. 机器人将按照时间轴执行动作</p>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <el-card class="help-card">
        <template #header>
          <div class="card-header">
            <el-icon><SetUp /></el-icon>
            <span>快捷键</span>
          </div>
        </template>
        <el-table :data="shortcuts" stripe>
          <el-table-column prop="key" label="快捷键" width="150" />
          <el-table-column prop="description" label="功能" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, QuestionFilled, SetUp } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeNames = ref(['1'])

const shortcuts = [
  { key: 'Ctrl + S', description: '保存项目' },
  { key: 'Ctrl + Z', description: '撤销' },
  { key: 'Ctrl + Shift + Z', description: '重做' },
  { key: 'Space', description: '播放/暂停' },
  { key: 'Delete', description: '删除选中的动作块' },
  { key: '↑ / ↓', description: '缩放时间轴' },
  { key: '← / →', description: '移动播放头' },
]

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.help-page {
  padding: 24px;
  color: var(--el-text-color-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.help-card {
  background: var(--el-bg-color);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

:deep(.el-collapse-item__header) {
  font-weight: 500;
}

:deep(.el-collapse-item__content) {
  color: var(--el-text-color-secondary);
  line-height: 1.8;
}

:deep(.el-collapse-item__content p) {
  margin: 4px 0;
}
</style>
