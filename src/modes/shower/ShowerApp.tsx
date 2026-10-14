import { useEffect, type CSSProperties, type ReactNode } from 'react'
// パッケージの入口(lib/index.js)は document.currentScript を読んで自動で始めるので、まとめて読み込むと壊れる。本体を直に読む
import Shower from '@shower/core/lib/shower.js'
import type { DeckSource } from '../../App'
import { announcePresent } from '../../components/figure/motion'
import { mdxComponents } from '../../deck/mdx-components'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { Overlay, applyStep, currentStep, markerSteps } from '../marker-steps'
import './shower.css'

/** スライド 1 枚 = Shower の .slide(Shower は書いてある DOM をそのまま使い、動かさない) */
function Slide({ h: _h, v: _v, children, ...rest }: { h?: number | string; v?: number | string; children?: ReactNode }) {
  return (
    <section className="slide" {...rest}>
      {children}
    </section>
  )
}

/** 縦の続きの束。Shower のスライドは一列なので、包まずに並べる */
function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/** 段の印は Shower の .next(文書順に 1 つずつ、今の印に active、過ぎた印に visited が付く) */
const showerComponents = { ...mdxComponents, Slide, Stack, Overlay, OverlaySteps: markerSteps('next') }

/** React の StrictMode は効果を 2 回走らせるので、Shower は 1 度だけ始める */
let shower: Shower | null = null

/**
 * Shower モード: 一覧(全スライドを並べる)と全画面(1 枚ずつ)を行き来する(@shower/core)。
 * 一覧でスライドを押すか Enter で全画面に、Esc で一覧に戻る。全画面は URL に ?full が付く。
 * Shower の容器は body(キー操作を body で受けるため)。段階表示は段の印(.next)で進める。
 * 見た目のテーマ(Shower の ribbon など)は使わず、一覧と全画面の配置だけを shower.css で決める。
 */
export default function ShowerApp({ Slides }: DeckSource) {
  useEffect(() => {
    if (shower) return
    // 全画面の倍率: 最小サイズのスライドがウィンドウに収まる最大
    const resize = () =>
      document.body.style.setProperty('--shower-scale', String(Math.min(innerWidth / MIN_WIDTH, innerHeight / SLIDE_HEIGHT)))
    resize()
    addEventListener('resize', resize)

    document.body.classList.add('shower')
    // Shower の作りのまま: 始めるときに URL を見て、?full が無ければ一覧、あれば全画面(modules/location.js)
    shower = new Shower()
    const s = shower
    // 全画面では今のスライドを今の段に、一覧ではどのスライドも最後の段の状態にする
    const sync = () => {
      for (const slide of s.slides) applyStep(slide.element, s.isFullMode ? currentStep(slide.element, '.active, .visited') : Infinity)
      if (s.activeSlide) announcePresent(s.activeSlide.element)
    }
    // Shower の段の処理(modules/next.js)が印の class を付け終えてから測る
    for (const name of ['start', 'slidechange', 'modechange', 'next', 'prev']) s.addEventListener(name, () => requestAnimationFrame(sync))
    s.start()
    document.documentElement.dataset.deckReady = ''
  }, [])

  return (
    <div
      className="deck shower-slides"
      style={{ '--shower-slide-width': `${MIN_WIDTH}px`, '--shower-slide-height': `${SLIDE_HEIGHT}px` } as CSSProperties}
    >
      <Slides components={showerComponents} />
    </div>
  )
}
