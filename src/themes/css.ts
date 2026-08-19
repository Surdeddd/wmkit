import type { ThemeName } from './index'

export const themeCss: Record<ThemeName, string> = {
  amber: `[data-wm-desktop] {
  --wm-radius: 6px;
  --wm-bg: rgba(24, 14, 2, 0.94);
  --wm-bg-focused: rgba(30, 18, 3, 0.98);
  --wm-border: rgba(255, 176, 46, 0.24);
  --wm-border-focused: rgba(255, 176, 46, 0.6);
  --wm-shadow: 0 0 0 1px rgba(255, 176, 46, 0.06);
  --wm-shadow-focused: 0 0 26px rgba(255, 176, 46, 0.22);
  --wm-titlebar-bg: rgba(255, 176, 46, 0.09);
  --wm-text: #ffc356;
  --wm-text-dim: rgba(255, 195, 86, 0.55);
  --wm-accent: #ffb02e;
  --wm-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --wm-title-font: var(--wm-mono);
  --wm-title-size: 12px;
  --wm-title-weight: 500;
  --wm-title-tracking: 0.1em;
  --wm-content-font: var(--wm-mono);
  --wm-transition: 140ms linear;
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(255, 176, 46, 0.5);
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-window] [data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-window] [data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-window] [data-wm-close]:hover {
  color: #ff8f5a;
  border-color: #ff8f5a;
}

[data-wm-window] [data-wm-minimize]:hover {
  color: #ffb02e;
  border-color: #ffb02e;
}

[data-wm-window] [data-wm-maximize]:hover {
  color: #ffd88a;
  border-color: #ffd88a;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
  text-shadow: 0 0 8px rgba(255, 176, 46, 0.28);
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

[data-wm-window]::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0 1px, transparent 1px 3px);
}

[data-wm-window] {
  position: relative;
}

@media (forced-colors: active) {
  [data-wm-window]::after {
    display: none;
  }
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  aqua: `[data-wm-desktop] {
  --wm-radius: 10px;
  --wm-bg: rgba(238, 241, 246, 0.86);
  --wm-bg-focused: rgba(246, 248, 252, 0.96);
  --wm-border: rgba(60, 80, 110, 0.28);
  --wm-border-focused: rgba(40, 70, 120, 0.45);
  --wm-shadow: 0 6px 18px rgba(20, 40, 80, 0.18);
  --wm-shadow-focused: 0 16px 40px rgba(20, 40, 80, 0.32);
  --wm-titlebar-bg: linear-gradient(180deg, #fdfdfe 0%, #e4eaf3 48%, #d4dced 52%, #e8edf5 100%);
  --wm-text: #1d2733;
  --wm-text-dim: rgba(29, 39, 51, 0.62);
  --wm-accent: #2f6fd0;
  --wm-blur: 14px;
  --wm-title-size: 13px;
  --wm-title-weight: 600;
  --wm-transition: 240ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.1);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.1);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.22);
  padding: 0;
  position: relative;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 -2px 3px rgba(0, 0, 0, 0.18);
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-window] [data-wm-close] {
  background: linear-gradient(180deg, color-mix(in srgb, #ef5f56 70%, white), #ef5f56);
}

[data-wm-window] [data-wm-minimize] {
  background: linear-gradient(180deg, color-mix(in srgb, #f0b12e 70%, white), #f0b12e);
}

[data-wm-window] [data-wm-maximize] {
  background: linear-gradient(180deg, color-mix(in srgb, #4fbe45 70%, white), #4fbe45);
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  filter: brightness(1.12);
  transform: scale(1.1);
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  blueprint: `[data-wm-desktop] {
  --wm-radius: 2px;
  --wm-bg: rgba(10, 36, 74, 0.94);
  --wm-bg-focused: rgba(12, 44, 90, 0.98);
  --wm-border: rgba(190, 220, 255, 0.35);
  --wm-border-focused: rgba(215, 235, 255, 0.8);
  --wm-shadow: none;
  --wm-shadow-focused: 0 0 0 1px rgba(215, 235, 255, 0.45);
  --wm-titlebar-bg: rgba(190, 220, 255, 0.1);
  --wm-text: #e8f2ff;
  --wm-text-dim: rgba(232, 242, 255, 0.6);
  --wm-accent: #9ecbff;
  --wm-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --wm-title-font: var(--wm-mono);
  --wm-title-size: 12px;
  --wm-title-weight: 500;
  --wm-title-tracking: 0.12em;
  --wm-content-font: var(--wm-mono);
  --wm-transition: 160ms linear;
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
  background-image:
    linear-gradient(rgba(190, 220, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(190, 220, 255, 0.07) 1px, transparent 1px);
  background-size: 16px 16px;
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-window] [data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-window] [data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-window] [data-wm-close]:hover {
  color: #ffb4a2;
  border-color: #ffb4a2;
}

[data-wm-window] [data-wm-minimize]:hover {
  color: #ffe08a;
  border-color: #ffe08a;
}

[data-wm-window] [data-wm-maximize]:hover {
  color: #9ecbff;
  border-color: #9ecbff;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

[data-wm-snap-preview] {
  border-style: dashed;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  brutalist: `[data-wm-desktop] {
  --wm-radius: 0px;
  --wm-bg: #f4f2ec;
  --wm-bg-focused: #ffffff;
  --wm-border: #111111;
  --wm-border-focused: #111111;
  --wm-border-width: 2px;
  --wm-shadow: 6px 6px 0 #111111;
  --wm-shadow-focused: 10px 10px 0 #111111;
  --wm-titlebar-bg: #111111;
  --wm-text: #111111;
  --wm-text-dim: rgba(17, 17, 17, 0.6);
  --wm-accent: #ff3b00;
  --wm-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --wm-title-font: var(--wm-mono);
  --wm-title-size: 12px;
  --wm-title-weight: 700;
  --wm-title-tracking: 0.14em;
  --wm-titlebar-padding: 9px 12px;
  --wm-title-color: #f4f2ec;
  --wm-title-color-focused: #ffffff;
  --wm-transition: 90ms linear;
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-window] [data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-window] [data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-window] [data-wm-close]:hover {
  color: #ff3b00;
  border-color: #ff3b00;
}

[data-wm-window] [data-wm-minimize]:hover {
  color: #ffd400;
  border-color: #ffd400;
}

[data-wm-window] [data-wm-maximize]:hover {
  color: #00d26a;
  border-color: #00d26a;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  border-color: #f4f2ec;
  color: #f4f2ec;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 -8px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  candy: `[data-wm-desktop] {
  --wm-radius: 22px;
  --wm-bg: rgba(255, 250, 253, 0.94);
  --wm-bg-focused: #fffdfe;
  --wm-border: rgba(236, 130, 175, 0.28);
  --wm-border-focused: rgba(236, 130, 175, 0.6);
  --wm-shadow: 0 10px 24px rgba(236, 130, 175, 0.18);
  --wm-shadow-focused: 0 18px 44px rgba(236, 130, 175, 0.3);
  --wm-titlebar-bg: linear-gradient(90deg, rgba(255, 214, 233, 0.9), rgba(214, 233, 255, 0.9));
  --wm-text: #5b3a52;
  --wm-text-dim: rgba(91, 58, 82, 0.6);
  --wm-accent: #ec82af;
  --wm-title-size: 13px;
  --wm-title-weight: 700;
  --wm-titlebar-padding: 11px 16px;
  --wm-transition: 300ms cubic-bezier(0.34, 1.4, 0.64, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-window] [data-wm-close] {
  background: #ff8fab;
}

[data-wm-window] [data-wm-minimize] {
  background: #ffd166;
}

[data-wm-window] [data-wm-maximize] {
  background: #8ad9b1;
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  filter: brightness(1.14);
  transform: scale(1.12);
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  carbon: `[data-wm-desktop] {
  --wm-radius: 0px;
  --wm-bg: #161616;
  --wm-bg-focused: #1c1c1c;
  --wm-border: #333333;
  --wm-border-focused: #4589ff;
  --wm-shadow: none;
  --wm-shadow-focused: 0 8px 24px rgba(0, 0, 0, 0.6);
  --wm-titlebar-bg: #262626;
  --wm-text: #f4f4f4;
  --wm-text-dim: #a8a8a8;
  --wm-accent: #4589ff;
  --wm-title-size: 13px;
  --wm-title-weight: 500;
  --wm-title-tracking: 0;
  --wm-titlebar-padding: 10px 16px;
  --wm-content-padding: 16px;
  --wm-transition: 150ms cubic-bezier(0.2, 0, 0.38, 0.9);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-window] [data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-window] [data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-window] [data-wm-close]:hover {
  color: #fa4d56;
  border-color: #fa4d56;
}

[data-wm-window] [data-wm-minimize]:hover {
  color: #f1c21b;
  border-color: #f1c21b;
}

[data-wm-window] [data-wm-maximize]:hover {
  color: #42be65;
  border-color: #42be65;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

[data-wm-window][data-wm-focused] {
  border-left-width: 3px;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  forest: `[data-wm-desktop] {
  --wm-radius: 12px;
  --wm-bg: rgba(24, 33, 26, 0.92);
  --wm-bg-focused: rgba(30, 42, 33, 0.97);
  --wm-border: rgba(154, 190, 140, 0.22);
  --wm-border-focused: rgba(154, 190, 140, 0.55);
  --wm-shadow: 0 8px 24px rgba(5, 12, 8, 0.5);
  --wm-shadow-focused: 0 18px 46px rgba(5, 12, 8, 0.62);
  --wm-titlebar-bg: rgba(154, 190, 140, 0.1);
  --wm-text: #e6f0e2;
  --wm-text-dim: rgba(230, 240, 226, 0.58);
  --wm-accent: #9abe8c;
  --wm-serif: "Iowan Old Style", Palatino, Georgia, serif;
  --wm-title-font: var(--wm-serif);
  --wm-title-size: 14px;
  --wm-title-weight: 600;
  --wm-transition: 260ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-window] [data-wm-close] {
  background: #d98c7a;
}

[data-wm-window] [data-wm-minimize] {
  background: #e0be74;
}

[data-wm-window] [data-wm-maximize] {
  background: #9abe8c;
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  filter: brightness(1.14);
  transform: scale(1.12);
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  frost: `[data-wm-desktop] {
  --wm-radius: 18px;
  --wm-bg: rgba(255, 255, 255, 0.48);
  --wm-bg-focused: rgba(255, 255, 255, 0.66);
  --wm-border: rgba(255, 255, 255, 0.6);
  --wm-border-focused: rgba(255, 255, 255, 0.92);
  --wm-shadow: 0 8px 30px rgba(80, 110, 150, 0.18);
  --wm-shadow-focused: 0 20px 60px rgba(80, 110, 150, 0.3);
  --wm-titlebar-bg: rgba(255, 255, 255, 0.3);
  --wm-text: #20303f;
  --wm-text-dim: rgba(32, 48, 63, 0.55);
  --wm-accent: #0ea5e9;
  --wm-blur: 28px;
  --wm-title-size: 13px;
  --wm-title-weight: 600;
  --wm-transition: 280ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  position: relative;
  border: 1.5px solid var(--wm-text-dim);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]:hover {
  background: #e11d48;
  border-color: #e11d48;
}

[data-wm-window] [data-wm-minimize]:hover {
  background: #0ea5e9;
  border-color: #0ea5e9;
}

[data-wm-window] [data-wm-maximize]:hover {
  background: #059669;
  border-color: #059669;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  glass: `[data-wm-desktop] {
  --wm-radius: 14px;
  --wm-bg: rgba(22, 24, 34, 0.55);
  --wm-bg-focused: rgba(26, 28, 40, 0.68);
  --wm-border: rgba(255, 255, 255, 0.09);
  --wm-border-focused: rgba(255, 255, 255, 0.22);
  --wm-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  --wm-shadow-focused: 0 18px 48px rgba(0, 0, 0, 0.5);
  --wm-titlebar-bg: rgba(255, 255, 255, 0.04);
  --wm-text: rgba(240, 242, 250, 0.92);
  --wm-text-dim: rgba(240, 242, 250, 0.55);
  --wm-accent: #7c6cff;
  --wm-blur: 22px;
  --wm-transition: 240ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.4);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.4);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--wm-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 120ms ease,
    transform 120ms ease;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  filter: brightness(1.25);
  transform: scale(1.12);
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-close] {
  background: #ff5f57;
}

[data-wm-window] [data-wm-minimize] {
  background: #febc2e;
}

[data-wm-window] [data-wm-maximize] {
  background: #28c840;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 14px;
  font-size: 14px;
  line-height: 1.55;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 18%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25A1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  light: `[data-wm-desktop] {
  --wm-radius: 12px;
  --wm-bg: rgba(255, 255, 255, 0.78);
  --wm-bg-focused: rgba(255, 255, 255, 0.94);
  --wm-border: rgba(15, 23, 42, 0.1);
  --wm-border-focused: rgba(15, 23, 42, 0.22);
  --wm-shadow: 0 6px 22px rgba(15, 23, 42, 0.12);
  --wm-shadow-focused: 0 16px 44px rgba(15, 23, 42, 0.2);
  --wm-titlebar-bg: rgba(15, 23, 42, 0.03);
  --wm-text: rgba(15, 23, 42, 0.92);
  --wm-text-dim: rgba(15, 23, 42, 0.55);
  --wm-accent: #4f46e5;
  --wm-blur: 18px;
  --wm-transition: 240ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.2);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.2);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--wm-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 120ms ease,
    transform 120ms ease;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  filter: brightness(1.1);
  transform: scale(1.12);
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-close] {
  background: #ff5f57;
}

[data-wm-window] [data-wm-minimize] {
  background: #febc2e;
}

[data-wm-window] [data-wm-maximize] {
  background: #28c840;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 14px;
  font-size: 14px;
  line-height: 1.55;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 45%, transparent);
  border-radius: var(--wm-radius);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25A1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  neon: `[data-wm-desktop] {
  --wm-radius: 16px;
  --wm-bg: rgba(13, 8, 30, 0.72);
  --wm-bg-focused: rgba(18, 11, 40, 0.84);
  --wm-border: rgba(124, 58, 237, 0.28);
  --wm-border-focused: rgba(236, 72, 153, 0.65);
  --wm-shadow: 0 10px 32px rgba(6, 2, 20, 0.6);
  --wm-shadow-focused: 0 0 0 1px rgba(236, 72, 153, 0.35), 0 18px 52px rgba(236, 72, 153, 0.28);
  --wm-titlebar-bg: linear-gradient(90deg, rgba(236, 72, 153, 0.16), rgba(56, 189, 248, 0.12));
  --wm-text: #f3e9ff;
  --wm-text-dim: rgba(243, 233, 255, 0.55);
  --wm-accent: #ec4899;
  --wm-accent-alt: #38bdf8;
  --wm-blur: 20px;
  --wm-transition: 260ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 200ms ease,
    border-color 200ms ease;
  animation: wm-window-in 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 200ms ease,
    border-color 200ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wm-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-text);
  text-shadow: 0 0 12px rgba(236, 72, 153, 0.55);
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    box-shadow 140ms ease,
    transform 140ms ease;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-window] [data-wm-close] {
  background: var(--wm-accent);
}

[data-wm-window] [data-wm-minimize] {
  background: #a855f7;
}

[data-wm-window] [data-wm-maximize] {
  background: var(--wm-accent-alt);
}

[data-wm-window] [data-wm-close]:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px var(--wm-accent);
}

[data-wm-window] [data-wm-minimize]:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px #a855f7;
}

[data-wm-window] [data-wm-maximize]:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px var(--wm-accent-alt);
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent-alt);
  outline-offset: 3px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 14%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent-alt) 60%, transparent);
  border-radius: var(--wm-radius);
  box-shadow: 0 0 28px rgba(236, 72, 153, 0.25);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.94;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] [data-wm-title] {
    text-shadow: none;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25A1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
    box-shadow: none;
  }
}
`,
  noir: `[data-wm-desktop] {
  --wm-radius: 0px;
  --wm-bg: #000000;
  --wm-bg-focused: #000000;
  --wm-border: rgba(255, 255, 255, 0.35);
  --wm-border-focused: #ffffff;
  --wm-shadow: none;
  --wm-shadow-focused: 0 0 0 1px #ffffff;
  --wm-titlebar-bg: #000000;
  --wm-text: #ffffff;
  --wm-text-dim: rgba(255, 255, 255, 0.55);
  --wm-accent: #ffffff;
  --wm-title-size: 11px;
  --wm-title-weight: 600;
  --wm-title-tracking: 0.24em;
  --wm-titlebar-padding: 11px 14px;
  --wm-transition: 200ms linear;
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  position: relative;
  border: 1.5px solid var(--wm-text-dim);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]:hover {
  background: #ffffff;
  border-color: #ffffff;
}

[data-wm-window] [data-wm-minimize]:hover {
  background: #ffffff;
  border-color: #ffffff;
}

[data-wm-window] [data-wm-maximize]:hover {
  background: #ffffff;
  border-color: #ffffff;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

[data-wm-snap-preview] {
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.8);
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  paper: `[data-wm-desktop] {
  --wm-radius: 6px;
  --wm-bg: #fdfaf3;
  --wm-bg-focused: #fffdf8;
  --wm-border: rgba(84, 71, 51, 0.18);
  --wm-border-focused: rgba(84, 71, 51, 0.38);
  --wm-shadow: 2px 3px 0 rgba(84, 71, 51, 0.1);
  --wm-shadow-focused: 4px 6px 0 rgba(84, 71, 51, 0.16);
  --wm-titlebar-bg: rgba(84, 71, 51, 0.05);
  --wm-text: #3f382c;
  --wm-text-dim: rgba(63, 56, 44, 0.6);
  --wm-accent: #a8571b;
  --wm-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --wm-transition: 220ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
  box-shadow: none;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-serif);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--wm-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  position: relative;
  border: 1.5px solid var(--wm-text-dim);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-window] [data-wm-close]:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

[data-wm-window] [data-wm-minimize]:hover {
  background: var(--wm-accent);
  border-color: var(--wm-accent);
}

[data-wm-window] [data-wm-maximize]:hover {
  background: #4d7c0f;
  border-color: #4d7c0f;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 16px 18px;
  font-size: 14px;
  line-height: 1.65;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 8%, transparent);
  border: 1.5px dashed color-mix(in srgb, var(--wm-accent) 50%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 6px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25A1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  retro: `[data-wm-desktop] {
  --wm-face: #c0c0c0;
  --wm-face-light: #ffffff;
  --wm-face-dark: #808080;
  --wm-face-darker: #404040;
  --wm-title-active-a: #000080;
  --wm-title-active-b: #1084d0;
  --wm-title-inactive: #808080;
  --wm-text: #000000;
  --wm-text-dim: #404040;
  --wm-accent: #000080;
  --wm-title-text: #ffffff;
  position: relative;
  overflow: hidden;
  background: #008080;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-face);
  border: 2px solid;
  border-color: var(--wm-face-light) var(--wm-face-darker) var(--wm-face-darker)
    var(--wm-face-light);
  box-shadow: 1px 1px 0 var(--wm-face-dark);
  outline: none;
  contain: layout style;
  font-family: "Pixelated MS Sans Serif", "MS Sans Serif", Tahoma, sans-serif;
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 2px 2px 0 var(--wm-face-dark);
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  margin: 2px;
  background: linear-gradient(90deg, var(--wm-title-inactive), #b5b5b5);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-focused] [data-wm-drag] {
  background: linear-gradient(90deg, var(--wm-title-active-a), var(--wm-title-active-b));
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: var(--wm-title-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0;
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 16px;
  height: 14px;
  border: 1px solid;
  border-color: var(--wm-face-light) var(--wm-face-darker) var(--wm-face-darker)
    var(--wm-face-light);
  background: var(--wm-face);
  padding: 0;
  position: relative;
  cursor: pointer;
  font-size: 9px;
  line-height: 1;
  color: var(--wm-text);
}

[data-wm-window] [data-wm-close]::before,
[data-wm-window] [data-wm-minimize]::before,
[data-wm-window] [data-wm-maximize]::before {
  content: "";
  position: absolute;
  inset: -5px -4px;
}

[data-wm-window] [data-wm-close]:active,
[data-wm-window] [data-wm-minimize]:active,
[data-wm-window] [data-wm-maximize]:active {
  border-color: var(--wm-face-darker) var(--wm-face-light) var(--wm-face-light)
    var(--wm-face-darker);
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 1px dotted var(--wm-text);
  outline-offset: -3px;
}

[data-wm-window] [data-wm-minimize]::after {
  content: "_";
  font-weight: 700;
}

[data-wm-window] [data-wm-maximize]::after {
  content: "□";
  font-weight: 700;
}

[data-wm-window] [data-wm-close]::after {
  content: "✕";
  font-weight: 700;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 8px;
  margin: 0 2px 2px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--wm-face);
  border: 1px solid;
  border-color: var(--wm-face-dark) var(--wm-face-light) var(--wm-face-light) var(--wm-face-dark);
}

[data-wm-snap-preview] {
  background: transparent;
  border: 2px dashed var(--wm-face-darker);
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window] {
    animation: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    color: CanvasText;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] [data-wm-drag] {
    background: Highlight;
    color: HighlightText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    border: 1px solid ButtonText;
    background: ButtonFace;
    color: ButtonText;
  }

  [data-wm-snap-preview] {
    border: 2px solid Highlight;
  }
}
`,
  synth: `[data-wm-desktop] {
  --wm-radius: 8px;
  --wm-bg: rgba(24, 12, 44, 0.82);
  --wm-bg-focused: rgba(30, 15, 54, 0.92);
  --wm-border: rgba(255, 138, 200, 0.3);
  --wm-border-focused: rgba(255, 200, 120, 0.75);
  --wm-shadow: 0 10px 28px rgba(10, 4, 24, 0.6);
  --wm-shadow-focused: 0 0 0 1px rgba(255, 200, 120, 0.4), 0 18px 50px rgba(255, 90, 170, 0.28);
  --wm-titlebar-bg: linear-gradient(90deg, #ff7ac6 0%, #ff9f6e 50%, #ffd36e 100%);
  --wm-text: #ffeaf7;
  --wm-text-dim: rgba(255, 234, 247, 0.62);
  --wm-accent: #ff7ac6;
  --wm-blur: 16px;
  --wm-title-size: 12px;
  --wm-title-weight: 700;
  --wm-title-tracking: 0.16em;
  --wm-title-color: #2a0d3d;
  --wm-title-color-focused: #1c0729;
  --wm-transition: 260ms cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.5);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.5);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms ease;
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-window] [data-wm-close] {
  background: #ff5f9e;
}

[data-wm-window] [data-wm-minimize] {
  background: #ffb35c;
}

[data-wm-window] [data-wm-maximize] {
  background: #7ce0ff;
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  filter: brightness(1.14);
  transform: scale(1.12);
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 12%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--wm-accent) 55%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1),
    width 140ms ease,
    height 140ms ease;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }

  [data-wm-window] [data-wm-close]:hover,
  [data-wm-window] [data-wm-minimize]:hover,
  [data-wm-window] [data-wm-maximize]:hover {
    transform: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-title] {
    color: CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    display: grid;
    place-items: center;
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    border-radius: 2px;
    background: ButtonFace;
    color: ButtonText;
    font-size: 10px;
    line-height: 1;
    box-shadow: none;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25a1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
  terminal: `[data-wm-desktop] {
  --wm-radius: 4px;
  --wm-bg: rgba(8, 14, 10, 0.9);
  --wm-bg-focused: rgba(10, 18, 13, 0.98);
  --wm-border: rgba(74, 222, 128, 0.22);
  --wm-border-focused: rgba(74, 222, 128, 0.55);
  --wm-shadow: 0 0 0 1px rgba(74, 222, 128, 0.06);
  --wm-shadow-focused: 0 0 24px rgba(74, 222, 128, 0.18);
  --wm-titlebar-bg: rgba(74, 222, 128, 0.07);
  --wm-text: #b8f5cd;
  --wm-text-dim: rgba(184, 245, 205, 0.55);
  --wm-accent: #4ade80;
  --wm-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --wm-transition: 120ms linear;
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  font-family: var(--wm-mono);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 120ms linear,
    border-color 120ms linear;
  animation: wm-window-in 120ms linear;
}

[data-wm-window][hidden] {
  display: none;
}

[data-wm-window][data-wm-focused] {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing],
[data-wm-window][data-wm-pinching] {
  transition:
    box-shadow 120ms linear,
    border-color 120ms linear;
  user-select: none;
  -webkit-user-select: none;
}

[data-wm-window][data-wm-stage="maximized"],
[data-wm-window][data-wm-stage="snapped"] {
  border-radius: 0;
}

[data-wm-window][data-wm-flash] {
  animation: wm-flash 320ms steps(6, end);
}

[data-wm-window] [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

[data-wm-window][data-wm-stage="maximized"] [data-wm-drag],
[data-wm-window][data-wm-stage="snapped"] [data-wm-drag] {
  border-radius: 0;
}

[data-wm-window] [data-wm-title] {
  flex: 1;
  font-family: var(--wm-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--wm-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-window][data-wm-focused] [data-wm-title] {
  color: var(--wm-accent);
}

[data-wm-window] [data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-window] [data-wm-close],
[data-wm-window] [data-wm-minimize],
[data-wm-window] [data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 120ms linear,
    border-color 120ms linear,
    background 120ms linear;
}

[data-wm-window] [data-wm-close]::after,
[data-wm-window] [data-wm-minimize]::after,
[data-wm-window] [data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-window] [data-wm-close]::before {
  content: "x";
}

[data-wm-window] [data-wm-minimize]::before {
  content: "-";
}

[data-wm-window] [data-wm-maximize]::before {
  content: "+";
}

[data-wm-window] [data-wm-close]:hover,
[data-wm-window] [data-wm-minimize]:hover,
[data-wm-window] [data-wm-maximize]:hover {
  color: var(--wm-accent);
  border-color: var(--wm-border-focused);
  background: rgba(74, 222, 128, 0.1);
}

[data-wm-window] [data-wm-close]:hover {
  color: #fca5a5;
  border-color: rgba(252, 165, 165, 0.6);
  background: rgba(252, 165, 165, 0.12);
}

[data-wm-window] [data-wm-close]:focus-visible,
[data-wm-window] [data-wm-minimize]:focus-visible,
[data-wm-window] [data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 12px;
  font-family: var(--wm-mono);
  font-size: 13px;
  line-height: 1.6;
}

[data-wm-snap-preview] {
  background: color-mix(in srgb, var(--wm-accent) 10%, transparent);
  border: 1px dashed color-mix(in srgb, var(--wm-accent) 60%, transparent);
  border-radius: var(--wm-radius);
  transition:
    transform 100ms linear,
    width 100ms linear,
    height 100ms linear;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview],
  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    transition: none;
    animation: none;
  }
}

@media (forced-colors: active) {
  [data-wm-window] {
    background: Canvas;
    border: 1px solid CanvasText;
  }

  [data-wm-window][data-wm-focused] {
    border-color: Highlight;
  }

  [data-wm-window] [data-wm-drag] {
    background: Canvas;
    border-bottom: 1px solid CanvasText;
  }

  [data-wm-window] [data-wm-close],
  [data-wm-window] [data-wm-minimize],
  [data-wm-window] [data-wm-maximize] {
    width: 18px;
    height: 16px;
    border: 1px solid ButtonText;
    background: ButtonFace;
    color: ButtonText;
  }

  [data-wm-window] [data-wm-close]::before {
    content: "\\2715";
  }

  [data-wm-window] [data-wm-minimize]::before {
    content: "\\2013";
  }

  [data-wm-window] [data-wm-maximize]::before {
    content: "\\25A1";
  }

  [data-wm-snap-preview] {
    background: transparent;
    border: 2px solid Highlight;
  }
}
`,
}

