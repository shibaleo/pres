import { useRef, useState } from 'react'
import { scaleLinear } from '@visx/scale'
import { Line } from '@visx/shape'
import { useSvgDrag, type Point } from './figure/useSvgDrag'
import ResetButton from './figure/ResetButton'

/**
 * 一直線上の 4 点(SVG・visx)。
 *   - 線分の両端(白抜きの丸)をドラッグすると線分が動く
 *   - 線分そのものをドラッグすると平行移動する
 *   - 点 a〜d は線分とは独立に、どこへでも動かせる(初めは線分の上に並んでいる)
 *   - 右上のボタンで初期状態に戻す
 * 縦横の縮尺は等しい(幾何の図なので)。
 */
const LABELS = ['a', 'b', 'c', 'd']
const MATH_WIDTH = 7 // 横に見える範囲(座標の単位)
const INITIAL_ENDS: [Point, Point] = [
  { x: -1, y: 0 },
  { x: 4, y: 0 },
]
const INITIAL_POINTS: Point[] = LABELS.map((_, i) => ({ x: i, y: 0 }))

export default function FourPoints({ width = 600, height = 200 }: { width?: number; height?: number }) {
  const [ends, setEnds] = useState(INITIAL_ENDS)
  const [points, setPoints] = useState(INITIAL_POINTS)
  // ドラッグを始めたときの位置(どの要素も「始めた位置 + 移動量」で動かし、つかんだ所がずれていても跳ねない)
  const origin = useRef<{ start: Point; ends: [Point, Point]; points: Point[] } | null>(null)

  // 縦横の縮尺を等しくする: 横 MATH_WIDTH の範囲に合わせ、縦は同じ縮尺で中央に 0
  const unit = width / MATH_WIDTH
  const x = scaleLinear({ domain: [-2, -2 + MATH_WIDTH], range: [0, width] })
  const y = scaleLinear({ domain: [-height / unit / 2, height / unit / 2], range: [height, 0] })
  const toMath = (p: Point): Point => ({ x: x.invert(p.x), y: y.invert(p.y) })

  const [p, q] = ends

  const bind = useSvgDrag((id, point, start) => {
    if (origin.current?.start !== start) origin.current = { start, ends, points }
    const o = origin.current
    const m = toMath(point)
    const s = toMath(start)
    const move = (a: Point): Point => ({ x: a.x + m.x - s.x, y: a.y + m.y - s.y })
    if (id === 'p') setEnds([move(o.ends[0]), o.ends[1]])
    else if (id === 'q') setEnds([o.ends[0], move(o.ends[1])])
    else if (id === 'line') setEnds([move(o.ends[0]), move(o.ends[1])])
    else {
      const i = LABELS.indexOf(id)
      setPoints(o.points.map((old, j) => (j === i ? move(old) : old)))
    }
  })

  const reset = () => {
    setEnds(INITIAL_ENDS)
    setPoints(INITIAL_POINTS)
  }

  return (
    <div className="figure-block">
      <svg className="figure" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        {/* 線分そのもの: 見た目より太い透明な線でつかみやすくする */}
        <Line from={{ x: x(p.x), y: y(p.y) }} to={{ x: x(q.x), y: y(q.y) }} className="figure-ink" strokeWidth={2} />
        <Line
          from={{ x: x(p.x), y: y(p.y) }}
          to={{ x: x(q.x), y: y(q.y) }}
          stroke="transparent"
          strokeWidth={16}
          {...bind('line')}
        />
        {(['p', 'q'] as const).map((id, i) => (
          <circle key={id} cx={x(ends[i].x)} cy={y(ends[i].y)} r={7} className="figure-handle" {...bind(id)} />
        ))}
        {LABELS.map((label, i) => (
          <g key={label} {...bind(label)}>
            <circle cx={x(points[i].x)} cy={y(points[i].y)} r={7} className="figure-point" />
            <text x={x(points[i].x)} y={y(points[i].y) - 16} textAnchor="middle" className="figure-label">
              {label}
            </text>
          </g>
        ))}
      </svg>
      <ResetButton onClick={reset} />
    </div>
  )
}
