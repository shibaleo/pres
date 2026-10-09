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
 * 縦横の縮尺は等しい。描画範囲は曲線全体が収まるように a・b から決め(曲線の外接矩形に余白 MARGIN を足す)、
 * 接線だけを描画範囲で切り取る。
 */
const PHI_MAX = 8 * Math.PI
const STEPS = 1200
const MARGIN = 0.1 // 描画範囲の余白(曲線の大きさに対する割合)
const MIN_EXTENT = 1 // a = 0 などで曲線が点に縮んだときの描画範囲の半幅
const INITIAL = { a: 0.3, b: 0.15, phi: 3 * Math.PI }

type Sample = { phi: number; x: number; y: number }

export default function LogSpiral({ width = 600, height = 300 }: { width?: number; height?: number }) {
  const [a, setA] = useState(INITIAL.a)
  const [b, setB] = useState(INITIAL.b)
  const [phi, setPhi] = useState(INITIAL.phi)
  const clipId = useId()

  const samples = useMemo<Sample[]>(
    () =>
      Array.from({ length: STEPS + 1 }, (_, i) => {
        const t = (PHI_MAX * i) / STEPS
        const r = a * Math.exp(b * t)
        return { phi: t, x: r * Math.cos(t), y: r * Math.sin(t) }
      }),
    [a, b],
  )

  // 原点を中心に、曲線の外接矩形が収まる最小の範囲(縦横の縮尺は等しい)
  const extent = samples.reduce((m, s) => ({ x: Math.max(m.x, Math.abs(s.x)), y: Math.max(m.y, Math.abs(s.y)) }), { x: 0, y: 0 })
  const unit = Math.min(width / (2 * Math.max(extent.x, MIN_EXTENT)), height / (2 * Math.max(extent.y, MIN_EXTENT))) / (1 + MARGIN)
  const x = scaleLinear({ domain: [-width / unit / 2, width / unit / 2], range: [0, width] })
  const y = scaleLinear({ domain: [-height / unit / 2, height / unit / 2], range: [height, 0] })

  // 曲線の上の点と、その点での接線の向き(極座標の曲線の微分: r' = b·r)
  const r = a * Math.exp(b * phi)
  const g = { x: r * Math.cos(phi), y: r * Math.sin(phi) }
  const d = { x: b * r * Math.cos(phi) - r * Math.sin(phi), y: b * r * Math.sin(phi) + r * Math.cos(phi) }
  const len = Math.hypot(d.x, d.y) || 1
  const reach = 2 * Math.hypot(width, height) / unit // 接線は描画範囲より十分長く引いて、切り取りに任せる
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
      <svg className="figure" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label="対数螺旋 r(φ) = a·e^{bφ} と、曲線の上の点での接線">
        <defs>
          <clipPath id={clipId}>
            <rect width={width} height={height} />
          </clipPath>
        </defs>
        <GridRows scale={y} width={width} numTicks={10} className="figure-grid" />
        <GridColumns scale={x} height={height} numTicks={16} className="figure-grid" />
        <AxisBottom top={y(0)} scale={x} numTicks={8} hideZero axisClassName="figure-axis" />
        <AxisLeft left={x(0)} scale={y} numTicks={5} hideZero axisClassName="figure-axis" />
        <LinePath data={samples} x={(s) => x(s.x)} y={(s) => y(s.y)} className="figure-curve" />
        <Line {...tangent} className="figure-tangent" clipPath={`url(#${clipId})`} />
        <circle cx={x(g.x)} cy={y(g.y)} r={8} className="figure-point" {...bind('glider', '曲線の上の点(曲線に沿って動く)')} />
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
      <div className="figure-buttons">
        <ResetButton
          onClick={() => {
            setA(INITIAL.a)
            setB(INITIAL.b)
            setPhi(INITIAL.phi)
          }}
        />
      </div>
    </div>
  )
}
