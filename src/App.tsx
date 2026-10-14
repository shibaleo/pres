import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Deck, useReveal } from '@revealjs/react'
import RevealNotes from 'reveal.js/plugin/notes'
import Menu from './components/Menu'
import { mdxComponents } from './deck/mdx-components'
import { watchOverflow, type Overflow } from './deck/overflow'
import DevDiagnostics from './deck/DevDiagnostics'
import { isHandout, isPrint, useSlideSize } from './deck/slide-size'

type RevealApi = NonNullable<ReturnType<typeof useReveal>>

/** 原稿(decks/<名前>/deck.mdx)のコンパイル結果 */
export type DeckSource = {
  Slides: ComponentType<Record<string, unknown>>
  /** 原稿の警告(参照先の無い \ref・未登録の文献など)。vite/remark-beamer が export する */
  warnings: { file?: string; line?: number; message: string }[]
}

// 開発時(HMR)にスライド位置を保持する。本番では常に1枚目から始める。
// 開発サーバーは全デッキを /<名前>/ で配信するので、デッキごとに分けて持つ
const SLIDE_KEY = `deck-slide-index:${location.pathname}`

/**
 * デッキ本体。スライド機構 (ナビ・番号・hash・PDF出力) は reveal.js が担当し、
 * スライドの中身はデッキの decks/<名前>/deck.mdx(--- / -- で区切った原稿。<Slide> / <Stack> への変換は
 * vite/remark-beamer が行う)。
 */
export default function App({ Slides, warnings }: DeckSource) {
  const deckRef = useRef<RevealApi | null>(null)
  const stopOverflow = useRef<(() => void) | null>(null)
  // はみ出したスライドの一覧(開発時の画面右上に出す)
  const [overflows, setOverflows] = useState<Overflow[]>([])
  const { width, height } = useSlideSize()
  useEffect(() => () => stopOverflow.current?.(), [])

  return (
    <Deck
      // 本文の範囲(theme/base.css の .deck)
      className="deck"
      config={{
        // 論理サイズはウィンドウの縦横比に合わせる(deck/slide-size.ts)。余白はスライド内の padding で取る
        width,
        height,
        margin: 0,
        center: false,
        slideNumber: 'c/t',
        hash: true,
        // PDF では 1 枚のスライドを 1 ページに収める(画面と同じく、収まらない部分は切れる。
        // 開発中ははみ出しとして警告される)。紙の枚数とページ番号の全体が一致する
        pdfMaxPagesPerSlide: 1,
        // 段階表示はステップごとに 1 ページ(Beamer の既定と同じ)。配布用(?print-pdf&handout)では最後の状態の 1 ページだけ
        pdfSeparateFragments: !isHandout,
        // 縦スライド(原稿の --)の進め方。'linear' にすると ←→ だけで縦も含めて順に進む
        // (見た目の切り替わり方は変わらない)。'grid' は縦の位置を保って列を移る
        navigationMode: 'default',
        // 番号(節・定理・式・文献)はすべてビルド時に振るので、reveal の既定どおり
        // 近くのスライドだけを描けばよい(viewDistance は既定のまま)
      }}
      plugins={[RevealNotes]}
      onReady={(deck) => {
        deckRef.current = deck
        if (isPrint) {
          // 印刷用の表示では、reveal はページ番号を通し番号だけで書く。画面と同じ「i/全体」に書き直す。
          // i と全体は PDF のページで数える(段階表示のあるスライドはステップごとに 1 ページ、
          // 1 ページに収まらないスライドは続きのページができる。続きのページには reveal が番号を付けない)
          const numberPages = () => {
            const pages = document.querySelectorAll('.pdf-page')
            pages.forEach((page, i) => {
              const n = page.querySelector('.slide-number-pdf')
              if (n) n.textContent = `${i + 1}/${pages.length}`
            })
          }
          deck.on('pdf-ready', numberPages)
          numberPages()
        }
        // 印刷用の表示(?print-pdf)はページの大きさが最小サイズと違うので、はみ出しの検査などはしない
        if (isPrint) return
        // はみ出しの検査は開発時と、ビルドしたデッキを ?check-overflow で開いたとき(e2e/overflow.spec.ts)
        if (import.meta.env.DEV || new URLSearchParams(location.search).has('check-overflow')) stopOverflow.current = watchOverflow(deck, setOverflows)
        if (!import.meta.env.DEV) return
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
      <Slides components={mdxComponents} />
      <Menu />
      {import.meta.env.DEV && <DevDiagnostics warnings={warnings} overflows={overflows} onJump={(h, v) => deckRef.current?.slide(h, v)} />}
    </Deck>
  )
}
