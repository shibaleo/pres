import { useEffect, useRef } from 'react'
import { Deck, Slide, Stack, useReveal } from '@revealjs/react'
import RevealNotes from 'reveal.js/plugin/notes/notes.esm.js'
import Menu from './components/Menu'
import { slides, groupStacks, type SlideEntry } from './deck/slides'
import { mdxComponents } from './deck/mdx-components'
import { watchOverflow } from './deck/overflow'
import DevDiagnostics from './deck/DevDiagnostics'

type RevealApi = NonNullable<ReturnType<typeof useReveal>>

// 開発時(HMR)にスライド位置を保持する。本番では常に1枚目から始める。
const SLIDE_KEY = 'deck-slide-index'

/** 1 枚のスライド。stack は Slide に渡さない(reveal の属性ではないため) */
function renderSlide({ path, Content, meta }: SlideEntry) {
  const { stack: _stack, ...slideProps } = meta
  return (
    <Slide key={path} data-slide-path={path} {...slideProps}>
      <Content components={mdxComponents} />
    </Slide>
  )
}

/**
 * デッキ本体。スライド機構 (ナビ・番号・hash・PDF出力) は reveal.js が担当し、
 * 各スライドの中身は src/slides/**\/*.mdx (パスの自然順に自動で並ぶ)。
 */
export default function App() {
  const deckRef = useRef<RevealApi | null>(null)
  const stopOverflow = useRef<(() => void) | null>(null)
  useEffect(() => () => stopOverflow.current?.(), [])

  return (
    <Deck
      config={{
        width: 960,
        height: 700,
        margin: 0.04,
        center: false,
        slideNumber: 'c/t',
        hash: true,
        // 見出しの通し番号は CSS カウンタで振る。reveal は既定で前後3枚より遠い
        // スライドを display:none にし、カウンタがそこを数えなくなるので全スライドを残す。
        // (定理・式の番号はビルド時に振るので、この設定には依存しない)
        viewDistance: 1000,
        mobileViewDistance: 1000,
      }}
      plugins={[RevealNotes]}
      onReady={(deck) => {
        deckRef.current = deck
        if (!import.meta.env.DEV) return
        stopOverflow.current = watchOverflow(deck)
        const saved = sessionStorage.getItem(SLIDE_KEY)
        if (saved) {
          const [h, v] = saved.split(',').map(Number)
          deck.slide(h, v || 0)
        }
      }}
      onSlideChange={() => {
        if (import.meta.env.DEV && deckRef.current) {
          const { h, v } = deckRef.current.getIndices()
          sessionStorage.setItem(SLIDE_KEY, `${h},${v ?? 0}`)
        }
      }}
    >
      {groupStacks(slides).map((item) =>
        Array.isArray(item) ? (
          <Stack key={item[0].path}>{item.map(renderSlide)}</Stack>
        ) : (
          renderSlide(item)
        ),
      )}
      <Menu />
      {import.meta.env.DEV && <DevDiagnostics />}
    </Deck>
  )
}
