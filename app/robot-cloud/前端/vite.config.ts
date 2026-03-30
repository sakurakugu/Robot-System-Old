import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(currentDir, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: 'ws://localhost:9000',
        ws: true
      }
    }
  }
})
