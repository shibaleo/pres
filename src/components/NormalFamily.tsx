import { useId, useMemo, useRef, useState } from 'react'
import { scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { LinePath } from '@visx/shape'
import { useSvgDrag, type Point } from './figure/useSvgDrag'
import { mathItalic } from './figure/mathItalic'
import ResetButton from './figure/ResetButton'

/**
 * 正規分布の族(SVG・visx)。左はパラメタ空間 H = {(μ, σ) | σ > 0}、右はその点の密度関数 p(x; μ, σ)。
 *   - 左の点をドラッグすると、同じ色の密度関数の形が右で変わる
 *   - 右上のボタンで初期状態(μ = 0、σ = 0.1, 0.5, 0.9。前身の資料の図と同じ)に戻す
 * 密度の山は σ が小さいと高くなるので、右の図の上は切り取る。
 */
const SIGMA_MAX = 1.2
// 左の枠は正方形で縦横の縮尺を等しくするので、μ の範囲は σ の範囲と同じ幅
const MU_RANGE: [number, number] = [-SIGMA_MAX / 2, SIGMA_MAX / 2]
const SIGMA_MIN = 0.05
const X_RANGE: [number, number] = [-3, 3]
const P_MAX = 2.5
const INITIAL: Point[] = [
  { x: 0, y: 0.1 },
  { x: 0, y: 0.5 },
  { x: 0, y: 0.9 },
] // (μ, σ)

const density = (x: number, mu: number, sigma: number) =>
  Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (Math.sqrt(2 * Math.PI) * sigma)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function NormalFamily({ width = 880, height = 360 }: { width?: number; height?: number }) {
  const [params, setParams] = useState(INITIAL)
  const origin = useRef<{ start: Point; params: Point[] } | null>(null)
  const clipId = useId()

  // 左右の枠。左は正方形(縦横の縮尺が等しい)、右は残りの幅
  const pad = 28
  const gap = 72
  const plotH = height - 2 * pad
  const leftW = plotH
  const rightX0 = pad + leftW + gap
  const rightW = width - rightX0 - pad

  const mu = scaleLinear({ domain: MU_RANGE, range: [pad, pad + leftW] })
  const sigma = scaleLinear({ domain: [0, SIGMA_MAX], range: [pad + plotH, pad] })
  const xs = scaleLinear({ domain: X_RANGE, range: [rightX0, rightX0 + rightW] })
  const ps = scaleLinear({ domain: [0, P_MAX], range: [pad + plotH, pad] })

  const grid = useMemo(() => Array.from({ length: 601 }, (_, i) => X_RANGE[0] + ((X_RANGE[1] - X_RANGE[0]) * i) / 600), [])

  const bind = useSvgDrag((id, point, start) => {
    if (origin.current?.start !== start) origin.current = { start, params }
    const i = Number(id)
    const o = origin.current.params[i]
    const d = { mu: mu.invert(point.x) - mu.invert(start.x), sigma: sigma.invert(point.y) - sigma.invert(start.y) }
    const next = { x: clamp(o.x + d.mu, MU_RANGE[0], MU_RANGE[1]), y: clamp(o.y + d.sigma, SIGMA_MIN, SIGMA_MAX) }
    setParams(origin.current.params.map((p, j) => (j === i ? next : p)))
  })

  return (
    <div className="figure-block">
      <svg className="figure" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label="正規分布のパラメタ空間 H の点と、それぞれの密度関数">
        <defs>
          <clipPath id={clipId}>
            <rect x={rightX0} y={pad} width={rightW} height={plotH} />
          </clipPath>
        </defs>

        {/* 左: パラメタ空間 H */}
        <AxisBottom top={pad + plotH} scale={mu} tickValues={[-0.5, 0, 0.5]} axisClassName="figure-axis" />
        <AxisLeft left={mu(0)} scale={sigma} tickValues={[0.5, 1]} axisClassName="figure-axis" />
        <text x={pad + leftW} y={pad + plotH - 8} textAnchor="end" className="figure-label">
          {mathItalic('μ')}
        </text>
        <text x={mu(0) + 10} y={pad + 4} className="figure-label">
          {mathItalic('σ')}
        </text>
        <text x={pad + 4} y={pad + 4} className="figure-label">
          {mathItalic('H')}
        </text>

        {/* 右: 密度関数 */}
        <AxisBottom top={pad + plotH} scale={xs} tickValues={[-2, -1, 0, 1, 2]} axisClassName="figure-axis" />
        <AxisLeft left={xs(0)} scale={ps} tickValues={[1, 2]} axisClassName="figure-axis" />
        <text x={rightX0 + rightW} y={pad + plotH - 8} textAnchor="end" className="figure-label">
          {mathItalic('x')}
        </text>
        <text x={xs(0) + 10} y={pad + 4} className="figure-label">
          {mathItalic('p')}
        </text>
        <g clipPath={`url(#${clipId})`}>
          {params.map((p, i) => (
            <LinePath
              key={i}
              data={grid}
              x={(v) => xs(v)}
              y={(v) => ps(density(v, p.x, p.y))}
              className={`figure-series figure-series-${i}`}
            />
          ))}
        </g>

        {/* 左の点と、その (μ, σ) の値(右の曲線より手前に描き、つかみやすくする) */}
        {params.map((p, i) => (
          <g key={i} className={`figure-series-${i}`}>
            <text x={mu(p.x) + 14} y={sigma(p.y) + 6} className="figure-legend">
              ({p.x.toFixed(2)}, {p.y.toFixed(2)})
            </text>
            <circle cx={mu(p.x)} cy={sigma(p.y)} r={8} className="figure-series-point" {...bind(String(i), `パラメタ空間の点 ${i + 1}(μ, σ)`)} />
          </g>
        ))}
      </svg>
      <div className="figure-buttons">
        <ResetButton onClick={() => setParams(INITIAL)} />
      </div>
    </div>
  )
}
