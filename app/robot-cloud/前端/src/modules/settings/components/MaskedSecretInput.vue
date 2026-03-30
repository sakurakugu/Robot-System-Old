<template>
  <el-form-item :label="label">
    <el-input
      :model-value="modelValue"
      :readonly="readonly"
      :type="readonly || showValue ? 'text' : 'password'"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #append>
        <el-button-group>
          <el-button
            v-if="!readonly"
            :icon="View"
            @click="emit('toggle-visibility')"
          />
          <el-button
            :icon="CopyDocument"
            @click="emit('paste')"
          />
          <el-button
            v-if="readonly && hasValue"
            :icon="Edit"
            @click="emit('enable-edit')"
          />
        </el-button-group>
      </template>
    </el-input>
  </el-form-item>
</template>

<script setup lang="ts">
import { CopyDocument, Edit, View } from '@element-plus/icons-vue'

defineProps<{
  label: string
  modelValue: string
  readonly: boolean
  showValue: boolean
  placeholder: string
  hasValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'toggle-visibility': []
  'paste': []
  'enable-edit': []
}>()
</script>
