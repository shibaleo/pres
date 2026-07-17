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
 *  - FontAwesome 非依存(アイコンは inline SVG) → CDN ゼロ/オフライン維持。
 */
export default function Menu() {
  const deck = useReveal()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<string[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!deck) return
    const build = () => {
      const slides = deck.getSlides() as HTMLElement[]
      setItems(
        slides.map((s) => s.querySelector('h1,h2,h3,h4')?.textContent?.trim() || '(無題)'),
      )
      setCurrent(deck.getIndices().h)
    }
    const onChange = () => setCurrent(deck.getIndices().h)
    build()
    deck.on('slidechanged', onChange)
    deck.on('ready', build)
    return () => {
      deck.off('slidechanged', onChange)
      deck.off('ready', build)
    }
  }, [deck])

  const go = (i: number) => {
    deck?.slide(i)
    setOpen(false)
  }

  return createPortal(
    <div className="deck-menu">
      <button
        aria-label="メニュー"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed',
          left: 14,
          bottom: 12,
          zIndex: 50,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#4360f4',
          padding: 4,
        }}
      >
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
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.25)' }}
          />
          <nav
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              width: 300,
              zIndex: 45,
              background: '#fff',
              boxShadow: '2px 0 14px rgba(0,0,0,0.25)',
              overflowY: 'auto',
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                fontWeight: 'bold',
                color: '#fff',
                background: '#4360f4',
              }}
            >
              スライド一覧
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((t, i) => (
                <li key={i}>
                  <button
                    onClick={() => go(i)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid #eee',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: 14,
                      background: i === current ? '#eef1ff' : 'transparent',
                      color: i === current ? '#4360f4' : '#333',
                      fontWeight: i === current ? 'bold' : 'normal',
                    }}
                  >
                    {i + 1}. {t}
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
