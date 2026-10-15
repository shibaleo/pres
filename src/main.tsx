// CSS の順: ライブラリの本体の CSS(reveal.js/reveal.css。そのモードのときだけ、入口が先に読む)→ 土台の見た目(theme/)
// → モードの見た目(modes/<名前>/ の CSS。モードのモジュールが読む)→ デッキの見た目(デッキの style.css。ページの入口が読む)。
// 後のものが前のものを上書きする(reveal のテーマは使わない)
import './theme/index.css'
import React, { type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { watchInternalLinks } from './deck/links'
import { setMinSizeVariables } from './deck/mode'
import type { DeckSource } from './deck/source'
import DevDiagnostics from './devtools/DevDiagnostics'

/**
 * デッキを起動する。ページの入口(vite.config.ts の /@deck/<名前>)が、このモジュールの後にモード・デッキの style.css・
 * 原稿を読み込んでから呼ぶ(土台の見た目 → モードの見た目 → デッキの見た目の特化 の順に CSS が入る)。
 * Mode はスライドを動かすライブラリの作り(src/modes/。docs/motion.md)。入口が、デッキの動きの設定(motion.ts の mode)の
 * モードだけを読み込んで渡す(ビルドにはそのモードだけが入る)。
 * 返す関数は、新しい原稿で描き直す(開発時の HMR。同じ App を描き直すので、表示中のスライドの位置は保たれる)。
 */
export function startDeck(deck: DeckSource, Mode: ComponentType<DeckSource>): (next: DeckSource) => void {
  // デッキ全体にかけるプリセット(デッキの style.css の --deck-preset。空白区切りで複数可)を
  // <html data-preset> に移す。プリセットは [data-preset~="名前"] の範囲にかかる(theme/presets/)
  const preset = getComputedStyle(document.documentElement).getPropertyValue('--deck-preset').trim()
  if (preset) document.documentElement.dataset.preset = preset
  // 開発時だけ、見た目のテーマをその場で替えて試す切り替え(devtools/LookSwitcher.tsx。ビルドには入らない)
  if (import.meta.env.DEV) void import('./devtools/LookSwitcher').then((m) => m.mountLookSwitcher(preset))

  setMinSizeVariables()
  // 段の現れ方(motion.ts の step)。reveal 以外のモードは theme/base.css の .overlay の規則がこれを見る(reveal は Overlay.tsx)
  document.documentElement.dataset.stepEffect = deck.motion?.step ?? 'fade'
  // 文書の中のリンク(#名前。\ref・[文字](#名前))でそのスライドへ移る(どのモードでも同じ)
  watchInternalLinks()
  // はみ出しの検査は開発時と、ビルドしたデッキを ?check-overflow で開いたとき(e2e/overflow.spec.ts)。
  // 印刷用の表示(reveal の ?print-pdf)はページの大きさが最小サイズと違うので検査しない
  const params = new URLSearchParams(location.search)
  const check = (import.meta.env.DEV || params.has('check-overflow')) && !params.has('print-pdf')
  const root = createRoot(document.getElementById('root')!)
  const render = (d: DeckSource) =>
    root.render(
      <React.StrictMode>
        <Mode {...d} />
        <DevDiagnostics warnings={d.warnings} check={check} />
      </React.StrictMode>,
    )
  render(deck)
  return render
}