export const themeShadowCss: Record<ThemeName, string> = {
  amber: `:host {
  --wm-radius: 6px;
  --wm-bg: rgba(24, 14, 2, 0.94);
  --wm-bg-focused: rgba(30, 18, 3, 0.98);
  --wm-border: rgba(255, 176, 46, 0.24);
  --wm-border-focused: rgba(255, 176, 46, 0.6);
  --wm-shadow: 0 0 0 1px rgba(255, 176, 46, 0.06);
  --wm-shadow-focused: 0 0 26px rgba(255, 176, 46, 0.22);
  --wm-titlebar-bg: rgba(255, 176, 46, 0.09);
  --wm-text: #ffc356;
  --wm-text-dim: rgba(255, 195, 86, 0.55);
  --wm-accent: #ffb02e;
  --wm-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --wm-title-font: var(--wm-mono);
  --wm-title-size: 12px;
  --wm-title-weight: 500;
  --wm-title-tracking: 0.1em;
  --wm-content-font: var(--wm-mono);
  --wm-transition: 140ms linear;
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(255, 176, 46, 0.5);
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-close]:hover {
  color: #ff8f5a;
  border-color: #ff8f5a;
}

[data-wm-minimize]:hover {
  color: #ffb02e;
  border-color: #ffb02e;
}

[data-wm-maximize]:hover {
  color: #ffd88a;
  border-color: #ffd88a;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
  text-shadow: 0 0 8px rgba(255, 176, 46, 0.28);
}

:host::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0 1px, transparent 1px 3px);
}

:host {
  position: relative;
}

@media (forced-colors: active) {
  :host::after {
      display: none;
    }

}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  aqua: `:host {
  --wm-radius: 10px;
  --wm-bg: rgba(238, 241, 246, 0.86);
  --wm-bg-focused: rgba(246, 248, 252, 0.96);
  --wm-border: rgba(60, 80, 110, 0.28);
  --wm-border-focused: rgba(40, 70, 120, 0.45);
  --wm-shadow: 0 6px 18px rgba(20, 40, 80, 0.18);
  --wm-shadow-focused: 0 16px 40px rgba(20, 40, 80, 0.32);
  --wm-titlebar-bg: linear-gradient(180deg, #fdfdfe 0%, #e4eaf3 48%, #d4dced 52%, #e8edf5 100%);
  --wm-text: #1d2733;
  --wm-text-dim: rgba(29, 39, 51, 0.62);
  --wm-accent: #2f6fd0;
  --wm-blur: 14px;
  --wm-title-size: 13px;
  --wm-title-weight: 600;
  --wm-transition: 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.1);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.1);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.22);
  padding: 0;
  position: relative;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 -2px 3px rgba(0, 0, 0, 0.18);
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-close] {
  background: linear-gradient(180deg, color-mix(in srgb, #ef5f56 70%, white), #ef5f56);
}

[data-wm-minimize] {
  background: linear-gradient(180deg, color-mix(in srgb, #f0b12e 70%, white), #f0b12e);
}

[data-wm-maximize] {
  background: linear-gradient(180deg, color-mix(in srgb, #4fbe45 70%, white), #4fbe45);
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  filter: brightness(1.12);
  transform: scale(1.1);
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  blueprint: `:host {
  --wm-radius: 2px;
  --wm-bg: rgba(10, 36, 74, 0.94);
  --wm-bg-focused: rgba(12, 44, 90, 0.98);
  --wm-border: rgba(190, 220, 255, 0.35);
  --wm-border-focused: rgba(215, 235, 255, 0.8);
  --wm-shadow: none;
  --wm-shadow-focused: 0 0 0 1px rgba(215, 235, 255, 0.45);
  --wm-titlebar-bg: rgba(190, 220, 255, 0.1);
  --wm-text: #e8f2ff;
  --wm-text-dim: rgba(232, 242, 255, 0.6);
  --wm-accent: #9ecbff;
  --wm-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --wm-title-font: var(--wm-mono);
  --wm-title-size: 12px;
  --wm-title-weight: 500;
  --wm-title-tracking: 0.12em;
  --wm-content-font: var(--wm-mono);
  --wm-transition: 160ms linear;
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
  background-image:
    linear-gradient(rgba(190, 220, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(190, 220, 255, 0.07) 1px, transparent 1px);
  background-size: 16px 16px;
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-close]:hover {
  color: #ffb4a2;
  border-color: #ffb4a2;
}

[data-wm-minimize]:hover {
  color: #ffe08a;
  border-color: #ffe08a;
}

[data-wm-maximize]:hover {
  color: #9ecbff;
  border-color: #9ecbff;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  brutalist: `:host {
  --wm-radius: 0px;
  --wm-bg: #f4f2ec;
  --wm-bg-focused: #ffffff;
  --wm-border: #111111;
  --wm-border-focused: #111111;
  --wm-border-width: 2px;
  --wm-shadow: 6px 6px 0 #111111;
  --wm-shadow-focused: 10px 10px 0 #111111;
  --wm-titlebar-bg: #111111;
  --wm-text: #111111;
  --wm-text-dim: rgba(17, 17, 17, 0.6);
  --wm-accent: #ff3b00;
  --wm-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --wm-title-font: var(--wm-mono);
  --wm-title-size: 12px;
  --wm-title-weight: 700;
  --wm-title-tracking: 0.14em;
  --wm-titlebar-padding: 9px 12px;
  --wm-title-color: #f4f2ec;
  --wm-title-color-focused: #ffffff;
  --wm-transition: 90ms linear;
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-close]:hover {
  color: #ff3b00;
  border-color: #ff3b00;
}

[data-wm-minimize]:hover {
  color: #ffd400;
  border-color: #ffd400;
}

[data-wm-maximize]:hover {
  color: #00d26a;
  border-color: #00d26a;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  border-color: #f4f2ec;
  color: #f4f2ec;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 -8px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  candy: `:host {
  --wm-radius: 22px;
  --wm-bg: rgba(255, 250, 253, 0.94);
  --wm-bg-focused: #fffdfe;
  --wm-border: rgba(236, 130, 175, 0.28);
  --wm-border-focused: rgba(236, 130, 175, 0.6);
  --wm-shadow: 0 10px 24px rgba(236, 130, 175, 0.18);
  --wm-shadow-focused: 0 18px 44px rgba(236, 130, 175, 0.3);
  --wm-titlebar-bg: linear-gradient(90deg, rgba(255, 214, 233, 0.9), rgba(214, 233, 255, 0.9));
  --wm-text: #5b3a52;
  --wm-text-dim: rgba(91, 58, 82, 0.6);
  --wm-accent: #ec82af;
  --wm-title-size: 13px;
  --wm-title-weight: 700;
  --wm-titlebar-padding: 11px 16px;
  --wm-transition: 300ms cubic-bezier(0.34, 1.4, 0.64, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-close] {
  background: #ff8fab;
}

[data-wm-minimize] {
  background: #ffd166;
}

[data-wm-maximize] {
  background: #8ad9b1;
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  filter: brightness(1.14);
  transform: scale(1.12);
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  carbon: `:host {
  --wm-radius: 0px;
  --wm-bg: #161616;
  --wm-bg-focused: #1c1c1c;
  --wm-border: #333333;
  --wm-border-focused: #4589ff;
  --wm-shadow: none;
  --wm-shadow-focused: 0 8px 24px rgba(0, 0, 0, 0.6);
  --wm-titlebar-bg: #262626;
  --wm-text: #f4f4f4;
  --wm-text-dim: #a8a8a8;
  --wm-accent: #4589ff;
  --wm-title-size: 13px;
  --wm-title-weight: 500;
  --wm-title-tracking: 0;
  --wm-titlebar-padding: 10px 16px;
  --wm-content-padding: 16px;
  --wm-transition: 150ms cubic-bezier(0.2, 0, 0.38, 0.9);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border-focused);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono, inherit);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]::before {
  content: "\\00d7";
}

[data-wm-minimize]::before {
  content: "\\2013";
}

[data-wm-maximize]::before {
  content: "\\25a1";
}

[data-wm-close]:hover {
  color: #fa4d56;
  border-color: #fa4d56;
}

[data-wm-minimize]:hover {
  color: #f1c21b;
  border-color: #f1c21b;
}

[data-wm-maximize]:hover {
  color: #42be65;
  border-color: #42be65;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

:host([data-wm-focused]) {
  border-left-width: 3px;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  forest: `:host {
  --wm-radius: 12px;
  --wm-bg: rgba(24, 33, 26, 0.92);
  --wm-bg-focused: rgba(30, 42, 33, 0.97);
  --wm-border: rgba(154, 190, 140, 0.22);
  --wm-border-focused: rgba(154, 190, 140, 0.55);
  --wm-shadow: 0 8px 24px rgba(5, 12, 8, 0.5);
  --wm-shadow-focused: 0 18px 46px rgba(5, 12, 8, 0.62);
  --wm-titlebar-bg: rgba(154, 190, 140, 0.1);
  --wm-text: #e6f0e2;
  --wm-text-dim: rgba(230, 240, 226, 0.58);
  --wm-accent: #9abe8c;
  --wm-serif: "Iowan Old Style", Palatino, Georgia, serif;
  --wm-title-font: var(--wm-serif);
  --wm-title-size: 14px;
  --wm-title-weight: 600;
  --wm-transition: 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-close] {
  background: #d98c7a;
}

[data-wm-minimize] {
  background: #e0be74;
}

[data-wm-maximize] {
  background: #9abe8c;
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  filter: brightness(1.14);
  transform: scale(1.12);
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  frost: `:host {
  --wm-radius: 18px;
  --wm-bg: rgba(255, 255, 255, 0.48);
  --wm-bg-focused: rgba(255, 255, 255, 0.66);
  --wm-border: rgba(255, 255, 255, 0.6);
  --wm-border-focused: rgba(255, 255, 255, 0.92);
  --wm-shadow: 0 8px 30px rgba(80, 110, 150, 0.18);
  --wm-shadow-focused: 0 20px 60px rgba(80, 110, 150, 0.3);
  --wm-titlebar-bg: rgba(255, 255, 255, 0.3);
  --wm-text: #20303f;
  --wm-text-dim: rgba(32, 48, 63, 0.55);
  --wm-accent: #0ea5e9;
  --wm-blur: 28px;
  --wm-title-size: 13px;
  --wm-title-weight: 600;
  --wm-transition: 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  position: relative;
  border: 1.5px solid var(--wm-text-dim);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]:hover {
  background: #e11d48;
  border-color: #e11d48;
}

[data-wm-minimize]:hover {
  background: #0ea5e9;
  border-color: #0ea5e9;
}

[data-wm-maximize]:hover {
  background: #059669;
  border-color: #059669;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  glass: `:host {
  --wm-radius: 14px;
  --wm-bg: rgba(22, 24, 34, 0.55);
  --wm-bg-focused: rgba(26, 28, 40, 0.68);
  --wm-border: rgba(255, 255, 255, 0.09);
  --wm-border-focused: rgba(255, 255, 255, 0.22);
  --wm-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  --wm-shadow-focused: 0 18px 48px rgba(0, 0, 0, 0.5);
  --wm-titlebar-bg: rgba(255, 255, 255, 0.04);
  --wm-text: rgba(240, 242, 250, 0.92);
  --wm-text-dim: rgba(240, 242, 250, 0.55);
  --wm-accent: #7c6cff;
  --wm-blur: 22px;
  --wm-transition: 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.4);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.4);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--wm-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 120ms ease,
    transform 120ms ease;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  filter: brightness(1.25);
  transform: scale(1.12);
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-close] {
  background: #ff5f57;
}

[data-wm-minimize] {
  background: #febc2e;
}

[data-wm-maximize] {
  background: #28c840;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 14px;
  font-size: 14px;
  line-height: 1.55;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25A1";
    }

}
`,
  light: `:host {
  --wm-radius: 12px;
  --wm-bg: rgba(255, 255, 255, 0.78);
  --wm-bg-focused: rgba(255, 255, 255, 0.94);
  --wm-border: rgba(15, 23, 42, 0.1);
  --wm-border-focused: rgba(15, 23, 42, 0.22);
  --wm-shadow: 0 6px 22px rgba(15, 23, 42, 0.12);
  --wm-shadow-focused: 0 16px 44px rgba(15, 23, 42, 0.2);
  --wm-titlebar-bg: rgba(15, 23, 42, 0.03);
  --wm-text: rgba(15, 23, 42, 0.92);
  --wm-text-dim: rgba(15, 23, 42, 0.55);
  --wm-accent: #4f46e5;
  --wm-blur: 18px;
  --wm-transition: 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.2);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.2);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--wm-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 120ms ease,
    transform 120ms ease;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  filter: brightness(1.1);
  transform: scale(1.12);
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-close] {
  background: #ff5f57;
}

[data-wm-minimize] {
  background: #febc2e;
}

[data-wm-maximize] {
  background: #28c840;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 14px;
  font-size: 14px;
  line-height: 1.55;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25A1";
    }

}
`,
  neon: `:host {
  --wm-radius: 16px;
  --wm-bg: rgba(13, 8, 30, 0.72);
  --wm-bg-focused: rgba(18, 11, 40, 0.84);
  --wm-border: rgba(124, 58, 237, 0.28);
  --wm-border-focused: rgba(236, 72, 153, 0.65);
  --wm-shadow: 0 10px 32px rgba(6, 2, 20, 0.6);
  --wm-shadow-focused: 0 0 0 1px rgba(236, 72, 153, 0.35), 0 18px 52px rgba(236, 72, 153, 0.28);
  --wm-titlebar-bg: linear-gradient(90deg, rgba(236, 72, 153, 0.16), rgba(56, 189, 248, 0.12));
  --wm-text: #f3e9ff;
  --wm-text-dim: rgba(243, 233, 255, 0.55);
  --wm-accent: #ec4899;
  --wm-accent-alt: #38bdf8;
  --wm-blur: 20px;
  --wm-transition: 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.6);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 200ms ease,
    border-color 200ms ease;
  animation: wm-window-in 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 200ms ease,
    border-color 200ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wm-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-text);
  text-shadow: 0 0 12px rgba(236, 72, 153, 0.55);
}

[data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    box-shadow 140ms ease,
    transform 140ms ease;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-close] {
  background: var(--wm-accent);
}

[data-wm-minimize] {
  background: #a855f7;
}

[data-wm-maximize] {
  background: var(--wm-accent-alt);
}

[data-wm-close]:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px var(--wm-accent);
}

[data-wm-minimize]:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px #a855f7;
}

