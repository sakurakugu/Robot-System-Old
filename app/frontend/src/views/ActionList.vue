<template>
  <div class="action-list-container">
    <div class="action-list-content">
      <el-collapse v-model="activePanels">
        <el-collapse-item title="基础动作" name="basic">
          <div class="actions-grid">
            <div
              v-for="action in basicActions"
              :key="action.method"
              class="action-card"
            >
              <div class="action-icon">🐕</div>
              <div class="action-info">
                <div class="action-name">{{ action.name }}</div>
                <div class="action-desc">{{ action.description }}</div>
                <div class="action-method">{{ action.method }}</div>
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item title="姿态控制" name="attitude">
          <div class="actions-grid">
            <div
              v-for="action in attitudeActions"
              :key="action.method"
              class="action-card"
            >
              <div class="action-icon">🎯</div>
              <div class="action-info">
                <div class="action-name">{{ action.name }}</div>
                <div class="action-desc">{{ action.description }}</div>
                <div class="action-method">{{ action.method }}</div>
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item title="移动" name="movement">
          <div class="actions-grid">
            <div
              v-for="action in movementActions"
              :key="action.method"
              class="action-card"
            >
              <div class="action-icon">🏃</div>
              <div class="action-info">
                <div class="action-name">{{ action.name }}</div>
                <div class="action-desc">{{ action.description }}</div>
                <div class="action-method">{{ action.method }}</div>
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item title="特技" name="tricks">
          <div class="actions-grid">
            <div
              v-for="action in trickActions"
              :key="action.method"
              class="action-card"
            >
              <div class="action-icon">⭐</div>
              <div class="action-info">
                <div class="action-name">{{ action.name }}</div>
                <div class="action-desc">{{ action.description }}</div>
                <div class="action-method">{{ action.method }}</div>
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item title="自定义动作" name="custom">
          <div class="actions-grid">
            <div
              v-for="action in customActions"
              :key="action.uuid"
              class="action-card"
            >
              <div class="action-icon">🧩</div>
              <div class="action-info">
                <div class="action-name">{{ action.name }}</div>
                <div class="action-desc">{{ action.description || '无描述' }}</div>
                <div class="action-method">自定义</div>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { projectApi } from '@/api/project'
import {
  basicActions,
  attitudeActions,
  movementActions,
  trickActions
} from '../data/robotActions'

const activePanels = ref<string[]>(['basic', 'attitude', 'movement', 'tricks', 'custom'])
const customActions = ref<any[]>([])
const route = useRoute()

onMounted(async () => {
  const projectUuid = route.params.uuid as string
  if (!projectUuid) return
  try {
    const res = await projectApi.getCustomActions(projectUuid)
    if (res.success) {
      customActions.value = res.data || []
    }
  } catch (e) {
    customActions.value = []
  }
})
</script>

<style scoped>
.action-list-container {
  padding: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #252526;
  color: #cccccc;
}

.action-list-content {
  flex: 1;
  overflow-y: auto;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  padding: 8px;
}

.action-card {
  display: flex;
  align-items: center;
  padding: 10px;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  background: #2d2d30;
  transition: all 0.2s;
  color: #cccccc;
}

.action-card:hover {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  border-color: #409eff;
  transform: translateY(-1px);
  background: #37373d;
}

.action-icon {
  font-size: 24px;
  margin-right: 10px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2d2e;
  border-radius: 6px;
}

.action-info {
  flex: 1;
}

.action-name {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 11px;
  color: #a0a0a0;
  margin-bottom: 4px;
  line-height: 1.4;
}

.action-method {
  font-size: 11px;
  color: #9aa0a6;
  font-family: monospace;
  background: #2a2d2e;
  padding: 2px 4px;
  border-radius: 3px;
  display: inline-block;
}

:deep(.el-collapse) {
  --el-collapse-border-color: #3c3c3c;
  --el-collapse-header-bg-color: #252526;
  --el-collapse-content-bg-color: #252526;
  --el-collapse-text-color: #cccccc;
}

:deep(.el-collapse-item__header) {
  color: #cccccc;
}

:deep(.el-collapse-item__wrap) {
  background: #252526;
  border-bottom-color: #3c3c3c;
}
</style>
