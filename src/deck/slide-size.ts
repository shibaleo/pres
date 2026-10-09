import { useSyncExternalStore } from 'react'

/**
 * スライドの論理サイズ。reveal はこの大きさで組んでからウィンドウに合わせて縮小する。
 *
 * 論理サイズはウィンドウと同じ縦横比にし、スライドが常にウィンドウ全体を覆うようにする。
 * 固定の縦横比だとウィンドウとの差が上下や左右の余白になり、題の帯がウィンドウの端に届かないため。
 * 原稿が当てにしてよいのは最小サイズ(MIN_WIDTH × SLIDE_HEIGHT)だけで、
 * ウィンドウが横長なら横に、縦長なら縦に広がる。はみ出しの検査も最小サイズで行う(deck/overflow.ts)。
 *
 * PDF 出力(?print-pdf)では、論理サイズを紙の大きさ(PRINT_PAPER)にする。reveal は論理サイズを
 * そのまま @page の大きさ(CSS の px)にするので、mm を px に直して渡せば PDF のページが紙と一致する。
 */
export const SLIDE_HEIGHT = 700
export const MIN_WIDTH = Math.round((SLIDE_HEIGHT * 4) / 3)

/** PDF 出力の紙の大きさ(mm)。既定は A4 横。B5 横なら { width: 257, height: 182 } など */
export const PRINT_PAPER = { width: 297, height: 210 }

/** CSS の 1mm(= 96px / 25.4mm) */
const PX_PER_MM = 96 / 25.4

export const isPrint = new URLSearchParams(location.search).has('print-pdf')

export type SlideSize = { width: number; height: number }

// 紙からはみ出して 2 ページに分かれないよう、切り捨てる(reveal も切り捨てて @page にする)
let last: SlideSize = {
  width: Math.floor(PRINT_PAPER.width * PX_PER_MM),
  height: Math.floor(PRINT_PAPER.height * PX_PER_MM),
}

function measure(): SlideSize {
  if (isPrint) return last
  // 最小サイズが収まる最大の倍率で縮小したときの、ウィンドウ全体の論理サイズ
  const scale = Math.min(innerWidth / MIN_WIDTH, innerHeight / SLIDE_HEIGHT)
  const width = Math.round(innerWidth / scale)
  const height = Math.round(innerHeight / scale)
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
