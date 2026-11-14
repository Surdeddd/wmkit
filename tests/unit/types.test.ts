import type { Signal } from '@angular/core'
import type { Accessor } from 'solid-js'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ComputedRef } from 'vue'
import {
  createDesktop as angularDesktop,
  useWmState as angularState,
  useWmWindow as angularWindow,
} from '../../src/adapters/angular'
import { type WmStateController, wmDesktop, wmWindow } from '../../src/adapters/lit'
import { useWmState as preactState, useWmWindow as preactWindow } from '../../src/adapters/preact'
import {
  useDesktop as reactDesktop,
  useWmState as reactState,
  useWmWindow as reactWindow,
} from '../../src/adapters/react'
import {
  createDesktop as solidDesktop,
  useWmState as solidState,
  useWmWindow as solidWindow,
} from '../../src/adapters/solid'
import {
  type ReadableStore,
  createDesktop as svelteDesktop,
  wmStore,
  wmWindowStore,
} from '../../src/adapters/svelte'
import { useDesktop as vueDesktop, useWmState as vueState } from '../../src/adapters/vue'
import type {
  Bounds,
  DesktopBinder,
  DesktopController,
  DesktopGesture,
  DesktopOptions,
  ManagerEvents,
  ManagerState,
  MountedWindow,
  SerializedState,
  SnapZone,
  WindowManager,
  WindowSkin,
  WindowState,
} from '../../src/index'
import { attachDesktop, createDesktopBinder, createWindowManager } from '../../src/index'
import { skin, windowChrome } from '../../src/plugins/chrome'
import { createDevtools } from '../../src/plugins/devtools'
import { createDock, type Dock, type DockLayout } from '../../src/plugins/dock'
import { pinch, swipe, touchGestures } from '../../src/plugins/gestures'
import { type PersistController, persist } from '../../src/plugins/persist'
import { isPopoutSupported, type PopoutHandle, popout } from '../../src/plugins/popout'
import { type ThemeName, type themeNames, themeStyle } from '../../src/themes'

describe('the types of the manager', () => {
  it('give every method the value its documentation names', () => {
    expectTypeOf(createWindowManager).returns.toEqualTypeOf<WindowManager>()
    expectTypeOf<WindowManager['open']>().returns.toEqualTypeOf<WindowState>()
    expectTypeOf<WindowManager['get']>().returns.toEqualTypeOf<WindowState | undefined>()
    expectTypeOf<WindowManager['getState']>().returns.toEqualTypeOf<ManagerState>()
    expectTypeOf<WindowManager['minimized']>().returns.toEqualTypeOf<readonly WindowState[]>()
    expectTypeOf<WindowManager['group']>().returns.toEqualTypeOf<string | null>()
    expectTypeOf<WindowManager['cycleFocus']>().returns.toEqualTypeOf<string | null>()
    expectTypeOf<WindowManager['serialize']>().returns.toEqualTypeOf<SerializedState>()
    expectTypeOf<WindowManager['hydrate']>().parameter(0).toEqualTypeOf<SerializedState>()
    expectTypeOf<WindowManager['getLayout']>().returns.toEqualTypeOf<SerializedState | undefined>()
    expectTypeOf<WindowManager['subscribe']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<WindowManager['subscribe']>()
      .parameter(0)
      .toEqualTypeOf<(state: ManagerState) => void>()
    expectTypeOf<WindowManager['snap']>().parameter(1).toEqualTypeOf<SnapZone>()
    expectTypeOf<WindowManager['resize']>().parameter(1).toEqualTypeOf<Partial<Bounds>>()
    for (const method of [
      'close',
      'focus',
      'minimize',
      'maximize',
      'restore',
      'undo',
      'redo',
    ] as const) {
      expectTypeOf<WindowManager[typeof method]>().returns.toEqualTypeOf<boolean>()
    }
  })

  it('give every event its payload', () => {
    expectTypeOf<ManagerEvents['move']>().toEqualTypeOf<{ window: WindowState }>()
    expectTypeOf<ManagerEvents['focus']>().toEqualTypeOf<{
      window: WindowState
      previous: string | null
    }>()
    expectTypeOf<ManagerEvents['order']>().toEqualTypeOf<{ order: readonly string[] }>()
    expectTypeOf<ManagerEvents['change']>().toEqualTypeOf<{ state: ManagerState }>()
    expectTypeOf<keyof ManagerEvents>().toEqualTypeOf<
      | 'open'
      | 'close'
      | 'closing'
      | 'focus'
      | 'move'
      | 'resize'
      | 'stage'
      | 'update'
      | 'order'
      | 'workspace'
      | 'group'
      | 'modalblocked'
      | 'change'
    >()
  })

  it('keep the state read-only where it is shared', () => {
    expectTypeOf<ManagerState['order']>().toEqualTypeOf<readonly string[]>()
    expectTypeOf<ManagerState['focusedId']>().toEqualTypeOf<string | null>()
    expectTypeOf<WindowState['bounds']>().toEqualTypeOf<Bounds>()
    expectTypeOf<WindowState['groupId']>().toEqualTypeOf<string | null>()
  })

  it('refuse a wrong argument at compile time', () => {
    const misuse = (wm: WindowManager, element: HTMLElement) => {
      // @ts-expect-error an unknown event
      wm.on('nope', () => {})
      // @ts-expect-error an unknown snap zone
      wm.snap('a', 'middle')
      // @ts-expect-error the stage is not part of an update
      wm.update('a', { stage: 'maximized' })
      // @ts-expect-error a payload field that does not exist
      wm.on('move', ({ previous }) => previous)
      // @ts-expect-error an unknown top edge behaviour
      attachDesktop(wm, element, { snap: { topEdge: 'bottom' } })
      // @ts-expect-error a theme that does not exist
      themeStyle('plaid')
    }
    expect(misuse).toBeTypeOf('function')
  })
})

