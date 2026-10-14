import { useSyncExternalStore } from 'react'
import { MIN_WIDTH, SLIDE_HEIGHT } from './slide-metrics'

/**
 * スライドの表示の大きさ(論理座標の px)と、それを窓に合わせる倍率。どのモードも同じ決め方をする。
 *
 * 大きさは窓と同じ縦横比にし、スライドが常に窓全体を覆うようにする(固定の縦横比だと窓との差が上下や左右の余白になり、
 * 題の帯が窓の端に届かないため)。最小サイズ(MIN_WIDTH × SLIDE_HEIGHT)が収まる最大の倍率で縮小したときの窓全体の大きさで、
 * 窓が横長なら横に、縦長なら縦に広がる。原稿が当てにしてよいのは最小サイズだけ(はみ出しの検査も最小サイズで行う。devtools/overflow.ts)。
 */
export type ViewSize = { width: number; height: number; scale: number }

let last: ViewSize = { width: MIN_WIDTH, height: SLIDE_HEIGHT, scale: 1 }

/** 今の窓での表示の大きさ(同じ値なら同じオブジェクト。useSyncExternalStore のため) */
export function viewSize(): ViewSize {
  const fit = Math.min(innerWidth / MIN_WIDTH, innerHeight / SLIDE_HEIGHT)
  const width = Math.round(innerWidth / fit)
  const height = Math.round(innerHeight / fit)
  // 倍率は丸めた大きさから求め直し、窓を必ず覆うようにする(丸める前の倍率だと、端に 1px 未満の隙間ができて隣のスライドの縁が見える。
  // 覆いすぎる分は 1px 未満で、窓の外で切れる)
  const scale = Math.max(innerWidth / width, innerHeight / height)
  if (width !== last.width || height !== last.height || scale !== last.scale) last = { width, height, scale }
  return last
}

function subscribe(onChange: () => void) {
  addEventListener('resize', onChange)
  return () => removeEventListener('resize', onChange)
}

/** 窓の大きさが変わると更新される表示の大きさ(React の部品で使う) */
export function useViewSize(): ViewSize {
  return useSyncExternalStore(subscribe, viewSize)
}

/**
 * 表示の大きさを CSS 変数にし、窓の大きさが変わるたびに直す(自分では大きさを決めないライブラリのモード用):
 * --deck-view-width / --deck-view-height はスライドの大きさ、--deck-scale は窓に合わせる倍率。返す関数で止める
 */
export function watchViewSize(): () => void {
  const update = () => {
    const { width, height, scale } = viewSize()
    const style = document.documentElement.style
    style.setProperty('--deck-view-width', `${width}px`)
    style.setProperty('--deck-view-height', `${height}px`)
    style.setProperty('--deck-scale', String(scale))
  }
  update()
  addEventListener('resize', update)
  return () => removeEventListener('resize', update)
}