[data-wm-maximize]:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px var(--wm-accent-alt);
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent-alt);
  outline-offset: 3px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.94;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  :host([data-wm-focused]) [data-wm-title] {
      text-shadow: none;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25A1";
    }

}
`,
  noir: `:host {
  --wm-radius: 0px;
  --wm-bg: #000000;
  --wm-bg-focused: #000000;
  --wm-border: rgba(255, 255, 255, 0.35);
  --wm-border-focused: #ffffff;
  --wm-shadow: none;
  --wm-shadow-focused: 0 0 0 1px #ffffff;
  --wm-titlebar-bg: #000000;
  --wm-text: #ffffff;
  --wm-text-dim: rgba(255, 255, 255, 0.55);
  --wm-accent: #ffffff;
  --wm-title-size: 11px;
  --wm-title-weight: 600;
  --wm-title-tracking: 0.24em;
  --wm-titlebar-padding: 11px 14px;
  --wm-transition: 200ms linear;
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  position: relative;
  border: 1.5px solid var(--wm-text-dim);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]:hover {
  background: #ffffff;
  border-color: #ffffff;
}

[data-wm-minimize]:hover {
  background: #ffffff;
  border-color: #ffffff;
}

[data-wm-maximize]:hover {
  background: #ffffff;
  border-color: #ffffff;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  paper: `:host {
  --wm-radius: 6px;
  --wm-bg: #fdfaf3;
  --wm-bg-focused: #fffdf8;
  --wm-border: rgba(84, 71, 51, 0.18);
  --wm-border-focused: rgba(84, 71, 51, 0.38);
  --wm-shadow: 2px 3px 0 rgba(84, 71, 51, 0.1);
  --wm-shadow-focused: 4px 6px 0 rgba(84, 71, 51, 0.16);
  --wm-titlebar-bg: rgba(84, 71, 51, 0.05);
  --wm-text: #3f382c;
  --wm-text-dim: rgba(63, 56, 44, 0.6);
  --wm-accent: #a8571b;
  --wm-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --wm-transition: 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
  box-shadow: none;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-serif);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--wm-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-wm-controls] {
  display: flex;
  gap: 10px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  padding: 0;
  position: relative;
  border: 1.5px solid var(--wm-text-dim);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -5px;
}

