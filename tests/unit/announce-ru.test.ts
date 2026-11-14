// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { SnapZone } from '../../src/core/types'
import { defaultMessages } from '../../src/dom/announcer'
import { attachDesktop } from '../../src/dom/controller'
import { announcerMessagesRu } from '../../src/locales/ru'

const ZONES: SnapZone[] = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'left-third',
  'center-third',
  'right-third',
]

afterEach(() => {
  document.body.replaceChildren()
})

describe('the Russian announcer dictionary', () => {
  it('has a line for every message of the English one', () => {
    expect(Object.keys(announcerMessagesRu).sort()).toEqual(Object.keys(defaultMessages).sort())
  })

  it('says every line in Russian, with the title inside', () => {
    const lines = [
      announcerMessagesRu.opened('Заметки'),
      announcerMessagesRu.closed('Заметки'),
      announcerMessagesRu.minimized('Заметки'),
      announcerMessagesRu.restored('Заметки'),
      announcerMessagesRu.maximized('Заметки'),
      announcerMessagesRu.focused('Заметки'),
    ]
    for (const line of lines) {
      expect(line).toContain('«Заметки»')
      expect(line).not.toMatch(/[a-z]/i)
    }
    expect(new Set(lines).size).toBe(lines.length)
    expect(announcerMessagesRu.workspace(2)).toBe('Рабочий стол 3')
  })

  it('names every snap zone', () => {
    const named = ZONES.map((zone) => announcerMessagesRu.snapped('Заметки', zone))
    for (const line of named) expect(line).not.toMatch(/[a-z]/i)
    expect(new Set(named).size).toBe(ZONES.length)
    expect(announcerMessagesRu.snapped('Заметки', 'left-third')).toBe(
      'Окно «Заметки» прикреплено к левой трети',
    )
  })

  it('says a zone it does not know as it was given', () => {
    expect(announcerMessagesRu.snapped('Заметки', 'там')).toBe('Окно «Заметки» прикреплено там')
  })

  it('declines the counted windows', () => {
    const forms = [1, 2, 4, 5, 11, 12, 14, 20, 21, 22, 25, 101, 111, 112].map((count) =>
      announcerMessagesRu.openedMany?.(count),
    )
    expect(forms).toEqual([
      'Открыто 1 окно',
      'Открыто 2 окна',
      'Открыто 4 окна',
      'Открыто 5 окон',
      'Открыто 11 окон',
      'Открыто 12 окон',
      'Открыто 14 окон',
      'Открыто 20 окон',
      'Открыто 21 окно',
      'Открыто 22 окна',
      'Открыто 25 окон',
      'Открыто 101 окно',
      'Открыто 111 окон',
      'Открыто 112 окон',
    ])
    expect(announcerMessagesRu.closedMany?.(3)).toBe('Закрыто 3 окна')
    expect(announcerMessagesRu.minimizedMany?.(7)).toBe('Свёрнуто 7 окон')
    expect(announcerMessagesRu.restoredMany?.(31)).toBe('Восстановлено 31 окно')
  })

  it('is what a desktop says when it is given the dictionary', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    const desktop = attachDesktop(wm, element, {
      autoViewport: false,
      announce: announcerMessagesRu,
    })
    const live = element.querySelector('[data-wm-announcer]') as HTMLElement
    wm.open({ id: 'a', title: 'Заметки' })
    expect(live.textContent).toBe('Окно «Заметки» открыто')
    wm.snap('a', 'top-right')
    expect(live.textContent).toBe('Окно «Заметки» прикреплено к правому верхнему углу')
    wm.batch(() => {
      wm.open({ id: 'b', title: 'Б' })
      wm.open({ id: 'c', title: 'В' })
    })
    expect(live.textContent).toBe('Открыто 2 окна')
    desktop.destroy()
  })
})
