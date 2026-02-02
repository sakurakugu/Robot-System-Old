import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'app-theme'
const STORAGE_FOLLOW = 'app-theme-followSystem'
const STORAGE_MAP = 'app-theme-mapping'

type ThemeMapping = {
  dark: Theme
  light: Theme
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'dark' as Theme,
    followSystem: true,
    mapping: { dark: 'dark', light: 'light' } as ThemeMapping,
    _mql: null as MediaQueryList | null,
  }),
  actions: {
    init() {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (saved === 'light' || saved === 'dark') {
        this.theme = saved
      }
      const followRaw = localStorage.getItem(STORAGE_FOLLOW)
      if (followRaw === 'true' || followRaw === 'false') {
        this.followSystem = followRaw === 'true'
      }
      const mapRaw = localStorage.getItem(STORAGE_MAP)
      if (mapRaw) {
        try {
          const parsed = JSON.parse(mapRaw) as ThemeMapping
          if (parsed?.dark && parsed?.light) {
            this.mapping = {
              dark: parsed.dark === 'light' ? 'light' : 'dark',
              light: parsed.light === 'dark' ? 'dark' : 'light',
            }
          }
        } catch {
        }
      }
      this.setupSystemListener()
      this.apply()
    },
    setTheme(next: Theme) {
      this.theme = next
      localStorage.setItem(STORAGE_KEY, next)
      this.apply()
    },
    setFollowSystem(on: boolean) {
      this.followSystem = on
      localStorage.setItem(STORAGE_FOLLOW, String(on))
      this.setupSystemListener()
      this.apply()
    },
    setMapping(map: ThemeMapping) {
      this.mapping = map
      localStorage.setItem(STORAGE_MAP, JSON.stringify(map))
      this.apply()
    },
    setupSystemListener() {
      if (this._mql) {
        this._mql.removeEventListener('change', this._onSystemChange as any)
        this._mql = null
      }
      if (this.followSystem && typeof window !== 'undefined') {
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        this._mql = mql
        mql.addEventListener('change', this._onSystemChange as any)
      }
    },
    _onSystemChange() {
      this.apply()
    },
    apply() {
      const root = document.documentElement
      const effective = this.getEffectiveTheme()
      if (effective === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    },
    getEffectiveTheme(): Theme {
      if (!this.followSystem || typeof window === 'undefined') {
        return this.theme
      }
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return isSystemDark ? this.mapping.dark : this.mapping.light
    },
  },
})
