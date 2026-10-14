import React from 'react'
import { createRoot } from 'react-dom/client'
import App, { type DeckSource } from './App'
import ImpressApp from './modes/impress/ImpressApp'

// reveal.js の本体の CSS(スライドの配置と遷移・UI)。本文の見た目は theme/ が持ち、reveal のテーマは使わない
import 'reveal.js/reveal.css'
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

  // モード(スライドを動かすライブラリ)。既定は reveal。?mode=impress で impress.js(試作。選び方は仮)
  const Mode = new URLSearchParams(location.search).get('mode') === 'impress' ? ImpressApp : App
  const root = createRoot(document.getElementById('root')!)
  const render = (d: DeckSource) =>
    root.render(
      <React.StrictMode>
        <Mode {...d} />
      </React.StrictMode>,
    )
  render(deck)
  return render
}
