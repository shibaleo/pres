import { useEffect, useRef } from 'react'
import JXG from 'jsxgraph'
import '../jsxgraph.css' // jsxgraph の exports がサブパスを塞ぐためローカルにコピー

/**
 * 対数螺旋 (logarithmic-spiral.adoc の移植).
 *
 * 旧版との違い:
 *   - `board` はこのコンポーネント内のローカル変数。グローバルに漏れない。
 *   - DOM id を手で採番する必要なし。ref で React が要素を管理。
 *   - アンマウント時に freeBoard で自動クリーンアップ。何枚並べても衝突しない。
 */
export default function LogSpiral({ width = 600, height = 300 }: { width?: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const board = JXG.JSXGraph.initBoard(ref.current, {
      boundingbox: [-10, 10, 10, -10],
      showCopyright: false,
      keepaspectratio: true,
    })
    const a = board.create('slider', [[1, -1], [5, -1], [0, 0.3, 1]], { name: 'a' })
    const b = board.create('slider', [[1, -2], [5, -2], [-1, 0.15, 1]], { name: 'b' })
    const c = board.create(
      'curve',
      [(phi: number) => a.Value() * Math.exp(b.Value() * phi), [0, 0], 0, 8 * Math.PI],
      { curveType: 'polar', strokewidth: 4 },
    )
    const g = board.create('glider', [c])
    board.create('tangent', [g], { dash: 2, strokeColor: '#a612a9' })

    return () => JXG.JSXGraph.freeBoard(board)
  }, [])

  return <div ref={ref} style={{ width, height, margin: '0 auto' }} />
}
