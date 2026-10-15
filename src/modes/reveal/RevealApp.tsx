import { useRef } from 'react'
import { Deck, useReveal } from '@revealjs/react'
import RevealNotes from 'reveal.js/plugin/notes'
import { announcePresent, markReady, registerGoTo } from '../../deck/mode'
import type { DeckSource } from '../../deck/source'
import { revealComponents, revealTransition } from './components'
import Menu from './Menu'
import { isHandout, isPrint, useSlideSize } from './slide-size'
import './reveal.css'

type RevealApi = NonNullable<ReturnType<typeof useReveal>>


// 開発時(HMR)にスライド位置を保持する。本番では常に1枚目から始める。
// 開発サーバーは全デッキを /<名前>/ で配信するので、デッキごとに分けて持つ
const SLIDE_KEY = `deck-slide-index:${location.pathname}`

/**
 * reveal モード(既定のモード)。スライド機構 (ナビ・番号・hash・PDF出力) は reveal.js が担当し、
 * スライドの中身はデッキの decks/<名前>/deck.mdx(--- / -- で区切った原稿。<Slide> / <Stack> への変換は
 * vite/remark-beamer が行い、その実体は modes/reveal/components.tsx)。まわりとの約束は deck/mode.ts。
 */
export default function RevealApp({ Slides, motion }: DeckSource) {
  const deckRef = useRef<RevealApi | null>(null)
  const { width, height } = useSlideSize()

  return (
    <Deck
      // 本文の範囲(theme/base.css の .deck)
      className="deck"
      config={{
        // 論理サイズはウィンドウの縦横比に合わせる(modes/reveal/slide-size.ts)。余白はスライド内の padding で取る
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
        // 表示(デッキの動きの設定 motion.ts の reveal.view)。scroll はスクロールビュー。PDF 用の表示(?print-pdf)では使わない
        // (reveal は ?print-pdf で印刷用の表示にし、URL の ?view=scroll はこの設定より優先する)
        ...(motion?.reveal?.view === 'scroll' && !isPrint ? { view: 'scroll' as const } : {}),
        // 既定の遷移(デッキの動きの設定 motion.ts。reveal に無いものは使わない。スライドごとの遷移は components.tsx)
        ...(revealTransition(motion?.transition) ? { transition: revealTransition(motion?.transition) } : {}),
        // 番号(節・定理・式・文献)はすべてビルド時に振るので、reveal の既定どおり
        // 近くのスライドだけを描けばよい(viewDistance は既定のまま)
      }}
      plugins={[RevealNotes]}
      onReady={(deck) => {
        deckRef.current = deck
        registerGoTo((slide) => {
          const { h, v } = deck.getIndices(slide)
          deck.slide(h, v)
        })
        announcePresent(deck.getCurrentSlide())
        markReady()
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
        if (isPrint || !import.meta.env.DEV) return
        const saved = sessionStorage.getItem(SLIDE_KEY)
        if (saved) {
          const [h, v] = saved.split(',').map(Number)
          deck.slide(h, v || 0)
        }
      }}
      onSlideChange={() => {
        if (deckRef.current) announcePresent(deckRef.current.getCurrentSlide())
        if (import.meta.env.DEV && deckRef.current) {
          const { h, v } = deckRef.current.getIndices()
          sessionStorage.setItem(SLIDE_KEY, `${h},${v ?? 0}`)
        }
      }}
    >
      <Slides components={revealComponents} />
      <Menu />
    </Deck>
  )
}
