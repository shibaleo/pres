import { useEffect, useRef } from 'react'
import JXG from 'jsxgraph'
import katex from 'katex'
import '../jsxgraph.css'

// JSXGraph の useKatex はグローバル変数 `katex` を参照する(import はしない)。
// CDN ではなく同梱済みの KaTeX を渡す。代入するのはこの1つだけ。
;(globalThis as unknown as { katex: typeof katex }).katex = katex

/**
 * 一直線上の4点 (旧 four-points-on-a-line.adoc の JSXGraph).
 *
 * 旧版は label に useMathJax:true で \( a \) を組んでいた。
 * ここではバンドル済み KaTeX で同じ数式ラベルを描く(オフラインでも動く)。
 */
export default function FourPoints({ width = 600, height = 200 }: { width?: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const board = JXG.JSXGraph.initBoard(ref.current, {
      boundingbox: [-2, 2, 5, -2],
      axis: false,
      showCopyright: false,
      showNavigation: false,
    })
    const pointColor = '#444'
    const labels = ['a', 'b', 'c', 'd']
    labels.forEach((label, i) => {
      board.create('point', [i, 0], {
        name: label,
        label: { offset: [-5, 20], fontSize: 20, useKatex: true },
        strokeColor: pointColor,
        fillColor: pointColor,
        size: 5,
        fixed: true,
      })
    })
    board.create('segment', [[-1, 0], [4, 0]], { strokeWidth: 2, strokeColor: pointColor })

    return () => JXG.JSXGraph.freeBoard(board)
  }, [])

  return (
    <div
      ref={ref}
      className="mx-auto border border-gray-300"
      style={{ width, height }}
    />
  )
}
