import axios from 'axios'

// 创建 Axios 实例
const api = axios.create({
  baseURL: '/api/choreo/v1',
  timeout: 10000
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API 错误:', error)
    return Promise.reject(error)
  }
)

export default api
