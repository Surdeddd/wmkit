---
title: Перетаскиваемое окно с ресайзом во Vue
description: Перетаскиваемые окна с ресайзом во Vue 3 на wmkit — composables для менеджера и каждого окна, снэп, управление с клавиатуры, модальный диалог и сохранённая раскладка, а окном служит ваш собственный шаблон.
---

# Перетаскиваемые окна с ресайзом во Vue 3

`vue-draggable-resizable` и его родственники двигают один блок. Экрану с несколькими окнами нужно больше: одно из них сверху, клик поднимает другое, диалог блокирует остальные, до всех должна доставать клавиатура, а раскладка — переживать перезагрузку. wmkit — оконный менеджер с точкой входа для Vue: окна — это ваши шаблоны, а composables держат их в согласии с одним конечным автоматом.

## Установка

```bash
npm i @surdeddd/wmkit
```

Vue 3.3 и новее. Адаптер добавляет к ядру несколько сотен байт и не имеет собственных зависимостей.

## Одно окно

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  useWindowManager, useDesktop, useWmState, useWmWindow, useWmWindowEl,
} from '@surdeddd/wmkit/vue'
import '@surdeddd/wmkit/themes/glass.css'

const host = ref<HTMLElement>()
const wm = useWindowManager()
const binder = useDesktop(wm, host)
const state = useWmState(wm)

const notes = ref<HTMLElement>()
useWmWindowEl(binder, 'notes', notes)
const note = useWmWindow(wm, 'notes')

wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
</script>

<template>
  <div ref="host" style="position: relative; height: 100vh">
    <section v-if="note" ref="notes">
      <header data-wm-drag>
        <span data-wm-title>{{ note.title }}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Свернуть" />
          <button data-wm-maximize aria-label="Развернуть" />
          <button data-wm-close aria-label="Закрыть" />
        </span>
      </header>
      <div data-wm-content>{{ state.order.length }} windows open</div>
    </section>
  </div>
</template>
```

`useDesktop` делает элемент `host` рабочим столом, `useWmWindowEl` привязывает template ref к id окна, остальное делают атрибуты: `data-wm-drag` — ручка перетаскивания, три кнопки работают без обработчиков, а ручки ресайза появляются со всех восьми сторон. `v-if` убирает секцию, когда окно закрылось, и рисует её снова, когда undo возвращает окно.

## Что возвращают composables

| Composable | Возвращает |
| --- | --- |
| `useWindowManager(options?)` | менеджер, который уничтожается вместе с effect scope |
| `useWmState(wm)` | `ComputedRef` всего состояния, только для чтения |
| `useWmWindow(wm, id)` | `ComputedRef` одного окна, который меняется только вместе с этим окном |
| `useDesktop(wm, targetRef, options?)` | биндер, к которому привязываются элементы окон |
| `useWmWindowEl(binder, id, targetRef, options?)` | привязывает один элемент и перепривязывает при смене id |

## Управление из кода

Состояние — обычные данные, а любое изменение идёт через менеджер:

```ts
import type { WindowManager } from '@surdeddd/wmkit'

export function arrange(wm: WindowManager) {
  wm.snap('notes', 'left')
  wm.open({ id: 'confirm', title: 'Delete the note?', layer: 'modal', width: 320, height: 160 })
  return () => wm.undo()
}
```

`snap` принимает половины, четверти и трети. Окно на слое `modal` удерживает фокус внутри себя и блокирует окна под собой, пока не закроется.

## Запомнить раскладку

```ts
import type { WindowManager } from '@surdeddd/wmkit'
import { persist } from '@surdeddd/wmkit/persist'

export const remember = (wm: WindowManager) => persist(wm, { key: 'my-app-windows' })
```

## Nuxt и серверный рендеринг

Менеджер — обычные данные, его можно создавать на сервере. DOM-часть подключается после монтирования, поэтому обёртка `<ClientOnly>` не нужна.

## Дальше

- [Адаптеры](../adapters.ru.md#vue) — каждый composable и его контракт
- [Темы](../theming.ru.md) — шестнадцать тем или собственные стили для атрибутов `data-wm-*`
- [Рецепты](../recipes.ru.md) — панель задач, модальные диалоги, сохранение с миграциями
