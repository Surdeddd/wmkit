import { themeCss, themeShadowCss } from './css'

export const themeNames = [
  'amber',
  'aqua',
  'blueprint',
  'brutalist',
  'candy',
  'carbon',
  'forest',
  'frost',
  'glass',
  'light',
  'neon',
  'noir',
  'paper',
  'retro',
  'synth',
  'terminal',
] as const

export type ThemeName = (typeof themeNames)[number]

export { themeCss, themeShadowCss }

export interface ThemeStyleOptions {
  shadow?: boolean
}

export function themeStyle(name: ThemeName, options: ThemeStyleOptions = {}): string {
  return options.shadow === true ? themeShadowCss[name] : themeCss[name]
}
