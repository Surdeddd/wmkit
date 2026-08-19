import { themeCss } from './css'

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

export { themeCss }

export function themeStyle(name: ThemeName): string {
  return themeCss[name]
}
