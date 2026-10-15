/**
 * モード(src/modes/。スライドを動かすライブラリごとの作り。docs/motion.md)と、まわり(図・開発時の道具・テスト)との約束。
 * 動き・段階表示・キー操作はライブラリに任せ、モードに頼むのはここにある 4 つだけ:
 *
 *   - announcePresent(slide)  今のスライドが変わったら知らせる(動く図が、表示中のスライドのときだけ動く)
 *   - registerGoTo(goTo)      「このスライドへ移る」を登録する(開発時の警告の一覧から、そのスライドへ移る)
 *   - markReady()             スライドを組み終えたら印を付ける(<html data-deck-ready>。テストと撮影が待つ)
 *   - スライドの要素に class="slide" と、変換が付ける原稿の位置(data-slide-line など)を付け、本文の範囲(class="deck")の中に
 *     文書の順で置く(deckSlides が拾う)
 *
 * スライドの表示の大きさは窓と同じ縦横比(deck/view-size.ts。CSS 変数なら watchViewSize の --deck-view-width /
 * --deck-view-height と倍率 --deck-scale)。最小サイズは CSS 変数 --deck-min-width / --deck-min-height(main.tsx が付ける。
 * はみ出しの枠が使う)。
 */
import { MIN_WIDTH, SLIDE_HEIGHT } from './slide-metrics'

/** 今のスライドが変わったときに document に送る出来事の名前。detail は今のスライドの要素 */
export const PRESENT_EVENT = 'deck:present'

let present: Element | null = null

/** モードが今のスライドを知らせる */
export function announcePresent(slide: Element) {
  present = slide
  document.dispatchEvent(new CustomEvent<Element>(PRESENT_EVENT, { detail: slide }))
}

/** 最後に知らされた今のスライド(後から描かれた図が、今の状態を知るため) */
export const presentSlide = () => present

let goTo: ((slide: HTMLElement) => void) | null = null

/** モードが「このスライドへ移る」を登録する */
export function registerGoTo(fn: (slide: HTMLElement) => void) {
  goTo = fn
}

/** そのスライドへ移る(モードが登録していなければ何もしない) */
export function goToSlide(slide: HTMLElement) {
  goTo?.(slide)
}

/** スライドを組み終えた印(<html data-deck-ready>) */
export function markReady() {
  document.documentElement.dataset.deckReady = ''
}

/** スライドの要素の選び方。class だけでなく原稿の位置も見る(reveal はスライドの class を背景の要素にも写す) */
export const SLIDE_SELECTOR = '.deck .slide[data-slide-line]'

/** 全スライドの要素(文書の順) */
export function deckSlides(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(SLIDE_SELECTOR)]
}

/**
 * スライドの最小サイズを CSS 変数 --deck-min-width / --deck-min-height にする(はみ出しの枠。devtools/devtools.css)。
 * 表示の大きさは別の変数(deck/view-size.ts の --deck-view-width / --deck-view-height)
 */
export function setMinSizeVariables() {
  const style = document.documentElement.style
  style.setProperty('--deck-min-width', `${MIN_WIDTH}px`)
  style.setProperty('--deck-min-height', `${SLIDE_HEIGHT}px`)
}