[data-wm-close]:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

[data-wm-minimize]:hover {
  background: var(--wm-accent);
  border-color: var(--wm-accent);
}

[data-wm-maximize]:hover {
  background: #4d7c0f;
  border-color: #4d7c0f;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 16px 18px;
  font-size: 14px;
  line-height: 1.65;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    translate: 0 6px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25A1";
    }

}
`,
  retro: `:host {
  --wm-face: #c0c0c0;
  --wm-face-light: #ffffff;
  --wm-face-dark: #808080;
  --wm-face-darker: #404040;
  --wm-title-active-a: #000080;
  --wm-title-active-b: #1084d0;
  --wm-title-inactive: #808080;
  --wm-text: #000000;
  --wm-text-dim: #404040;
  --wm-accent: #000080;
  --wm-title-text: #ffffff;
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-face);
  border: 2px solid;
  border-color: var(--wm-face-light) var(--wm-face-darker) var(--wm-face-darker)
    var(--wm-face-light);
  box-shadow: 1px 1px 0 var(--wm-face-dark);
  outline: none;
  contain: layout style;
  font-family: "Pixelated MS Sans Serif", "MS Sans Serif", Tahoma, sans-serif;
}

:host([hidden]) {
  display: none;
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 2px 2px 0 var(--wm-face-dark);
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  margin: 2px;
  background: linear-gradient(90deg, var(--wm-title-inactive), #b5b5b5);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-focused]) [data-wm-drag] {
  background: linear-gradient(90deg, var(--wm-title-active-a), var(--wm-title-active-b));
}

[data-wm-title] {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: var(--wm-title-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0;
}

[data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 16px;
  height: 14px;
  border: 1px solid;
  border-color: var(--wm-face-light) var(--wm-face-darker) var(--wm-face-darker)
    var(--wm-face-light);
  background: var(--wm-face);
  padding: 0;
  position: relative;
  cursor: pointer;
  font-size: 9px;
  line-height: 1;
  color: var(--wm-text);
}

[data-wm-close]::before,
[data-wm-minimize]::before,
[data-wm-maximize]::before {
  content: "";
  position: absolute;
  inset: -5px -4px;
}

[data-wm-close]:active,
[data-wm-minimize]:active,
[data-wm-maximize]:active {
  border-color: var(--wm-face-darker) var(--wm-face-light) var(--wm-face-light)
    var(--wm-face-darker);
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 1px dotted var(--wm-text);
  outline-offset: -3px;
}

[data-wm-minimize]::after {
  content: "_";
  font-weight: 700;
}

[data-wm-maximize]::after {
  content: "□";
  font-weight: 700;
}

[data-wm-close]::after {
  content: "✕";
  font-weight: 700;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 8px;
  margin: 0 2px 2px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--wm-face);
  border: 1px solid;
  border-color: var(--wm-face-dark) var(--wm-face-light) var(--wm-face-light) var(--wm-face-dark);
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host {
      animation: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  [data-wm-drag] {
      background: Canvas;
      color: CanvasText;
      border-bottom: 1px solid CanvasText;
    }

  :host([data-wm-focused]) [data-wm-drag] {
      background: Highlight;
      color: HighlightText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      border: 1px solid ButtonText;
      background: ButtonFace;
      color: ButtonText;
    }

}
`,
  synth: `:host {
  --wm-radius: 8px;
  --wm-bg: rgba(24, 12, 44, 0.82);
  --wm-bg-focused: rgba(30, 15, 54, 0.92);
  --wm-border: rgba(255, 138, 200, 0.3);
  --wm-border-focused: rgba(255, 200, 120, 0.75);
  --wm-shadow: 0 10px 28px rgba(10, 4, 24, 0.6);
  --wm-shadow-focused: 0 0 0 1px rgba(255, 200, 120, 0.4), 0 18px 50px rgba(255, 90, 170, 0.28);
  --wm-titlebar-bg: linear-gradient(90deg, #ff7ac6 0%, #ff9f6e 50%, #ffd36e 100%);
  --wm-text: #ffeaf7;
  --wm-text-dim: rgba(255, 234, 247, 0.62);
  --wm-accent: #ff7ac6;
  --wm-blur: 16px;
  --wm-title-size: 12px;
  --wm-title-weight: 700;
  --wm-title-tracking: 0.16em;
  --wm-title-color: #2a0d3d;
  --wm-title-color-focused: #1c0729;
  --wm-transition: 260ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  -webkit-backdrop-filter: blur(var(--wm-blur)) saturate(1.5);
  backdrop-filter: blur(var(--wm-blur)) saturate(1.5);
  border: var(--wm-border-width, 1px) solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 180ms ease,
    border-color 180ms ease;
  animation: wm-window-in 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 180ms ease,
    border-color 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms ease;
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wm-titlebar-padding, 10px 14px);
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-title-font, inherit);
  font-size: var(--wm-title-size, 13px);
  font-weight: var(--wm-title-weight, 600);
  letter-spacing: var(--wm-title-tracking, 0.01em);
  color: var(--wm-title-color, var(--wm-text-dim));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-title-color-focused, var(--wm-text));
}

