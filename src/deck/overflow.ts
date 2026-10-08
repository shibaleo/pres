import type { useReveal } from '@revealjs/react'

// reveal.js 5 は型定義を同梱しないので、@revealjs/react の戻り値型から取る
type RevealApi = NonNullable<ReturnType<typeof useReveal>>

/**
 * 開発時だけ: スライドの高さ(config.height)からはみ出したスライドを検出する。
 * reveal ははみ出し部分を黙って切るので、気づけるように
 *   - スライドに赤い破線枠と「はみ出し」バッジ(theme.css の .deck-overflow)
 *   - コンソールに警告(ファイルパスと超過 px)
 * を出す。本文の変更(HMR)やフォント読み込みで高さが変わるので、DOM 変化のたびに測り直す。
 */
export function watchOverflow(deck: RevealApi): () => void {
  const limit = Number(deck.getConfig().height)
  const reported = new Map<string, number>()

  const check = () => {
    for (const slide of deck.getSlides() as HTMLElement[]) {
      const excess = slide.scrollHeight - limit
      const over = excess > 1
      slide.classList.toggle('deck-overflow', over)
      const path = slide.dataset.slidePath ?? '(unknown)'
      if (over && reported.get(path) !== excess) {
        console.warn(`[deck] ${path} がスライドの高さを ${excess}px はみ出しています`)
      }
      if (over) reported.set(path, excess)
      else reported.delete(path)
    }
  }

  let timer = 0
  const schedule = () => {
    clearTimeout(timer)
    timer = window.setTimeout(check, 150)
  }
  const observer = new MutationObserver(schedule)
  // class 属性の変化(reveal の present/past 切替や自分の deck-overflow)には反応しない
  observer.observe(deck.getSlidesElement()!, { childList: true, subtree: true, characterData: true })
  document.fonts.ready.then(schedule)
  schedule()

  return () => {
    clearTimeout(timer)
    observer.disconnect()
  }
}
