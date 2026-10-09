import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { Line, LinePath } from '@visx/shape'
import { useSvgDrag } from './figure/useSvgDrag'
import { mathItalic } from './figure/mathItalic'
import PlayPauseButton from './figure/PlayPauseButton'
import { prefersReducedMotion, useOnPresentSlide } from './figure/motion'

/**
 * 3/2-カスプ γ(t) = (t², t³) と、その上の点での速度ベクトル・単位法線ベクトル(SVG・visx)。
 *   - 再生中は点が曲線の上を往復する(前身の資料の Blender の GIF と同じ動き)
 *   - 一時停止中は点を曲線に沿ってドラッグできる。再生すると止めた位置から動き出す
 *   - 右上のボタンで再生・一時停止を切り替える(再生中は一時停止の印、停止中は再生の印)
 *   - OS で動きを控える設定(prefers-reduced-motion)のときは、一時停止の状態で始める
 *
 * 速度ベクトル γ'(t) = (2t, 3t²)(赤)は原点 t = 0 で消えるが、単位法線ベクトル ν(t)/|ν(t)|、
 * ν(t) = (−3t, 2)(青)は t = 0 でも連続に定まって残る(ルジャンドル曲線)。これを見せるのがこの図の要点。
 * 2 つのベクトルは同じ倍率(VECTOR_SCALE)で描き、長さを正しく比べられるようにする。
 * 縦横の縮尺は等しい。
 */
const T_MAX = 1.15 // 描く曲線の範囲 −T_MAX ≤ t ≤ T_MAX
const T_SWING = 0.95 // 自動で往復する範囲
const PERIOD_MS = 6000 // 往復 1 回の時間
const INITIAL_T = 0.6
const VECTOR_SCALE = 0.3 // ベクトルを描く倍率(速度・単位法線とも同じ)

const gamma = (t: number) => ({ x: t * t, y: t * t * t })

export default function CuspNormal({ width = 420, height = 420 }: { width?: number; height?: number }) {
  const [t, setT] = useState(INITIAL_T)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const block = useRef<HTMLDivElement>(null)
  const present = useOnPresentSlide(block) // 動きの処理は表示中のスライドのときだけ回す
  const id = useId()
  const velocityHead = `${id}-velocity`
  const normalHead = `${id}-normal`

  // 縦横の縮尺を等しくする: 縦は −1.5〜1.5、横は同じ縮尺で x = −0.3 から
  const yHalf = 1.5
  const unit = height / (2 * yHalf)
  const x = scaleLinear({ domain: [-0.3, -0.3 + width / unit], range: [0, width] })
  const y = scaleLinear({ domain: [-yHalf, yHalf], range: [height, 0] })

  const samples = useMemo(() => Array.from({ length: 401 }, (_, i) => -T_MAX + (2 * T_MAX * i) / 400), [])

  // 往復(t = T_SWING·sin)。再生を始めるたびに、今の t から続ける位相を求める
  // (一時停止中のドラッグで往復の範囲の外へ出ていたら、端から始める)
  const tNow = useRef(t)
  tNow.current = t
  useEffect(() => {
    if (!playing || !present) return
    let frame = 0
    const t0 = performance.now()
    const p0 = Math.asin(Math.min(1, Math.max(-1, tNow.current / T_SWING)))
    const tick = (now: number) => {
      setT(T_SWING * Math.sin(p0 + ((now - t0) / PERIOD_MS) * 2 * Math.PI))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, present])

  // 一時停止中のドラッグ: ドラッグした位置にいちばん近い曲線の上の点へ
  const bind = useSvgDrag((_, point) => {
    const m = { x: x.invert(point.x), y: y.invert(point.y) }
    let best = samples[0]
    let bestDist = Infinity
    for (const s of samples) {
      const g = gamma(s)
      const d = (g.x - m.x) ** 2 + (g.y - m.y) ** 2
      if (d < bestDist) {
        bestDist = d
        best = s
      }
    }
    setT(best)
  })

  const g = gamma(t)
  const velocity = { x: 2 * t, y: 3 * t * t } // γ'(t)
  const nLen = Math.hypot(3 * t, 2)
  const normal = { x: (-3 * t) / nLen, y: 2 / nLen } // ν(t) / |ν(t)|
  const arrow = (v: { x: number; y: number }) => ({
    from: { x: x(g.x), y: y(g.y) },
    to: { x: x(g.x + v.x * VECTOR_SCALE), y: y(g.y + v.y * VECTOR_SCALE) },
  })
  // 長さ 0 の矢印は矢じりの向きが定まらないので、速度が消える所では描かない
  const showVelocity = Math.hypot(velocity.x, velocity.y) * VECTOR_SCALE * (height / 3) > 1

  return (
    <div className="figure-block" ref={block}>
      <svg className="figure" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label="3/2-カスプ γ(t) = (t², t³) と、その上の点での速度ベクトルと単位法線ベクトル">
        <defs>
          <marker id={velocityHead} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="figure-velocity-head" />
          </marker>
          <marker id={normalHead} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="figure-normal-head" />
          </marker>
        </defs>
        <AxisBottom top={y(0)} scale={x} tickValues={[]} axisClassName="figure-axis" />
        <AxisLeft left={x(0)} scale={y} tickValues={[]} axisClassName="figure-axis" />
        <text x={x(0) - 10} y={y(0) + 24} textAnchor="end" className="figure-label">
          {mathItalic('O')}
        </text>
        <text x={width - 8} y={y(0) + 24} textAnchor="end" className="figure-label">
          {mathItalic('x')}
        </text>
        <text x={x(0) - 10} y={18} textAnchor="end" className="figure-label">
          {mathItalic('y')}
        </text>
        <LinePath data={samples} x={(s) => x(gamma(s).x)} y={(s) => y(gamma(s).y)} className="figure-ink-curve" />
        {showVelocity && <Line {...arrow(velocity)} className="figure-velocity" markerEnd={`url(#${velocityHead})`} />}
        <Line {...arrow(normal)} className="figure-normal" markerEnd={`url(#${normalHead})`} />
        {/* 一時停止中だけドラッグできる */}
        <circle cx={x(g.x)} cy={y(g.y)} r={8} className="figure-point" {...(playing ? {} : bind('point', 'カスプの上の点(曲線に沿って動く)'))} />
      </svg>
      <div className="figure-buttons">
        <PlayPauseButton playing={playing} onToggle={() => setPlaying((p) => !p)} />
      </div>
    </div>
  )
}
