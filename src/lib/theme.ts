export type Theme = 'light' | 'dark'
export const themeKey = 'verse-memory-theme'

export function savedTheme(): Theme {
  try {
    const saved = localStorage.getItem(themeKey)
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* Use the device preference when storage is unavailable. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101827' : '#eaf2fc')
}
