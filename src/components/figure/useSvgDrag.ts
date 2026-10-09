import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

export type Point = { x: number; y: number }

/** 矢印キー 1 回で動かす量(SVG の座標)。Shift を押していると 4 倍 */
const KEY_STEP = 4
const KEY_DIRECTIONS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

/**
 * SVG の中の要素をドラッグ(とキーボード)で動かす。座標は SVG の座標(viewBox の座標)で返す。
 *
 * 座標は、SVG の画面上の位置と大きさ(getBoundingClientRect)と viewBox の比から求める。
 * reveal はスライドを CSS の transform(拡大時は zoom のこともある)で拡大縮小するが、
 * getBoundingClientRect は画面上の実際の見た目を返すので、どちらでも正しく合う
 * (getScreenCTM を使う方法 = visx の localPoint は、reveal の拡大縮小があると座標がずれる)。
 *
 *   const bind = useSvgDrag((id, point, start) => { … })
 *   <circle {...bind('a', '点 a')} … />
 *
 * onDrag には、どの要素か(id)、今の位置、ドラッグを始めた位置が渡る。つかんだ所と要素の中心が
 * ずれていても跳ねないよう、要素は「始めた位置からの移動量」で動かすとよい。
 * ポインタを要素に捕まえる(setPointerCapture)ので、要素の外へ出てもドラッグが続く。
 *
 * キーボード: 要素は Tab キーで選べ、矢印キーで動かせる(要素の中心から矢印の向きへ動かすドラッグとして
 * onDrag に渡すので、図の側はドラッグと同じ処理で済む)。矢印キーはスライドの移動にも使われるので、
 * 要素を選んでいる間は reveal に渡さない。label は読み上げ用の説明(aria-label)。
 */
export function useSvgDrag(onDrag: (id: string, point: Point, start: Point) => void) {
  const active = useRef<{ id: string; start: Point } | null>(null)

  const svgOf = (el: SVGElement) => el.ownerSVGElement ?? (el as SVGSVGElement)

  const at = (e: PointerEvent<SVGElement>): Point => {
    const svg = svgOf(e.currentTarget)
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    return {
      x: vb.x + ((e.clientX - rect.left) * vb.width) / rect.width,
      y: vb.y + ((e.clientY - rect.top) * vb.height) / rect.height,
    }
  }

  /** 要素の中心(SVG の座標)。svg 要素そのものなら viewBox の中心 */
  const centerOf = (el: SVGElement): Point => {
    if (el instanceof SVGSVGElement) {
      const vb = el.viewBox.baseVal
      return { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 }
    }
    const box = (el as SVGGraphicsElement).getBBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  return (id: string, label?: string) => ({
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
    onKeyDown(e: KeyboardEvent<SVGElement>) {
      const dir = KEY_DIRECTIONS[e.key]
      if (!dir) return
      e.preventDefault()
      e.stopPropagation() // reveal のスライド移動にさせない
      const step = KEY_STEP * (e.shiftKey ? 4 : 1)
      const start = centerOf(e.currentTarget)
      onDrag(id, { x: start.x + dir.x * step, y: start.y + dir.y * step }, start)
    },
    tabIndex: 0,
    role: 'button',
    'aria-roledescription': 'ドラッグできる要素(矢印キーでも動かせる)',
    'aria-label': label,
    // タッチ操作でページがスクロールしないように
    style: { cursor: 'grab', touchAction: 'none' } as const,
  })
}
