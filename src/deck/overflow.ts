import type { useReveal } from '@revealjs/react'
import { MIN_WIDTH, SLIDE_HEIGHT } from './slide-size'

// reveal.js 5 は型定義を同梱しないので、@revealjs/react の戻り値型から取る
type RevealApi = NonNullable<ReturnType<typeof useReveal>>

/**
 * 開発時だけ: スライドの最小サイズ(MIN_WIDTH × SLIDE_HEIGHT)からはみ出したスライドを検出する。
 *
 * スライドはウィンドウ全体を覆うので、いま見えている大きさで測ると見落とす
 * (縦長のウィンドウなら縦に、横長なら横に広がって収まって見え、横長では行の折り返しも減って低くなる)。
 * そこで検査のときだけスライドを最小の幅で組み直して縦横を測り、すぐ戻す(描画の前に戻るので画面には出ない)。
 *
 * reveal ははみ出し部分を黙って切るので、気づけるように
 *   - 最小サイズの範囲に赤い破線の枠と超過量のバッジ(theme/base.css の .deck-overflow)
 *   - コンソールに警告(ファイルパスと超過 px)
 * を出す。本文の変更(HMR)やフォント読み込みで大きさが変わるので、DOM 変化のたびに測り直す。
 */
export function watchOverflow(deck: RevealApi): () => void {
  const reported = new Map<string, string>()
  // 枠の大きさを CSS に渡す
  const slides = deck.getSlidesElement()!
  slides.style.setProperty('--deck-min-width', `${MIN_WIDTH}px`)
  slides.style.setProperty('--deck-min-height', `${SLIDE_HEIGHT}px`)

  const check = () => {
    for (const slide of deck.getSlides() as HTMLElement[]) {
      const { width, height } = measureAtMinimum(slide)
      const excess = [
        height - SLIDE_HEIGHT > 1 && `縦 ${height - SLIDE_HEIGHT}px`,
        width - MIN_WIDTH > 1 && `横 ${width - MIN_WIDTH}px`,
      ].filter(Boolean)
      const message = excess.length
        ? `最小サイズ ${MIN_WIDTH}×${SLIDE_HEIGHT} を ${excess.join('・')} はみ出し`
        : ''
      slide.classList.toggle('deck-overflow', !!message)
      slide.dataset.deckOverflow = message
      // data-slide-file / data-slide-line は原稿でのスライドの開始位置(vite/remark-beamer が付ける。\input で取り込んだものはそのファイル)
      const path = `${slide.dataset.slideFile ?? 'slides.mdx'}:${slide.dataset.slideLine ?? '?'}`
      if (message && reported.get(path) !== message) console.warn(`[deck] ${path} が${message}ています`)
      if (message) reported.set(path, message)
      else reported.delete(path)
    }
  }

  let timer = 0
  const schedule = () => {
    clearTimeout(timer)
    timer = window.setTimeout(check, 150)
  }
  const observer = new MutationObserver(schedule)
  // 属性の変化(reveal の present/past 切替や、ここで付ける class・style)には反応しない
  observer.observe(slides, { childList: true, subtree: true, characterData: true })
  document.fonts.ready.then(schedule)
  schedule()

  return () => {
    clearTimeout(timer)
    observer.disconnect()
  }
}

/** スライドを最小の幅で組んだときの中身の縦横(はみ出しを含む) */
function measureAtMinimum(slide: HTMLElement): { width: number; height: number } {
  const prev = slide.style.width
  slide.style.width = `${MIN_WIDTH}px`
  const size = { width: slide.scrollWidth, height: slide.scrollHeight }
  slide.style.width = prev
  return size
}
