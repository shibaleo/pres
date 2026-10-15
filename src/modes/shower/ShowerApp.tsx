import { useEffect } from 'react'
// パッケージの入口(lib/index.js)は document.currentScript を読んで自動で始めるので、まとめて読み込むと壊れる。本体を直に読む
import Shower from '@shower/core/lib/shower.js'
import type { DeckSource } from '../../deck/source'
import { documentComponents } from '../../components'
import { announcePresent, markReady, registerGoTo } from '../../deck/mode'
import { watchViewSize } from '../../deck/view-size'
import { Overlay, StepMarkers, applyStep, currentStep } from '../marker-steps'
import { PageNumber, watchPageNumbers } from '../page-number'
import { FlatStack, slideAttributes, stepsOf, type SlideProps } from '../structure'
import './shower.css'

/**
 * スライド 1 枚 = Shower の .slide(Shower は書いてある DOM をそのまま使い、動かさない)。
 * 段の印は Shower の .next(文書順に 1 つずつ、今の印に active、過ぎた印に visited が付く)。
 * 遷移(motion.ts でスライドごとに決まったもの)は data-transition に置き、shower.css が全画面で入るときの動きにする
 */
function Slide(props: SlideProps) {
  return (
    <section className="slide" data-transition={props.transition} {...slideAttributes(props)}>
      {props.children}
      <PageNumber />
      <StepMarkers steps={stepsOf(props)} markerClass="next" />
    </section>
  )
}

/** 縦の続きの束は包まない(Shower のスライドは一列) */
const showerComponents = { ...documentComponents, Slide, Stack: FlatStack, Overlay }

/** React の StrictMode は効果を 2 回走らせるので、Shower は 1 度だけ始める */
let shower: Shower | null = null

/**
 * Shower モード: 一覧(全スライドを並べる)と全画面(1 枚ずつ)を行き来する(@shower/core)。
 * Shower の作りのまま一覧で始まり(URL に ?full があれば全画面)、一覧でスライドを押すと全画面に、Esc で一覧に戻る。
 * Shower の容器は body(キー操作を body で受けるため)。段階表示は段の印(.next)で進める。
 * 見た目のテーマ(Shower の ribbon など)は使わず、一覧と全画面の配置だけを shower.css で決める。まわりとの約束は deck/mode.ts。
 * Shower 自体には切り替えの動きが無いので、全画面で入るスライドに CSS のアニメーションを付ける(shower.css。motion.ts の遷移)。
 * 隠れていたスライドが表示になるたびにアニメーションが走るので、動くのは入る方だけ(出る方はすぐ消える)
 */
export default function ShowerApp({ Slides, motion }: DeckSource) {
  useEffect(() => {
    if (shower) return
    watchViewSize()
    watchPageNumbers()
    document.body.classList.add('shower')
    // 既定の遷移(スライドごとの遷移の無いスライド)。無ければ動かさない
    document.body.dataset.deckTransition = motion?.transition ?? 'none'
    shower = new Shower()
    const s = shower
    // 進む向き(前へ戻るときは slide・cube・flip を逆向きに)。Shower はスライドの class を替えたのと同じ流れで slidechange を出すので、
    // ここで付ければアニメーションが始まる前に間に合う
    let previous = -1
    s.addEventListener('slidechange', () => {
      const index = s.slides.findIndex((x) => x === s.activeSlide)
      document.body.dataset.direction = index < previous ? 'backward' : 'forward'
      previous = index
    })
    // 全画面では今のスライドを今の段に、一覧ではどのスライドも最後の段の状態にする
    const sync = () => {
      for (const slide of s.slides) applyStep(slide.element, s.isFullMode ? currentStep(slide.element, '.active, .visited') : Infinity)
      if (s.activeSlide) announcePresent(s.activeSlide.element)
    }
    // Shower の段の処理(modules/next.js)が印の class を付け終えてから測る
    for (const name of ['start', 'slidechange', 'modechange', 'next', 'prev']) s.addEventListener(name, () => requestAnimationFrame(sync))
    s.start()
    registerGoTo((slide) => {
      const i = s.slides.findIndex((x) => x.element === slide)
      if (i >= 0) s.goTo(i)
    })
    markReady()
  }, [])

  return (
    <div className="deck shower-slides">
      <Slides components={showerComponents} />
    </div>
  )
}