[data-wm-controls] {
  display: flex;
  gap: 12px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  transition:
    filter 140ms ease,
    transform 140ms ease;
}

[data-wm-close] {
  background: #ff5f9e;
}

[data-wm-minimize] {
  background: #ffb35c;
}

[data-wm-maximize] {
  background: #7ce0ff;
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  filter: brightness(1.14);
  transform: scale(1.12);
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -6px;
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: var(--wm-content-padding, 14px 16px);
  font-family: var(--wm-content-font, inherit);
  font-size: 14px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

  [data-wm-close]:hover,
  [data-wm-minimize]:hover,
  [data-wm-maximize]:hover {
      transform: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-title] {
      color: CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      display: grid;
      place-items: center;
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      border-radius: 2px;
      background: ButtonFace;
      color: ButtonText;
      font-size: 10px;
      line-height: 1;
      box-shadow: none;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25a1";
    }

}
`,
  terminal: `:host {
  --wm-radius: 4px;
  --wm-bg: rgba(8, 14, 10, 0.9);
  --wm-bg-focused: rgba(10, 18, 13, 0.98);
  --wm-border: rgba(74, 222, 128, 0.22);
  --wm-border-focused: rgba(74, 222, 128, 0.55);
  --wm-shadow: 0 0 0 1px rgba(74, 222, 128, 0.06);
  --wm-shadow-focused: 0 0 24px rgba(74, 222, 128, 0.18);
  --wm-titlebar-bg: rgba(74, 222, 128, 0.07);
  --wm-text: #b8f5cd;
  --wm-text-dim: rgba(184, 245, 205, 0.55);
  --wm-accent: #4ade80;
  --wm-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --wm-transition: 120ms linear;
}

