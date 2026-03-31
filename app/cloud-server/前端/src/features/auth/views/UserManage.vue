<template>
  <div class="page">
    <PageHeader
      title="用户权限管理"
      :icon="UserFilled"
    />

    <el-card shadow="hover">
      <el-table
        v-loading="loading"
        :data="users"
        border
      >
        <el-table-column
          prop="username"
          label="用户名"
          min-width="180"
        />
        <el-table-column
          prop="role"
          label="角色"
          width="160"
        >
          <template #default="{ row }">
            <el-tag
              :type="roleType(row.role)"
              size="small"
              effect="light"
            >
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="lastLoginAt"
          label="最近登录"
          min-width="180"
        />
        <el-table-column
          label="调整角色"
          width="280"
        >
          <template #default="{ row }">
            <el-select
              v-model="row.role"
              style="width: 150px"
              @change="(r: any) => saveRole(row.id, r)"
            >
              <el-option
                label="普通用户"
                value="user"
              />
              <el-option
                label="管理员"
                value="admin"
              />
              <el-option
                label="主管理员"
                value="super_admin"
              />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { getUsers, updateUserRole } from '@/features/auth/api'
import type { AuthUser } from '@/features/auth/types'
import PageHeader from '@/share/components/PageHeader.vue'
import { UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const loading = ref(false)
const users = ref<AuthUser[]>([])

const roleType = (role: string) => {
  if (role === 'super_admin') return 'danger'
  if (role === 'admin') return 'warning'
  return 'info'
}

const roleLabel = (role: string) => {
  if (role === 'super_admin') return '主管理员'
  if (role === 'admin') return '管理员'
  return '普通用户'
}

const load = async () => {
  try {
    loading.value = true
    const res = await getUsers()
    users.value = res.data
  } finally {
    loading.value = false
  }
}

const saveRole = async (id: string, role: 'user' | 'admin' | 'super_admin') => {
  await updateUserRole(id, role)
  ElMessage.success('权限已更新')
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
