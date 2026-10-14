import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Deck, DeckContext, Notes, Slide as SpectacleSlide, SlideContext, useSteps } from 'spectacle'
import type { DeckSource } from '../../deck/source'
import { documentComponents } from '../../components'
import { announcePresent, deckSlides, markReady, registerGoTo } from '../../deck/mode'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { FlatStack, isShown, overlayClass, slideAttributes, stepsOf, type OverlayProps, type SlideProps } from '../structure'
import './spectacle.css'

/**
 * スライドの今の段(Beamer の番号。1 枚目が 1)。Spectacle は段をスライドの中の部品に配る(SlideContext)ので、
 * 段の印は要らず、Overlay はこの値を読むだけで表示を決める
 */
const StepContext = createContext(1)

/** スライド 1 枚 = Spectacle の Slide。中身は本文の範囲(.deck)と 1 枚(.slide)で包む */
function Slide(props: SlideProps) {
  const steps = stepsOf(props)
  const body = (step: number, placeholder?: ReactNode) => (
    <Body step={step} attributes={slideAttributes(props)} placeholder={placeholder}>
      {props.children}
    </Body>
  )
  // padding は Spectacle のテーマの間隔の段階の番号として読まれるので、値で渡す
  return (
    <SpectacleSlide padding="0px" backgroundColor="var(--color-canvas)">
      {steps >= 2 ? <SteppedBody steps={steps} body={body} /> : body(1)}
    </SpectacleSlide>
  )
}

/**
 * 段のあるスライド。段の数 - 1 個の段を Spectacle に登録する(useSteps)。useSteps が返す step は
 * -1(まだ)〜 段の数 - 2 なので、Beamer の段 = step + 2。一覧などで段が決まらないとき(activationThresholds が null)は最後の段
 */
function SteppedBody({ steps, body }: { steps: number; body: (step: number, placeholder?: ReactNode) => ReactNode }) {
  const { activationThresholds } = useContext(SlideContext)
  const { step, placeholder } = useSteps(steps - 1)
  return <>{body(activationThresholds === null ? steps : step + 2, placeholder)}</>
}

function Body({ step, attributes, placeholder, children }: { step: number; attributes: object; placeholder?: ReactNode; children?: ReactNode }) {
  const { isSlideActive } = useContext(SlideContext)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (isSlideActive && ref.current) announcePresent(ref.current)
  }, [isSlideActive])
  return (
    <div className="deck spectacle-body">
      <section ref={ref} className="slide" {...attributes}>
        <StepContext.Provider value={step}>{children}</StepContext.Provider>
      </section>
      {placeholder}
    </div>
  )
}

/** Overlay: 今の段(StepContext)で表示を決める */
function Overlay({ from, to, as: Tag = 'div', only = false, children }: OverlayProps) {
  const k = useContext(StepContext)
  return <Tag className={overlayClass(isShown(k, from, to), only)}>{children}</Tag>
}

/** スピーカーノートは Spectacle の Notes(発表者ビュー ?presenterMode=true に出る) */
function SpectacleNotes({ children }: { children?: ReactNode }) {
  return <Notes>{children}</Notes>
}

/** 縦の続きの束は包まない(Spectacle のスライドは一列) */
const spectacleComponents = { ...documentComponents, Notes: SpectacleNotes, Slide, Stack: FlatStack, Overlay }

/** 「このスライドへ移る」を登録する(Spectacle の DeckContext の中で) */
function RegisterGoTo() {
  const { skipTo } = useContext(DeckContext)
  useEffect(() => {
    registerGoTo((slide) => {
      const slideIndex = deckSlides().indexOf(slide)
      if (slideIndex >= 0) skipTo({ slideIndex, stepIndex: 0 })
    })
    markReady()
  }, [skipTo])
  return null
}

/**
 * Spectacle のテーマ: スライドの大きさは最小サイズ(deck/slide-metrics.ts)。色と書体は本文の範囲(.deck)の規則が決める。
 * backdropStyle は Spectacle の既定(ウィンドウいっぱいに固定)を丸ごと置き換えるので、既定の値も書く
 * (無いと外枠が中身の大きさに縮み、拡大と中央寄せが効かない)
 */
const theme = {
  size: { width: MIN_WIDTH, height: SLIDE_HEIGHT },
  backdropStyle: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'var(--color-surface)' },
}

/**
 * Spectacle モード: React の部品でスライドを組むライブラリ(spectacle)。切り替えは横に滑る遷移。
 * Spectacle の機能はそのまま使える: 一覧(?overviewMode=true)、発表者ビュー(?presenterMode=true)、PDF 用の表示(?exportMode=true)。
 * 縦の続き(--)は横一列に並べる。まわりとの約束は deck/mode.ts。
 */
export default function SpectacleApp({ Slides }: DeckSource) {
  return (
    <Deck theme={theme} template={() => null}>
      <Slides components={spectacleComponents} />
      <RegisterGoTo />
    </Deck>
  )
}
