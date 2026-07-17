/**
 * 棒グラフのサムネ (旧 bar-chart.js の移植).
 *
 * 旧版は d3 で #bar-chart に <svg> を append する IIFE。
 * ここは静的な図なので d3 を使わず JSX で SVG を直接描く
 * (「React が DOM を持ち、D3 は計算だけ」の最も単純な形)。
 */
export default function BarChart({ width = 600, height = 300 }: { width?: number; height?: number }) {
  const data = [30, 10, 20, 80, 100, 40, 70, 90, 60, 50]
  const barWidth = 44
  const gap = 48
  const xMin = (width - data.length * gap) / 2
  return (
    <svg width={width} height={height} className="mx-auto block">
      {data.map((d, i) => (
        <rect
          key={i}
          x={xMin + i * gap}
          y={height - d * 2}
          width={barWidth}
          height={d * 2}
          fill="#4360f4"
          stroke="#4360f4"
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}
