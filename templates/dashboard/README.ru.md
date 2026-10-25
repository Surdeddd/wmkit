# Шаблон дашборда на wmkit

[English version](./README.md)

Операционный дашборд на [wmkit](https://github.com/Surdeddd/wmkit): четыре панели — ключевые цифры, живой график выручки, таблица заказов и журнал событий — разложены плагином докинга. Тащите панель за заголовок, чтобы закрепить её в другом месте, с зажатым Shift — чтобы она плавала, а разделители — чтобы менять размеры. Раскладка сохраняется в `localStorage` и возвращается после перезагрузки.

[![Открыть в StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/Surdeddd/wmkit/tree/main/templates/dashboard)

## Запуск

```bash
npx degit Surdeddd/wmkit/templates/dashboard my-dashboard
cd my-dashboard
npm install
npm run dev
```

## Что внутри

- `<wm-desktop>` и `<wm-window>` из `@surdeddd/wmkit/elements`: панели — обычный HTML, без фреймворка.
- `createDock()` из `@surdeddd/wmkit/dock`: раскладка по умолчанию, отрыв панелей, повторное закрепление, разделители с управлением с клавиатуры и «Сбросить раскладку».
- `persist="wmkit-dashboard"` на рабочем столе: окна и раскладка переживают перезагрузку.
- Смена темы через `themeStyle()` из `@surdeddd/wmkit/themes`.
- Интерфейс на английском и русском: язык берётся из `navigator.language`, есть переключатель.
- Линейный график на чистом SVG, без библиотек графиков.

## Где что менять

| Файл | Что в нём |
| --- | --- |
| `index.html` | четыре панели и панель инструментов |
| `src/main.ts` | раскладка по умолчанию, смена темы, переключатель языка, цикл обновления |
| `src/panels.ts` | отрисовка плиток, графика, таблицы и журнала |
| `src/i18n.ts` | все строки на английском и русском |
| `src/style.css` | стили страницы и панелей |