:host {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: var(--wm-text);
  background: var(--wm-bg);
  border: 1px solid var(--wm-border);
  border-radius: var(--wm-radius);
  box-shadow: var(--wm-shadow);
  font-family: var(--wm-mono);
  outline: none;
  contain: layout style;
  transition:
    transform var(--wm-transition),
    width var(--wm-transition),
    height var(--wm-transition),
    box-shadow 120ms linear,
    border-color 120ms linear;
  animation: wm-window-in 120ms linear;
}

:host([hidden]) {
  display: none;
}

:host([data-wm-focused]) {
  background: var(--wm-bg-focused);
  border-color: var(--wm-border-focused);
  box-shadow: var(--wm-shadow-focused);
}

:host([data-wm-dragging]),
:host([data-wm-resizing]),
:host([data-wm-pinching]) {
  transition:
    box-shadow 120ms linear,
    border-color 120ms linear;
  user-select: none;
  -webkit-user-select: none;
}

:host([data-wm-stage="maximized"]),
:host([data-wm-stage="snapped"]) {
  border-radius: 0;
}

:host([data-wm-flash]) {
  animation: wm-flash 320ms steps(6, end);
}

[data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--wm-titlebar-bg);
  border-bottom: 1px solid var(--wm-border);
  border-radius: var(--wm-radius) var(--wm-radius) 0 0;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