describe('the types of the DOM layer', () => {
  it('give the controller and the binder their shapes', () => {
    expectTypeOf(attachDesktop).returns.toEqualTypeOf<DesktopController>()
    expectTypeOf(attachDesktop).parameter(2).toEqualTypeOf<DesktopOptions | undefined>()
    expectTypeOf<DesktopController['attachWindow']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<DesktopController['mountWindow']>().returns.toEqualTypeOf<MountedWindow>()
    expectTypeOf<DesktopController['mountWindow']>()
      .parameter(1)
      .toEqualTypeOf<WindowSkin | string>()
    expectTypeOf<DesktopController['addDropTarget']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf(createDesktopBinder).returns.toEqualTypeOf<DesktopBinder>()
    expectTypeOf<DesktopBinder['controller']>().returns.toEqualTypeOf<DesktopController | null>()
    expectTypeOf<DesktopBinder['bindWindow']>().returns.toEqualTypeOf<() => void>()
  })
})

describe('the types of the adapters', () => {
  it('hand each framework its own kind of live value', () => {
    expectTypeOf(reactState).returns.toEqualTypeOf<ManagerState>()
    expectTypeOf(reactWindow).returns.toEqualTypeOf<WindowState | undefined>()
    expectTypeOf(reactDesktop).returns.toHaveProperty('binder').toEqualTypeOf<DesktopBinder>()
    expectTypeOf(preactState).returns.toEqualTypeOf<ManagerState>()
    expectTypeOf(preactWindow).returns.toEqualTypeOf<WindowState | undefined>()
    expectTypeOf(vueState).returns.toEqualTypeOf<ComputedRef<ManagerState>>()
    expectTypeOf(vueDesktop).returns.toEqualTypeOf<DesktopBinder>()
    expectTypeOf(solidState).returns.toEqualTypeOf<Accessor<ManagerState>>()
    expectTypeOf(solidWindow).returns.toEqualTypeOf<Accessor<WindowState | undefined>>()
    expectTypeOf(solidDesktop).returns.toHaveProperty('binder').toEqualTypeOf<DesktopBinder>()
    expectTypeOf(wmStore).returns.toEqualTypeOf<ReadableStore<ManagerState>>()
    expectTypeOf(wmWindowStore).returns.toEqualTypeOf<ReadableStore<WindowState | undefined>>()
    expectTypeOf(svelteDesktop).returns.toHaveProperty('binder').toEqualTypeOf<DesktopBinder>()
    expectTypeOf(angularState).returns.toEqualTypeOf<Signal<ManagerState>>()
    expectTypeOf(angularWindow).returns.toEqualTypeOf<Signal<WindowState | undefined>>()
    expectTypeOf(angularDesktop).returns.toHaveProperty('binder').toEqualTypeOf<DesktopBinder>()
    expectTypeOf<WmStateController['state']>().toEqualTypeOf<ManagerState>()
    expectTypeOf(wmDesktop).toBeFunction()
    expectTypeOf(wmWindow).toBeFunction()
  })
})

describe('the types of the plugins', () => {
  it('give every factory the value its documentation names', () => {
    expectTypeOf(persist).returns.toEqualTypeOf<PersistController>()
    expectTypeOf<PersistController['restore']>().returns.toEqualTypeOf<boolean>()
    expectTypeOf(popout).returns.toEqualTypeOf<Promise<PopoutHandle>>()
    expectTypeOf<PopoutHandle['closed']>().toEqualTypeOf<Promise<void>>()
    expectTypeOf(isPopoutSupported).returns.toEqualTypeOf<boolean>()
    expectTypeOf(pinch).returns.toEqualTypeOf<DesktopGesture>()
    expectTypeOf(swipe).returns.toEqualTypeOf<DesktopGesture>()
    expectTypeOf(touchGestures).returns.toEqualTypeOf<DesktopGesture>()
    expectTypeOf(skin).returns.toEqualTypeOf<WindowSkin>()
    expectTypeOf(windowChrome).returns.toEqualTypeOf<WindowSkin>()
    expectTypeOf(createDock).returns.toEqualTypeOf<Dock>()
    expectTypeOf<Dock['layout']>().returns.toEqualTypeOf<DockLayout>()
    expectTypeOf<Dock['setLayout']>().returns.toEqualTypeOf<boolean>()
    expectTypeOf(createDevtools).returns.toHaveProperty('destroy')
    expectTypeOf(themeStyle).returns.toEqualTypeOf<string>()
    expectTypeOf(themeStyle).parameter(0).toEqualTypeOf<ThemeName>()
    expectTypeOf<(typeof themeNames)[number]>().toEqualTypeOf<ThemeName>()
  })
})
