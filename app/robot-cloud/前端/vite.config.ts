import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:9000',
        ws: true
      }
    }
  }
})