:host([data-wm-stage="maximized"]) [data-wm-drag],
:host([data-wm-stage="snapped"]) [data-wm-drag] {
  border-radius: 0;
}

[data-wm-title] {
  flex: 1;
  font-family: var(--wm-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--wm-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-wm-focused]) [data-wm-title] {
  color: var(--wm-accent);
}

[data-wm-controls] {
  display: flex;
  gap: 8px;
  align-items: center;
}

[data-wm-close],
[data-wm-minimize],
[data-wm-maximize] {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  position: relative;
  border: 1px solid var(--wm-border);
  border-radius: 2px;
  background: transparent;
  color: var(--wm-text-dim);
  font-family: var(--wm-mono);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 120ms linear,
    border-color 120ms linear,
    background 120ms linear;
}

[data-wm-close]::after,
[data-wm-minimize]::after,
[data-wm-maximize]::after {
  content: "";
  position: absolute;
  inset: -4px;
}

[data-wm-close]::before {
  content: "x";
}

[data-wm-minimize]::before {
  content: "-";
}

[data-wm-maximize]::before {
  content: "+";
}

[data-wm-close]:hover,
[data-wm-minimize]:hover,
[data-wm-maximize]:hover {
  color: var(--wm-accent);
  border-color: var(--wm-border-focused);
  background: rgba(74, 222, 128, 0.1);
}

