import { useRef, type PointerEvent } from 'react'

export type Point = { x: number; y: number }

/**
 * SVG の中の要素をドラッグで動かす。座標は SVG の座標(viewBox の座標)で返す。
 *
 * 座標は、SVG の画面上の位置と大きさ(getBoundingClientRect)と viewBox の比から求める。
 * reveal はスライドを CSS の transform(拡大時は zoom のこともある)で拡大縮小するが、
 * getBoundingClientRect は画面上の実際の見た目を返すので、どちらでも正しく合う
 * (getScreenCTM を使う方法 = visx の localPoint は、reveal の拡大縮小があると座標がずれる)。
 *
 *   const bind = useSvgDrag((id, point, start) => { … })
 *   <circle {...bind('a')} … />
 *
 * onDrag には、どの要素か(id)、今の位置、ドラッグを始めた位置が渡る。つかんだ所と要素の中心が
 * ずれていても跳ねないよう、要素は「始めた位置からの移動量」で動かすとよい。
 * ポインタを要素に捕まえる(setPointerCapture)ので、要素の外へ出てもドラッグが続く。
 */
export function useSvgDrag(onDrag: (id: string, point: Point, start: Point) => void) {
  const active = useRef<{ id: string; start: Point } | null>(null)

  const at = (e: PointerEvent<SVGElement>): Point => {
    const svg = e.currentTarget.ownerSVGElement ?? (e.currentTarget as SVGSVGElement)
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    return {
      x: vb.x + ((e.clientX - rect.left) * vb.width) / rect.width,
      y: vb.y + ((e.clientY - rect.top) * vb.height) / rect.height,
    }
  }

  return (id: string) => ({
    onPointerDown(e: PointerEvent<SVGElement>) {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      active.current = { id, start: at(e) }
    },
    onPointerMove(e: PointerEvent<SVGElement>) {
      if (active.current?.id !== id) return
      onDrag(id, at(e), active.current.start)
    },
    onPointerUp(e: PointerEvent<SVGElement>) {
      active.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    },
    // タッチ操作でページがスクロールしないように
    style: { cursor: 'grab', touchAction: 'none' } as const,
  })
}
