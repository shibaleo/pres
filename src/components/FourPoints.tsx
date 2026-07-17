import { useEffect, useRef } from 'react'
import JXG from 'jsxgraph'
import '../jsxgraph.css'

/**
 * 一直線上の4点 (旧 four-points-on-a-line.adoc の JSXGraph).
 *
 * 旧版は label に useMathJax:true で \( a \) を組んでいたが、
 * JSXGraph の KaTeX/MathJax ラベルはグローバル読み込みに依存するため、
 * ここでは素のラベル(a,b,c,d)にして依存を切る。見た目はほぼ同じ。
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
        label: { offset: [-5, 20], fontSize: 20 },
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
