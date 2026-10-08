import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReveal } from '@revealjs/react'

/**
 * 左下ハンバーガー → 左サイドバー(スライド一覧)。旧 reveal.js-menu の代替。
 *
 * ポイント:
 *  - reveal は .slides に transform をかけるため、position:fixed をそこに置くと崩れる。
 *    → createPortal で document.body に出し、ビューポート基準の固定配置にする。
 *  - 見出しは reveal API(getSlides)から自動取得するのでスライドを増減しても追従。
 *  - 縦スライド(Stack)は (h, v) で移動し、一覧では字下げして表示する。
 *  - FontAwesome 非依存(アイコンは inline SVG) → CDN ゼロ/オフライン維持。
 */
type Item = { h: number; v: number; title: string }

export default function Menu() {
  const deck = useReveal()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [current, setCurrent] = useState('0,0')

  useEffect(() => {
    if (!deck) return
    const key = (i: { h: number; v?: number }) => `${i.h},${i.v ?? 0}`
    const build = () => {
      const slides = deck.getSlides() as HTMLElement[]
      setItems(
        slides.map((s) => {
          const { h, v } = deck.getIndices(s)
          return {
            h,
            v: v ?? 0,
            title: s.querySelector('h1,h2,h3,h4')?.textContent?.trim() || '(無題)',
          }
        }),
      )
      setCurrent(key(deck.getIndices()))
    }
    const onChange = () => setCurrent(key(deck.getIndices()))
    build()
    deck.on('slidechanged', onChange)
    deck.on('ready', build)
    return () => {
      deck.off('slidechanged', onChange)
      deck.off('ready', build)
    }
  }, [deck])

  const go = (it: Item) => {
    deck?.slide(it.h, it.v)
    setOpen(false)
  }

  // 見た目は theme/base.css の .deck-menu-*
  return createPortal(
    <div className="deck-menu">
      <button className="deck-menu-toggle" aria-label="メニュー" onClick={() => setOpen((o) => !o)}>
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="deck-menu-backdrop" onClick={() => setOpen(false)} />
          <nav className="deck-menu-panel">
            <header>スライド一覧</header>
            <ul>
              {items.map((it) => (
                <li key={`${it.h},${it.v}`}>
                  <button
                    className={it.v > 0 ? 'sub' : undefined}
                    aria-current={`${it.h},${it.v}` === current}
                    onClick={() => go(it)}
                  >
                    {it.v > 0 ? `${it.h + 1}.${it.v}` : `${it.h + 1}.`} {it.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>,
    document.body,
  )
}