[data-wm-close]:hover {
  color: #fca5a5;
  border-color: rgba(252, 165, 165, 0.6);
  background: rgba(252, 165, 165, 0.12);
}

[data-wm-close]:focus-visible,
[data-wm-minimize]:focus-visible,
[data-wm-maximize]:focus-visible {
  outline: 2px solid var(--wm-accent);
  outline-offset: 2px;
}

[data-wm-content] {
  flex: 1;
  overflow: auto;
  padding: 12px;
  font-family: var(--wm-mono);
  font-size: 13px;
  line-height: 1.6;
}

@keyframes wm-window-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wm-flash {
  0%,
  100% {
    translate: 0 0;
  }
  20% {
    translate: -6px 0;
  }
  45% {
    translate: 5px 0;
  }
  70% {
    translate: -3px 0;
  }
  90% {
    translate: 2px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      transition: none;
      animation: none;
    }

}

@media (forced-colors: active) {
  :host {
      background: Canvas;
      border: 1px solid CanvasText;
    }

  :host([data-wm-focused]) {
      border-color: Highlight;
    }

  [data-wm-drag] {
      background: Canvas;
      border-bottom: 1px solid CanvasText;
    }

  [data-wm-close],
  [data-wm-minimize],
  [data-wm-maximize] {
      width: 18px;
      height: 16px;
      border: 1px solid ButtonText;
      background: ButtonFace;
      color: ButtonText;
    }

  [data-wm-close]::before {
      content: "\\2715";
    }

  [data-wm-minimize]::before {
      content: "\\2013";
    }

  [data-wm-maximize]::before {
      content: "\\25A1";
    }

}
`,
}
