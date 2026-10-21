/** Chart palette: chart-1 … chart-6 tokens. Class names are spelled out so Tailwind can see them. */
export interface ChartColor {
  bg: string
  stroke: string
}

export const CHART_COLORS: readonly ChartColor[] = [
  { bg: 'bg-chart-1', stroke: 'stroke-chart-1' },
  { bg: 'bg-chart-2', stroke: 'stroke-chart-2' },
  { bg: 'bg-chart-3', stroke: 'stroke-chart-3' },
  { bg: 'bg-chart-4', stroke: 'stroke-chart-4' },
  { bg: 'bg-chart-5', stroke: 'stroke-chart-5' },
  { bg: 'bg-chart-6', stroke: 'stroke-chart-6' },
]

export const getChartColor = (index: number): ChartColor => CHART_COLORS[index % CHART_COLORS.length]
