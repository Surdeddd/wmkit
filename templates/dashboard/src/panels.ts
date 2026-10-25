import type { texts } from './i18n'

type Text = ReturnType<typeof texts>

const SVG = 'http://www.w3.org/2000/svg'

export function renderKpis(root: HTMLElement, t: Text, tick: number): void {
  const revenue = 18_400 + tick * 37
  const tiles: Array<[string, string]> = [
    [t.revenue, `$${revenue.toLocaleString('en-US')}`],
    [t.ordersToday, String(212 + Math.floor(tick / 3))],
    [t.conversion, `${(3.1 + Math.sin(tick / 5) * 0.2).toFixed(2)}%`],
    [t.latency, `${Math.round(180 + Math.cos(tick / 4) * 25)} ms`],
  ]
  root.replaceChildren(
    ...tiles.map(([label, value]) => {
      const tile = document.createElement('div')
      tile.className = 'kpi'
      const name = document.createElement('span')
      name.textContent = label
      const figure = document.createElement('strong')
      figure.textContent = value
      tile.append(name, figure)
      return tile
    }),
  )
}

export function renderChart(svg: SVGSVGElement, t: Text, points: readonly number[]): void {
  const max = Math.max(...points, 1)
  const step = 400 / Math.max(points.length - 1, 1)
  const line = points.map(
    (value, i) => `${(i * step).toFixed(1)},${(150 - (value / max) * 130).toFixed(1)}`,
  )
  const area = document.createElementNS(SVG, 'polygon')
  area.setAttribute('points', `0,160 ${line.join(' ')} 400,160`)
  area.setAttribute('class', 'chart-area')
  const path = document.createElementNS(SVG, 'polyline')
  path.setAttribute('points', line.join(' '))
  path.setAttribute('class', 'chart-line')
  path.setAttribute('vector-effect', 'non-scaling-stroke')
  const title = document.createElementNS(SVG, 'title')
  title.textContent = t.chartLabel
  svg.replaceChildren(title, area, path)
}

export function renderOrders(head: HTMLElement, body: HTMLElement, t: Text, tick: number): void {
  head.replaceChildren(
    ...t.columns.map((name) => {
      const cell = document.createElement('th')
      cell.textContent = name
      return cell
    }),
  )
  const customers = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Barbara']
  body.replaceChildren(
    ...Array.from({ length: 6 }, (_, i) => {
      const row = document.createElement('tr')
      const id = 4180 + tick + i
      const cells = [
        `#${id}`,
        customers[(id + i) % customers.length] as string,
        `$${(40 + ((id * 37) % 260)).toFixed(2)}`,
        t.statuses[(id + i) % t.statuses.length] as string,
      ]
      row.append(
        ...cells.map((text) => {
          const cell = document.createElement('td')
          cell.textContent = text
          return cell
        }),
      )
      return row
    }),
  )
}

export function appendLog(list: HTMLElement, t: Text, tick: number): void {
  const item = document.createElement('li')
  const time = new Date().toLocaleTimeString('en-GB')
  item.textContent = `${time}  ${t.events[tick % t.events.length]}`
  list.prepend(item)
  while (list.children.length > 40) list.lastElementChild?.remove()
}
