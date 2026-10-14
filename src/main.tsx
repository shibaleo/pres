import React, { lazy, Suspense, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import App, { type DeckSource } from './App'

/**
 * モード(スライドを動かすライブラリ。docs/motion.md)。既定は reveal。ほかは試作で、URL の ?mode=<名前> で選ぶ(選び方は仮)。
 * reveal 以外は選んだときだけ読み込む
 */
const MODES: Record<string, ComponentType<DeckSource>> = {
  reveal: App,
  impress: lazy(() => import('./modes/impress/ImpressApp')),
  shower: lazy(() => import('./modes/shower/ShowerApp')),
  spectacle: lazy(() => import('./modes/spectacle/SpectacleApp')),
  swiper: lazy(() => import('./modes/swiper/SwiperApp')),
}

/**
 * 使うモードの名前。?mode=<名前> で選んだモードは、そのタブの中で覚える(sessionStorage。デッキごと)。
 * ライブラリが URL を書き換えて ?mode を消しても(Shower は ?full#番号 にする)、読み直したときに同じモードで開くため。
 * reveal に戻すには ?mode=reveal
 */
function modeName(): string {
  const key = `deck-mode:${location.pathname}`
  const chosen = new URLSearchParams(location.search).get('mode')
  try {
    if (chosen) sessionStorage.setItem(key, chosen)
    return chosen ?? sessionStorage.getItem(key) ?? 'reveal'
  } catch {
    return chosen ?? 'reveal' // sessionStorage が使えないとき(プライベートモードなど)
  }
}

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

  const name = modeName()
  if (!(name in MODES)) console.warn(`[deck] モード「${name}」はありません(${Object.keys(MODES).join('・')})。reveal で開きます`)
  const Mode = MODES[name] ?? App
  const root = createRoot(document.getElementById('root')!)
  const render = (d: DeckSource) =>
    root.render(
      <React.StrictMode>
        <Suspense>
          <Mode {...d} />
        </Suspense>
      </React.StrictMode>,
    )
  render(deck)
  return render
}
