import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getProfile, loginAccount, logoutAccount, registerAccount } from './api'
import type { AuthUser } from './types'

const TOKEN_KEY = 'auth_token'
const MODE_KEY = 'auth_mode'
const USER_KEY = 'auth_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const mode = ref<'guest' | 'authenticated'>(
    (localStorage.getItem(MODE_KEY) as 'guest' | 'authenticated' | null) || 'guest'
  )
  const user = ref<AuthUser | null>(null)
  const rawUser = localStorage.getItem(USER_KEY)
  if (rawUser) {
    try {
      user.value = JSON.parse(rawUser) as AuthUser
    } catch {
      user.value = null
    }
  }

  const isAuthenticated = computed(() => mode.value === 'authenticated' && !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin')
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

  function persist() {
    localStorage.setItem(MODE_KEY, mode.value)
    if (token.value) localStorage.setItem(TOKEN_KEY, token.value)
    else localStorage.removeItem(TOKEN_KEY)

    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    else localStorage.removeItem(USER_KEY)
  }

  async function login(username: string, password: string) {
    const res = await loginAccount({ username, password })
    token.value = res.data.token
    user.value = res.data.user
    mode.value = 'authenticated'
    persist()
    return res.data
  }

  async function register(username: string, password: string) {
    const res = await registerAccount({ username, password })
    token.value = res.data.token
    user.value = res.data.user
    mode.value = 'authenticated'
    persist()
    return res.data
  }

  function enterGuestMode() {
    token.value = ''
    user.value = null
    mode.value = 'guest'
    persist()
  }

  async function restoreProfileIfNeeded() {
    if (!token.value || mode.value !== 'authenticated') return
    try {
      const res = await getProfile()
      user.value = res.data
      persist()
    } catch {
      enterGuestMode()
    }
  }

  async function logout() {
    try {
      await logoutAccount()
    } catch {
      // ignore
    }
    enterGuestMode()
  }

  return {
    token,
    user,
    mode,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    login,
    register,
    logout,
    enterGuestMode,
    restoreProfileIfNeeded,
  }
})
