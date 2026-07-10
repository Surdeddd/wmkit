export function prefersReducedMotion(win: Window): boolean {
  return win.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface FlipGhostOptions {
  duration?: number
  easing?: string
}

export function flipToTarget(
  source: HTMLElement,
  target: Element,
  options: FlipGhostOptions = {},
): void {
  const view = source.ownerDocument.defaultView
  if (!view || prefersReducedMotion(view)) return
  if (typeof source.animate !== 'function') return

  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0 || to.width === 0) return

  const ghost = source.ownerDocument.createElement('div')
  const style = view.getComputedStyle(source)
  ghost.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;margin:0;pointer-events:none;z-index:2147483647;border-radius:${style.borderRadius};background:${style.backgroundColor};box-shadow:${style.boxShadow};transform-origin:top left;will-change:transform,opacity`
  source.ownerDocument.body.append(ghost)

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const scaleX = Math.max(to.width / from.width, 0.05)
  const scaleY = Math.max(to.height / from.height, 0.05)

  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1, 1)', opacity: 0.9 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, opacity: 0.2 },
    ],
    {
      duration: options.duration ?? 260,
      easing: options.easing ?? 'cubic-bezier(0.32, 0.72, 0, 1)',
    },
  )
  animation.onfinish = () => ghost.remove()
  animation.oncancel = () => ghost.remove()
}
