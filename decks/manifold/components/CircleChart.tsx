import { useState } from 'react'
import { useSvgDrag } from '@/figure/useSvgDrag'
import { mathItalic } from '@/figure/mathItalic'
import ResetButton from '@/figure/ResetButton'

/**
 * 円周 S^1 の座標近傍(SVG)。上半円 U = {(x, y) ∈ S^1 | y > 0} を、射影 φ(x, y) = x で開区間 (−1, 1) に写す。
 *   - 上半円の上の点 p(白抜きの丸)をドラッグすると、半円に沿って動き、その像 φ(p) が区間の上で付いてくる
 *   - キーボードでは Tab で p を選び、矢印キーで動かす(figure/useSvgDrag.ts)
 *   - 右上のボタンで初期状態に戻す
 * 半円の両端(y = 0 の 2 点)は U に入らないので白抜きで描く。
 */
const INITIAL_ANGLE = Math.PI / 3
/** 端に寄りすぎないように、角度をこの範囲に収める(端の 2 点は U に入らない) */
const MIN_ANGLE = 0.08

export default function CircleChart({ width = 560, height = 330 }: { width?: number; height?: number }) {
  const [angle, setAngle] = useState(INITIAL_ANGLE)
  // 円の中心と半径(図の座標)。区間は円の下に、同じ縮尺で置く。上に U のラベル、下に φ(p) のラベルの場所を取る
  const LABEL_SPACE = 36
  const r = Math.min(width * 0.3, (height - 3 * LABEL_SPACE) / 2)
  const cx = width / 2
  const cy = LABEL_SPACE + r
  const lineY = cy + r + LABEL_SPACE / 2
  const p = { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
  const image = p.x

  const bind = useSvgDrag((_id, point) => {
    const a = Math.atan2(cy - point.y, point.x - cx)
    setAngle(Math.min(Math.PI - MIN_ANGLE, Math.max(MIN_ANGLE, a)))
  })

  const arc = (from: number, to: number) =>
    `M ${cx + r * Math.cos(from)} ${cy - r * Math.sin(from)} A ${r} ${r} 0 0 ${from < to ? 0 : 1} ${cx + r * Math.cos(to)} ${cy - r * Math.sin(to)}`

  return (
    <div className="figure-block">
      <svg
        className="figure"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="group"
        aria-label="円周の上半円を、射影で開区間に写す座標近傍。上半円の上の点を動かせる"
      >
        {/* 下半円(U の外)と上半円(U) */}
        <path d={arc(Math.PI, 2 * Math.PI)} className="figure-ink-curve" />
        <path d={arc(0, Math.PI)} className="figure-curve" />
        {/* 開区間 (−1, 1) */}
        <line x1={cx - r} y1={lineY} x2={cx + r} y2={lineY} className="figure-curve" />
        {[cx - r, cx + r].map((x) => (
          <g key={x}>
            <circle cx={x} cy={cy} r={6} className="figure-handle" />
            <circle cx={x} cy={lineY} r={6} className="figure-handle" />
          </g>
        ))}
        {/* p から φ(p) への射影 */}
        <line x1={p.x} y1={p.y} x2={image} y2={lineY} className="figure-chart-projection" />
        <circle cx={image} cy={lineY} r={7} className="figure-point" />
        <circle cx={p.x} cy={p.y} r={8} className="figure-handle" {...bind('p', '上半円の上の点 p')} />
        <text x={p.x + 14} y={p.y - 10} className="figure-label">
          {mathItalic('p')}
        </text>
        <text x={image} y={lineY + 28} textAnchor="middle" className="figure-label">
          {`${mathItalic('φ')}(${mathItalic('p')}) = ${(Math.cos(angle)).toFixed(2)}`}
        </text>
        <text x={cx} y={cy - r - 14} textAnchor="middle" className="figure-label">
          {mathItalic('U')}
        </text>
        <text x={cx + r + 16} y={lineY + 6} className="figure-label">
          1
        </text>
        <text x={cx - r - 16} y={lineY + 6} textAnchor="end" className="figure-label">
          −1
        </text>
      </svg>
      <div className="figure-buttons">
        <ResetButton onClick={() => setAngle(INITIAL_ANGLE)} />
      </div>
    </div>
  )
}
