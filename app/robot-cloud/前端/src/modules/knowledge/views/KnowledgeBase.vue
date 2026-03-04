<template>
  <div class="page">
    <PageHeader
      title="知识库"
      :icon="Collection"
    >
      <template #extra>
        <el-button
          type="primary"
          @click="openCreate"
        >
          新增知识
        </el-button>
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="refresh"
        >
          刷新
        </el-button>
      </template>
    </PageHeader>

    <div
      v-loading="loading"
      class="content"
    >
      <el-empty
        v-if="!loading && docs.length === 0"
        description="暂无文档"
        :image-size="120"
      />
      <el-row
        v-else
        :gutter="20"
      >
        <el-col
          v-for="doc in docs"
          :key="doc.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-card
            shadow="hover"
            class="doc-card"
          >
            <template #header>
              <div class="doc-header">
                <el-icon><Document /></el-icon>
                <span class="doc-title">{{ doc.title }}</span>
              </div>
            </template>
            <div class="doc-meta">
              <el-tag
                size="small"
                type="info"
              >
                {{ doc.tags.join(', ') || '未分类' }}
              </el-tag>
              <el-text
                size="small"
                type="info"
              >
                {{ formatTime(doc.updatedAt) }}
              </el-text>
            </div>
            <el-text
              class="doc-excerpt"
              line-clamp="3"
            >
              {{ doc.content }}
            </el-text>

            <div class="doc-actions">
              <el-button
                size="small"
                @click="openEdit(doc)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click="removeDoc(doc.id)"
              >
                删除
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑知识' : '新增知识'"
      width="560px"
    >
      <el-form label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input
            v-model="form.tags"
            placeholder="逗号分隔"
          />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="save"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { createKnowledge, deleteKnowledge, listKnowledge, updateKnowledge, type KnowledgeItem } from '@/modules/knowledge/api'
import { Collection, Document, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

const loading = ref(false)
const docs = ref<KnowledgeItem[]>([])
const dialogVisible = ref(false)
const editingId = ref<string>('')
const form = reactive({ title: '', tags: '', content: '' })

const refresh = async () => {
  loading.value = true
  try {
    const res = await listKnowledge()
    docs.value = res.data || []
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editingId.value = ''
  form.title = ''
  form.tags = ''
  form.content = ''
  dialogVisible.value = true
}

const openEdit = (doc: KnowledgeItem) => {
  editingId.value = doc.id
  form.title = doc.title
  form.tags = doc.tags.join(',')
  form.content = doc.content
  dialogVisible.value = true
}

const save = async () => {
  const payload = {
    title: form.title,
    content: form.content,
    tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean),
  }

  if (editingId.value) {
    await updateKnowledge(editingId.value, payload)
  } else {
    await createKnowledge(payload)
  }

  ElMessage.success('保存成功')
  dialogVisible.value = false
  await refresh()
}

const removeDoc = async (id: string) => {
  await deleteKnowledge(id)
  ElMessage.success('已删除')
  await refresh()
}

const formatTime = (val?: string | null) => {
  if (!val) return '-'
  try { return new Date(val).toLocaleString('zh-CN') } catch { return val }
}

onMounted(refresh)
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.content {
  min-height: 400px;
}

.doc-card {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
}

:deep(.doc-card .el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.doc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.doc-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.doc-excerpt {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  flex: 1;
}

.doc-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
