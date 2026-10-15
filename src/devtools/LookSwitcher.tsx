import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LOOK_EVENT } from '../deck/mode'
import './LookSwitcher.css'

/**
 * 開発時だけの「見た目」の切り替え。画面の左上の選択欄で、src/theme/presets/themes/ のテーマ(1 ファイル = 1 テーマ)を
 * その場で付け替えて試す(<html data-preset> の中のテーマだけを替え、用途のプリセット math・manual などは残す)。
 * モードの切り替え(開発サーバーの /<デッキ>/<モード>/)と組み合わせて見比べられる。
 * 選んだテーマはそのタブの中でデッキごとに覚え(sessionStorage)、デッキの設定と違うときは style.css に書く 1 行を出す。
 * 決めるのは今までどおりデッキの style.css(ここで選んだものはビルドには入らない)。main.tsx が開発時だけ読み込む。
 */

/** テーマのファイル(reveal-common.css は reveal のテーマ同士で共有する規則で、テーマではない) */
const THEME_FILES = import.meta.glob('../theme/presets/themes/*.css')
const THEMES = Object.keys(THEME_FILES)
  .map((path) => path.match(/([^/]+)\.css$/)![1])
  .filter((name) => name !== 'reveal-common')
  .sort()

/** そのタブで覚える鍵(デッキごと。モードを替えて開き直しても同じテーマのまま) */
const KEY = `deck-look:${location.pathname.split('/')[1] ?? ''}`

const tokensOf = (preset: string) => preset.split(/\s+/).filter(Boolean)
/** デッキのプリセットのうち、テーマ(無ければ '' = 土台の見た目) */
const themeOf = (preset: string) => tokensOf(preset).find((t) => THEMES.includes(t)) ?? ''
/** デッキのプリセットのテーマだけを替える */
const withTheme = (preset: string, theme: string) => [...tokensOf(preset).filter((t) => !THEMES.includes(t)), ...(theme ? [theme] : [])].join(' ')

function saved(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}
function save(theme: string | null) {
  try {
    if (theme === null) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, theme)
  } catch {
    // sessionStorage が使えないとき(プライベートモードなど)は覚えない
  }
}

function apply(preset: string) {
  if (preset) document.documentElement.dataset.preset = preset
  else delete document.documentElement.dataset.preset
  document.dispatchEvent(new CustomEvent(LOOK_EVENT))
}

function LookSwitcher({ deckPreset }: { deckPreset: string }) {
  const deckTheme = themeOf(deckPreset)
  const [theme, setTheme] = useState(saved() ?? deckTheme)
  const choose = (next: string) => {
    setTheme(next)
    save(next === deckTheme ? null : next)
    apply(withTheme(deckPreset, next))
  }
  return (
    <div className="deck-look">
      <label>
        見た目{' '}
        <select value={theme} onChange={(e) => choose(e.target.value)}>
          <option value="">土台(Beamer 風){deckTheme === '' ? ' ← デッキの設定' : ''}</option>
          {THEMES.map((name) => (
            <option key={name} value={name}>
              {name}
              {name === deckTheme ? ' ← デッキの設定' : ''}
            </option>
          ))}
        </select>
      </label>
      {theme !== deckTheme && (
        <code title="デッキの style.css に書く(テーマのファイルの @import も)">--deck-preset: {withTheme(deckPreset, theme) || '(なし)'};</code>
      )}
    </div>
  )
}

/**
 * 切り替えを置く。deckPreset はデッキの style.css の --deck-preset。全テーマの CSS を読み込み(テーマは [data-preset~=…] の
 * 範囲にしかかからないので、読み込んでおくだけでは見た目は変わらない)、覚えていたテーマがあれば付け替える
 */
export async function mountLookSwitcher(deckPreset: string) {
  await Promise.all(Object.values(THEME_FILES).map((load) => load()))
  const remembered = saved()
  if (remembered !== null) apply(withTheme(deckPreset, remembered))
  const host = document.createElement('div')
  document.body.append(host)
  createRoot(host).render(<LookSwitcher deckPreset={deckPreset} />)
}
