<template>
  <div
    class="robot-settings"
    :class="{ 'is-embedded': props.embedded }"
  >
    <el-page-header
      v-if="!props.embedded"
      class="page-header"
      @back="() => router.push('/robots')"
    >
      <template #content>
        <div class="header-content">
          <el-icon :size="24">
            <Bot />
          </el-icon>
          <span class="title">机器人设置</span>
        </div>
      </template>
      <template #extra>
        <el-popconfirm
          title="确定要解除绑定吗？此操作不可恢复。"
          confirm-button-text="确定"
          cancel-button-text="取消"
          confirm-button-type="danger"
          @confirm="handleUnbind"
        >
          <template #reference>
            <el-button
              type="danger"
              plain
            >
              解除绑定
            </el-button>
          </template>
        </el-popconfirm>
      </template>
    </el-page-header>

    <div
      v-loading="loading"
      class="content"
    >
      <el-tabs
        v-model="currentTab"
        tab-position="left"
        class="settings-tabs"
        :class="{ 'is-hide-tabs': props.hideTabs }"
      >
        <el-tab-pane
          label="基本信息"
          name="basic"
        >
          <RobotSettingsBasicTab
            :form-data="formData"
            :roles="roles"
            :tags="tags"
            :status="status"
            :volume-data="volumeData"
            @auto-save="autoSave"
            @update-field="updateFormField"
            @remove-tag="handleRemoveTag"
            @add-tag="handleAddTag"
            @update-volume="updateVolume"
            @change-volume="handleVolumeChange"
            @toggle-mute="handleMuteToggle"
            @reload-volume="loadVolume"
          />
        </el-tab-pane>

        <el-tab-pane
          label="网络配置"
          name="network"
        >
          <RobotSettingsNetworkTab
            :form-data="formData"
            :robot-uuid="uuid"
            :connected="status.connected"
            @auto-save="autoSave"
            @connection-tested="handleConnectionTested"
            @update-field="updateFormField"
          />
        </el-tab-pane>

        <el-tab-pane
          label="日志管理"
          name="logs"
        >
          <RobotSettingsLogsTab
            :robot-uuid="uuid"
            :connected="status.connected"
          />
        </el-tab-pane>

        <el-tab-pane
          label="AI 配置"
          name="ai"
        >
          <RobotSettingsAiTab
            :form-data="formData"
            :robot-uuid="uuid"
            @auto-save="autoSave"
            @update-field="updateFormField"
          />
        </el-tab-pane>

        <el-tab-pane name="upgrade">
          <template #label>
            <span class="custom-tab-label">
              系统升级
              <span
                v-if="hasUpdate"
                class="dot"
              />
            </span>
          </template>
          <RobotSettingsUpgradeTab
            :form-data="formData"
            :firmware-update-available="firmwareUpdateAvailable"
            @upgrade="handleUpgrade"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RobotSettingsAiTab from '../components/RobotSettingsAiTab.vue'
import RobotSettingsBasicTab from '../components/RobotSettingsBasicTab.vue'
import RobotSettingsLogsTab from '../components/RobotSettingsLogsTab.vue'
import RobotSettingsNetworkTab from '../components/RobotSettingsNetworkTab.vue'
import RobotSettingsUpgradeTab from '../components/RobotSettingsUpgradeTab.vue'
import { useRobotSettingsState } from '../composables/useRobotSettingsState'
import { useRobotSettingsVolume } from '../composables/useRobotSettingsVolume'

const props = defineProps<{ embedded?: boolean; robotUuid?: string; hideTabs?: boolean; activeTab?: string }>()
const route = useRoute()
const router = useRouter()
const uuid = computed(() => props.robotUuid || (route.params.uuid as string | undefined))

const currentTab = ref(props.activeTab || 'basic')
const status = reactive({
  temperature: 42,
  battery: undefined as number | undefined,
  connected: true,
})

const {
  volumeData,
  loadVolume,
  updateVolume,
  handleVolumeChange,
  handleMuteToggle,
} = useRobotSettingsVolume({
  uuid,
  status,
})

const {
  loading,
  formData,
  roles,
  tags,
  firmwareUpdateAvailable,
  hasUpdate,
  loadData,
  autoSave,
  updateFormField,
  handleRemoveTag,
  handleAddTag,
  handleConnectionTested,
  handleUpgrade,
  handleUnbind,
} = useRobotSettingsState({
  uuid,
  router,
  loadVolume,
  status,
})

watch(
  () => props.activeTab,
  (val) => {
    if (val && val !== currentTab.value) {
      currentTab.value = val
    }
  },
  { immediate: true }
)

watch(
  uuid,
  () => {
    loadData()
  },
  { immediate: true }
)
</script>

<style scoped>
.robot-settings {
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color-page);
}

.robot-settings.is-embedded {
  padding: 0;
  height: auto;
  overflow: visible;
  background: transparent;
}

.page-header {
  margin-bottom: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.content {
  min-height: 400px;
}

.settings-tabs {
  width: 100%;
}

.settings-tabs :deep(.el-tabs__content) { padding: 20px; }

.settings-tabs.is-hide-tabs :deep(.el-tabs__header) {
  display: none;
}

.settings-tabs.is-hide-tabs :deep(.el-tabs__content) {
  padding: 0;
}

.network-result {
  margin-left: 10px;
  font-size: 13px;
}
.network-result.success { color: #67c23a; }
.network-result.error { color: #f56c6c; }

.log-history {
  margin-top: 30px;
}
.log-history h4 {
  margin-bottom: 10px;
}

.log-mark-section {
  margin-bottom: 10px;
}

.custom-tab-label {
  position: relative;
}

.dot {
  position: absolute;
  top: -2px;
  right: -6px;
  width: 6px;
  height: 6px;
  background: #f56c6c;
  border-radius: 50%;
}
</style>
