/// <reference types="vite/client" />

declare const __WMKIT_VERSION__: string

declare module 'virtual:wmkit-shadow-themes' {
  const themes: Record<string, () => Promise<string>>
  export default themes
}
