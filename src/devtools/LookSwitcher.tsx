import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LOOK_EVENT } from '../deck/mode'
import './LookSwitcher.css'

/**
 * 開発時だけの「見た目」の切り替え。画面の左下のバッジを押すとパネルが開き、src/theme/presets/themes/ のテーマ
 * (1 ファイル = 1 テーマ)をその場で付け替えて試せる(<html data-preset> の中のテーマだけを替え、用途のプリセット math・manual
 * などは残す)。モードの切り替え(開発サーバーの /<デッキ>/<モード>/)と組み合わせて見比べられる。
 * 選んだテーマはそのタブの中でデッキごとに覚え(sessionStorage)、デッキの設定と違うときは style.css に書く 1 行を出す。
 * 決めるのは今までどおりデッキの style.css(ここで選んだものはビルドには入らない)。main.tsx が開発時だけ読み込む。
 */

/** テーマのファイル(reveal-common.css は reveal のテーマ同士で共有する規則で、テーマではない) */
const THEME_FILES = import.meta.glob('../theme/presets/themes/*.css')
const THEMES = Object.keys(THEME_FILES)
  .map((path) => path.match(/([^/]+)\.css$/)![1])
  .filter((name) => name !== 'reveal-common')
  .sort()

/** パネルの並び: 土台、reveal のテーマ、ほかのライブラリのテーマ */
const GROUPS: { label: string; themes: string[] }[] = [
  { label: '土台', themes: [''] },
  { label: 'reveal', themes: THEMES.filter((t) => t.startsWith('reveal-')) },
  { label: 'ほかのライブラリ', themes: THEMES.filter((t) => !t.startsWith('reveal-')) },
]
const displayName = (theme: string) => (theme === '' ? 'Beamer 風' : theme.replace(/^reveal-/, ''))

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

/** 色見本に使うトークン(地・文字・アクセント) */
const SWATCH_TOKENS = ['--color-canvas', '--color-ink', '--color-brand'] as const
type Swatch = Record<(typeof SWATCH_TOKENS)[number], string>

/**
 * 土台(テーマを当てないとき)のトークンの値。<html> には今のテーマが当たっているので、要素からは読めない。
 * 読み込んだ CSS の :root の規則(プリセットの範囲 [data-preset…] でないもの)を順に読み、後のものを優先する(デッキの style.css の上書きも入る)
 */
function baseSwatch(): Swatch {
  const values: Partial<Swatch> = {}
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        if (!rule.selectorText.includes(':root') || rule.selectorText.includes('data-preset')) continue
        for (const name of SWATCH_TOKENS) {
          const v = rule.style.getPropertyValue(name).trim()
          if (v) values[name] = v
        }
      } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules)
    } catch {
      // 読めない CSS(別のオリジン)は飛ばす
    }
  }
  return { '--color-canvas': '#fff', '--color-ink': '#333', '--color-brand': '#4360f4', ...values }
}

/**
 * テーマの色見本。土台の値を持たせた要素の中に、そのテーマのプリセットを当てた要素を置いて読む
 * (テーマが決めていないトークンは土台の値になる)
 */
function themeSwatches(base: Swatch): Record<string, Swatch> {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  for (const name of SWATCH_TOKENS) host.style.setProperty(name, base[name])
  document.body.append(host)
  const result: Record<string, Swatch> = { '': base }
  for (const theme of THEMES) {
    const probe = document.createElement('div')
    probe.dataset.preset = theme
    host.append(probe)
    const style = getComputedStyle(probe)
    result[theme] = Object.fromEntries(SWATCH_TOKENS.map((name) => [name, style.getPropertyValue(name).trim()])) as Swatch
  }
  host.remove()
  return result
}

/** 色見本: テーマの地の円に、文字の色とアクセントの色の点 */
function SwatchDot({ swatch }: { swatch: Swatch | undefined }) {
  if (!swatch) return <span className="deck-look-swatch" />
  return (
    <span className="deck-look-swatch" style={{ background: swatch['--color-canvas'] }}>
      <span style={{ background: swatch['--color-ink'] }} />
      <span style={{ background: swatch['--color-brand'] }} />
    </span>
  )
}

function PaletteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.2a2 2 0 0 0-1.4 3.4A1.5 1.5 0 0 1 12 22Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}

function LookSwitcher({ deckPreset }: { deckPreset: string }) {
  const deckTheme = themeOf(deckPreset)
  const [theme, setTheme] = useState(saved() ?? deckTheme)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // 色見本はパネルを開いたときに測る(テーマの CSS はそれまでに読み込み済み)
  const swatches = useMemo(() => (open ? themeSwatches(baseSwatch()) : {}), [open])
  const line = `--deck-preset: ${withTheme(deckPreset, theme) || '(なし)'};`

  const choose = (next: string) => {
    setTheme(next)
    setCopied(false)
    save(next === deckTheme ? null : next)
    apply(withTheme(deckPreset, next))
  }

  // 外を押すか Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // パネルを閉じる Esc はデッキに渡さない(reveal・Swiper は Esc で一覧を開く)。捕捉の段階で止める
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    // パネルの中のキー操作(矢印・Space など)と押した操作は、デッキに渡さない(押しても次のスライドへ進まない)
    <div className="deck-look" ref={root} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {open && (
        <div className="deck-look-panel" role="dialog" aria-label="見た目のテーマ">
          <div className="deck-look-list">
            {GROUPS.map((group) => (
              <div key={group.label} className="deck-look-group">
                <div className="deck-look-group-label">{group.label}</div>
                {group.themes.map((name) => (
                  <button key={name || 'base'} className="deck-look-item" aria-pressed={name === theme} onClick={() => choose(name)}>
                    <SwatchDot swatch={swatches[name]} />
                    <span className="deck-look-name">{displayName(name)}</span>
                    {name === deckTheme && <span className="deck-look-tag">デッキ</span>}
                    {name === theme && (
                      <svg className="deck-look-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {theme !== deckTheme && (
            <div className="deck-look-footer">
              <code>{line}</code>
              <div className="deck-look-actions">
                <button onClick={() => void navigator.clipboard?.writeText(line).then(() => setCopied(true))}>{copied ? 'コピーしました' : 'コピー'}</button>
                <button onClick={() => choose(deckTheme)}>デッキの設定に戻す</button>
              </div>
            </div>
          )}
        </div>
      )}
      <button className="deck-look-badge" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="見た目のテーマ(開発時だけ)">
        <PaletteIcon />
        <span>{displayName(theme)}</span>
        {theme !== deckTheme && <span className="deck-look-dot" title="デッキの設定と違う" />}
      </button>
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
