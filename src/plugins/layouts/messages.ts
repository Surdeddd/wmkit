export interface LayoutMessages {
  label: string
  cell(layout: number, area: number, areas: number): string
  seam: string
}

export const layoutMessages: LayoutMessages = {
  label: 'Snap layouts',
  cell: (layout, area, areas) => `Layout ${layout}, area ${area} of ${areas}`,
  seam: 'Resize the windows on both sides',
}

export const layoutMessagesRu: LayoutMessages = {
  label: 'Раскладки окон',
  cell: (layout, area, areas) => `Раскладка ${layout}, область ${area} из ${areas}`,
  seam: 'Изменить размер окон по обе стороны',
}
