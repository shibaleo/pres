import React from 'react'
import { createRoot } from 'react-dom/client'
import App, { type DeckSource } from './App'

// reveal.js core + theme, all bundled locally (no CDN).
// theme/index.css は最後に読み込む(reveal white テーマを上書きするため)。
import 'reveal.js/reveal.css'
import 'reveal.js/theme/white.css'
import './theme/index.css'

/**
 * デッキを起動する。ページの入口(vite.config.ts の /@deck/<名前>)が、このモジュールの後にデッキの style.css と
 * 原稿を読み込んでから呼ぶ(土台の見た目 → デッキの見た目の特化 の順に CSS が入る)。
 * 返す関数は、新しい原稿で描き直す(開発時の HMR。同じ App を描き直すので、表示中のスライドの位置は保たれる)。
 */
export function startDeck(deck: DeckSource): (next: DeckSource) => void {
  // デッキ全体にかけるプリセット(デッキの style.css の --deck-preset。空白区切りで複数可)を
  // <html data-preset> に移す。プリセットは [data-preset~="名前"] の範囲にかかる(theme/presets/)
  const preset = getComputedStyle(document.documentElement).getPropertyValue('--deck-preset').trim()
  if (preset) document.documentElement.dataset.preset = preset

  const root = createRoot(document.getElementById('root')!)
  const render = (d: DeckSource) =>
    root.render(
      <React.StrictMode>
        <App {...d} />
      </React.StrictMode>,
    )
  render(deck)
  return render
}
