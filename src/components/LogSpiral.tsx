import { useId, useMemo, useState } from 'react'
import { scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridColumns, GridRows } from '@visx/grid'
import { Line, LinePath } from '@visx/shape'
import { useSvgDrag } from './figure/useSvgDrag'
import { mathItalic } from './figure/mathItalic'
import ResetButton from './figure/ResetButton'

/**
 * 対数螺旋 r(φ) = a·e^{bφ}(0 ≤ φ ≤ 8π。SVG・visx)。
 *   - スライダーで a・b を変えると形が変わる
 *   - 曲線の上の点をドラッグすると曲線に沿って動き、その点での接線(破線)がついてくる
 *   - 右上のボタンで初期状態に戻す
 * 縦横の縮尺は等しい。曲線と接線は描画範囲で切り取る(b が大きいと半径が急に大きくなるため)。
 */
const PHI_MAX = 8 * Math.PI
const STEPS = 1200
const Y_RANGE = 10 // 縦に見える範囲は -10〜10
const INITIAL = { a: 0.3, b: 0.15, phi: 3 * Math.PI }

type Sample = { phi: number; x: number; y: number }

export default function LogSpiral({ width = 600, height = 300 }: { width?: number; height?: number }) {
  const [a, setA] = useState(INITIAL.a)
  const [b, setB] = useState(INITIAL.b)
  const [phi, setPhi] = useState(INITIAL.phi)
  const clipId = useId()

  const unit = height / (2 * Y_RANGE)
  const x = scaleLinear({ domain: [-width / unit / 2, width / unit / 2], range: [0, width] })
  const y = scaleLinear({ domain: [-Y_RANGE, Y_RANGE], range: [height, 0] })

  const samples = useMemo<Sample[]>(
    () =>
      Array.from({ length: STEPS + 1 }, (_, i) => {
        const t = (PHI_MAX * i) / STEPS
        const r = a * Math.exp(b * t)
        return { phi: t, x: r * Math.cos(t), y: r * Math.sin(t) }
      }),
    [a, b],
  )

  // 曲線の上の点と、その点での接線の向き(極座標の曲線の微分: r' = b·r)
  const r = a * Math.exp(b * phi)
  const g = { x: r * Math.cos(phi), y: r * Math.sin(phi) }
  const d = { x: b * r * Math.cos(phi) - r * Math.sin(phi), y: b * r * Math.sin(phi) + r * Math.cos(phi) }
  const len = Math.hypot(d.x, d.y) || 1
  const reach = 4 * Y_RANGE // 接線は描画範囲より十分長く引いて、切り取りに任せる
  const tangent = {
    from: { x: x(g.x - (d.x / len) * reach), y: y(g.y - (d.y / len) * reach) },
    to: { x: x(g.x + (d.x / len) * reach), y: y(g.y + (d.y / len) * reach) },
  }

  // ドラッグした位置にいちばん近い曲線の上の点へ
  const bind = useSvgDrag((_, point) => {
    const m = { x: x.invert(point.x), y: y.invert(point.y) }
    let best = samples[0]
    let bestDist = Infinity
    for (const s of samples) {
      const dist = (s.x - m.x) ** 2 + (s.y - m.y) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = s
      }
    }
    setPhi(best.phi)
  })

  return (
    <div className="figure-block">
      <svg className="figure" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <defs>
          <clipPath id={clipId}>
            <rect width={width} height={height} />
          </clipPath>
        </defs>
        <GridRows scale={y} width={width} numTicks={10} className="figure-grid" />
        <GridColumns scale={x} height={height} numTicks={16} className="figure-grid" />
        <AxisBottom top={y(0)} scale={x} numTicks={8} hideZero axisClassName="figure-axis" />
        <AxisLeft left={x(0)} scale={y} numTicks={5} hideZero axisClassName="figure-axis" />
        <g clipPath={`url(#${clipId})`}>
          <LinePath data={samples} x={(s) => x(s.x)} y={(s) => y(s.y)} className="figure-curve" />
          <Line {...tangent} className="figure-tangent" />
        </g>
        <circle cx={x(g.x)} cy={y(g.y)} r={8} className="figure-point" {...bind('glider')} />
      </svg>
      <div className="figure-controls">
        <label>
          <span className="figure-label">{mathItalic('a')}</span>
          <input type="range" min={0} max={1} step={0.01} value={a} onChange={(e) => setA(Number(e.target.value))} />
          <output>{a.toFixed(2)}</output>
        </label>
        <label>
          <span className="figure-label">{mathItalic('b')}</span>
          <input type="range" min={-1} max={1} step={0.01} value={b} onChange={(e) => setB(Number(e.target.value))} />
          <output>{b.toFixed(2)}</output>
        </label>
      </div>
      <ResetButton
        onClick={() => {
          setA(INITIAL.a)
          setB(INITIAL.b)
          setPhi(INITIAL.phi)
        }}
      />
    </div>
  )
}
