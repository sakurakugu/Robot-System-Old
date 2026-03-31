<template>
  <div class="page">
    <PageHeader
      title="登录设备"
      :icon="Monitor"
    >
      <template #extra>
        <el-text
          v-if="!loading && sessions.length > 0"
          type="info"
          size="small"
        >
          共 {{ sessions.length }} 台设备
        </el-text>
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="load"
        >
          刷新
        </el-button>
      </template>
    </PageHeader>

    <el-card shadow="hover">
      <el-table
        v-loading="loading"
        :data="sessions"
        border
        :empty-text="'暂无登录记录'"
      >
        <el-table-column
          prop="deviceName"
          label="设备"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="clientType"
          label="类型"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.clientType === 'mobile' ? 'warning' : 'primary'"
              effect="light"
            >
              {{ row.clientType === 'mobile' ? '手机端' : row.clientType === 'web' ? 'Web' : row.clientType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="ipAddress"
          label="IP地址"
          width="140"
        />
        <el-table-column
          prop="lastSeenAt"
          label="最近活跃"
          min-width="180"
        />
        <el-table-column
          label="状态"
          width="140"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.current"
              type="success"
              effect="dark"
              size="small"
            >
              当前设备
            </el-tag>
            <el-button
              v-else
              type="danger"
              plain
              size="small"
              @click="kick(row.id)"
            >
              下线
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { getMySessions, revokeSession } from '@/modules/auth/api'
import type { LoginSession } from '@/modules/auth/types'
import { Monitor, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const loading = ref(false)
const sessions = ref<LoginSession[]>([])

const load = async () => {
  try {
    loading.value = true
    const res = await getMySessions()
    sessions.value = res.data
  } finally {
    loading.value = false
  }
}

const kick = async (id: string) => {
  await revokeSession(id)
  ElMessage.success('设备已下线')
  await load()
}

onMounted(load)
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}
</style>
