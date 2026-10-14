import { useSyncExternalStore } from 'react'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { viewSize } from '../../deck/view-size'

/**
 * スライドの論理サイズ。reveal はこの大きさで組んでからウィンドウに合わせて縮小する。
 * 画面では、どのモードとも同じく窓と同じ縦横比(deck/view-size.ts)。
 *
 * PDF 出力(?print-pdf)では、論理サイズを紙の大きさ(PRINT_PAPER)にする。reveal は論理サイズを
 * そのまま @page の大きさ(CSS の px)にするので、mm を px に直して渡せば PDF のページが紙と一致する。
 */
export { MIN_WIDTH, SLIDE_HEIGHT }

/** PDF 出力の紙の大きさ(mm)。既定は A4 横。B5 横なら { width: 257, height: 182 } など */
export const PRINT_PAPER = { width: 297, height: 210 }

/** CSS の 1mm(= 96px / 25.4mm) */
const PX_PER_MM = 96 / 25.4

const params = new URLSearchParams(location.search)
export const isPrint = params.has('print-pdf')
/**
 * 配布用の PDF(?print-pdf&handout)。Beamer の handout モード(\documentclass[handout]{beamer})と同じく、
 * 段階表示をステップごとのページに分けず、1 枚のスライドを最後のステップの状態で 1 ページにする
 * (reveal の pdfSeparateFragments: false。fragment をすべて表示した状態で組む)
 */
export const isHandout = isPrint && params.has('handout')

export type SlideSize = { width: number; height: number }

// 紙からはみ出して 2 ページに分かれないよう、切り捨てる(reveal も切り捨てて @page にする)
let last: SlideSize = {
  width: Math.floor(PRINT_PAPER.width * PX_PER_MM),
  height: Math.floor(PRINT_PAPER.height * PX_PER_MM),
}

function measure(): SlideSize {
  if (isPrint) return last
  const { width, height } = viewSize()
  // useSyncExternalStore は同じ値なら同じオブジェクトを返す必要がある
  if (width !== last.width || height !== last.height) last = { width, height }
  return last
}

function subscribe(onChange: () => void) {
  addEventListener('resize', onChange)
  return () => removeEventListener('resize', onChange)
}

/** ウィンドウの大きさが変わると更新されるスライドの論理サイズ */
export function useSlideSize(): SlideSize {
  return useSyncExternalStore(subscribe, measure)
}
