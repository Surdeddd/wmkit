export function prefersReducedMotion(win: Window): boolean {
  if (typeof win.matchMedia !== 'function') return false
  return win.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface FlipGhostOptions {
  duration?: number
  easing?: string
}

export function measureFlip(
  source: HTMLElement,
  target: Element,
  options: FlipGhostOptions,
  back: boolean,
): (() => void) | undefined {
  const view = source.ownerDocument.defaultView
  if (!view || prefersReducedMotion(view)) return
  if (typeof source.animate !== 'function') return

  const s = source.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  if (s.width === 0 || t.width === 0) return

  const style = view.getComputedStyle(source)
  const css = `position:fixed;left:${s.left}px;top:${s.top}px;width:${s.width}px;height:${s.height}px;margin:0;pointer-events:none;z-index:2147483647;border-radius:${style.borderRadius};background:${style.backgroundColor};box-shadow:${style.boxShadow};transform-origin:top left;will-change:transform,opacity`
  const dx = t.left + t.width / 2 - (s.left + s.width / 2)
  const dy = t.top + t.height / 2 - (s.top + s.height / 2)
  const scaleX = Math.max(t.width / s.width, 0.05)
  const scaleY = Math.max(t.height / s.height, 0.05)
  const still = { transform: 'translate(0, 0) scale(1, 1)', opacity: 0.9 }
  const moved = {
    transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
    opacity: 0.2,
  }

  return () => {
    const ghost = source.ownerDocument.createElement('div')
    ghost.style.cssText = css
    const animation = ghost.animate(back ? [moved, still] : [still, moved], {
      duration: options.duration ?? 260,
      easing: options.easing ?? 'cubic-bezier(0.32, 0.72, 0, 1)',
    })
    source.ownerDocument.body.append(ghost)
    animation.onfinish = () => ghost.remove()
    animation.oncancel = () => ghost.remove()
  }
}

export function flipFromTarget(
  source: HTMLElement,
  target: Element,
  options: FlipGhostOptions = {},
): void {
  measureFlip(source, target, options, true)?.()
}

export function flipToTarget(
  source: HTMLElement,
  target: Element,
  options: FlipGhostOptions = {},
): void {
  measureFlip(source, target, options, false)?.()
}
