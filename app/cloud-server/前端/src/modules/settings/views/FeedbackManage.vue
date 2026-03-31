<template>
  <div class="page">
    <PageHeader
      title="反馈管理"
      :icon="ChatDotRound"
    >
      <template #extra>
        <el-select
          v-model="statusFilter"
          style="width: 180px"
          @change="handleFilterChange"
        >
          <el-option
            label="全部状态"
            value=""
          />
          <el-option
            label="待处理"
            value="pending"
          />
          <el-option
            label="处理中"
            value="processing"
          />
          <el-option
            label="已解决"
            value="resolved"
          />
        </el-select>
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
        :data="rows"
        border
      >
        <el-table-column
          prop="content"
          label="反馈内容"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column
          label="来源"
          min-width="180"
        >
          <template #default="{ row }">
            {{ row.client_type }} / {{ row.device_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="反馈用户"
          width="120"
        >
          <template #default="{ row }">
            {{ row.username || '匿名' }}
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="120"
        >
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="处理人"
          width="120"
        >
          <template #default="{ row }">
            {{ row.handled_by_username || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="提交时间"
          min-width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="320"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              @click="openDetail(row.id)"
            >
              详情
            </el-button>
            <el-button
              size="small"
              :disabled="row.status === 'pending'"
              @click="changeStatus(row.id, 'pending')"
            >
              标记待处理
            </el-button>
            <el-button
              size="small"
              type="warning"
              :disabled="row.status === 'processing'"
              @click="changeStatus(row.id, 'processing')"
            >
              标记处理中
            </el-button>
            <el-button
              size="small"
              type="success"
              :disabled="row.status === 'resolved'"
              @click="changeStatus(row.id, 'resolved')"
            >
              标记已解决
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailVisible"
      title="反馈详情"
      width="700px"
    >
      <div
        v-if="detail"
        class="detail"
      >
        <div class="detail-row">
          <span class="label">状态：</span>
          <el-tag :type="statusType(detail.status)">
            {{ statusLabel(detail.status) }}
          </el-tag>
        </div>
        <div class="detail-row">
          <span class="label">用户：</span>
          <span>{{ detail.username || '匿名' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">来源：</span>
          <span>{{ detail.client_type }} / {{ detail.device_name || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">处理人：</span>
          <span>{{ detail.handled_by_username || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">处理时间：</span>
          <span>{{ formatTime(detail.handled_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">提交时间：</span>
          <span>{{ formatTime(detail.created_at) }}</span>
        </div>
        <div class="content-box">
          {{ detail.content }}
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { getFeedbackDetail, getFeedbackList, updateFeedbackStatus } from '@/modules/settings/api'
import type { FeedbackItem, FeedbackStatus } from '@/modules/settings/types'
import { ChatDotRound, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const loading = ref(false)
const rows = ref<FeedbackItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref<'' | FeedbackStatus>('')
const detailVisible = ref(false)
const detail = ref<FeedbackItem | null>(null)

const statusLabel = (status: FeedbackStatus) => {
  if (status === 'pending') return '待处理'
  if (status === 'processing') return '处理中'
  return '已解决'
}

const statusType = (status: FeedbackStatus) => {
  if (status === 'pending') return 'info'
  if (status === 'processing') return 'warning'
  return 'success'
}

const formatTime = (value?: string | null) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('zh-CN')
  } catch {
    return value
  }
}

const load = async () => {
  loading.value = true
  try {
    const res = await getFeedbackList({
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
      status: statusFilter.value || undefined,
    })
    rows.value = res.data?.items || []
    total.value = Number(res.data?.total || 0)
  } finally {
    loading.value = false
  }
}

const handleFilterChange = async () => {
  page.value = 1
  await load()
}

const openDetail = async (id: string) => {
  const res = await getFeedbackDetail(id)
  detail.value = res.data || null
  detailVisible.value = true
}

const changeStatus = async (id: string, status: FeedbackStatus) => {
  await updateFeedbackStatus(id, status)
  ElMessage.success('状态已更新')
  if (detail.value?.id === id) {
    detail.value.status = status
  }
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

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  align-items: center;
}

.label {
  width: 72px;
  color: var(--el-text-color-secondary);
}

.content-box {
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
