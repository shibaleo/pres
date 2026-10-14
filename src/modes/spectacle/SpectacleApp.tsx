import { Children, createContext, isValidElement, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Deck, Slide as SpectacleSlide, SlideContext, useSteps } from 'spectacle'
import type { DeckSource } from '../../App'
import { announcePresent } from '../../components/figure/motion'
import { mdxComponents } from '../../deck/mdx-components'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import './spectacle.css'

/**
 * スライドの今の段(Beamer の番号。1 枚目が 1)。Spectacle は段をスライドの中の部品に配る(SlideContext)ので、
 * 段の印は要らず、Overlay はこの値を読むだけで表示を決める
 */
const StepContext = createContext(1)

/** 段の数の印。Spectacle モードでは Slide が段の数として読む(下の stepsOf)だけで、何も描かない */
function OverlaySteps(_: { max: number | string }) {
  return null
}

/** スライドの段の数(変換は段が 2 つ以上あるスライドの末尾に <OverlaySteps max> を置く) */
function stepsOf(children: ReactNode): number {
  let max = 1
  Children.forEach(children, (c) => {
    if (isValidElement<{ max: number | string }>(c) && c.type === OverlaySteps) max = Number(c.props.max)
  })
  return max
}

type SlideProps = { h?: number | string; v?: number | string; children?: ReactNode }

/** スライド 1 枚 = Spectacle の Slide。中身は本文の範囲(.deck)と 1 枚(.slide)で包む */
function Slide({ h: _h, v: _v, children, ...rest }: SlideProps) {
  const steps = stepsOf(children)
  return (
    <SpectacleSlide padding="0px" backgroundColor="var(--color-canvas)">
      {steps >= 2 ? (
        <SteppedBody steps={steps} rest={rest}>
          {children}
        </SteppedBody>
      ) : (
        <Body step={1} rest={rest}>
          {children}
        </Body>
      )}
    </SpectacleSlide>
  )
}

/**
 * 段のあるスライド。段の数 - 1 個の段を Spectacle に登録する(useSteps)。useSteps が返す step は
 * -1(まだ)〜 段の数 - 2 なので、Beamer の段 = step + 2。一覧などで段が決まらないとき(activationThresholds が null)は最後の段
 */
function SteppedBody({ steps, rest, children }: { steps: number; rest: object; children?: ReactNode }) {
  const { activationThresholds } = useContext(SlideContext)
  const { step, placeholder } = useSteps(steps - 1)
  return (
    <Body step={activationThresholds === null ? steps : step + 2} rest={rest} placeholder={placeholder}>
      {children}
    </Body>
  )
}

function Body({ step, rest, placeholder, children }: { step: number; rest: object; placeholder?: ReactNode; children?: ReactNode }) {
  const { isSlideActive } = useContext(SlideContext)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (isSlideActive && ref.current) announcePresent(ref.current)
  }, [isSlideActive])
  return (
    <div className="deck spectacle-body">
      <section ref={ref} className="slide" {...rest}>
        <StepContext.Provider value={step}>{children}</StepContext.Provider>
      </section>
      {placeholder}
    </div>
  )
}

/** 縦の続きの束。Spectacle のスライドは一列なので、包まずに並べる */
function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/** Beamer の overlay(\pause・<2->・\only<2>{…} など)。今の段(StepContext)で表示を決める。見た目は theme/base.css の .overlay */
function Overlay({
  from,
  to,
  as: Tag = 'div',
  only = false,
  children,
}: {
  from: number | string
  to?: number | string
  as?: 'div' | 'span'
  only?: boolean
  children?: ReactNode
}) {
  const k = useContext(StepContext)
  const shown = k >= Number(from) && (to === undefined || k <= Number(to))
  const cls = ['overlay', only && 'only', !shown && 'overlay-hidden'].filter(Boolean).join(' ')
  return <Tag className={cls}>{children}</Tag>
}

/** reveal の Fragment に当たるもの。Spectacle モードではまだ段に数えず、常に表示する */
function Fragment({ children }: { children?: ReactNode }) {
  return <div>{children}</div>
}

const spectacleComponents = { ...mdxComponents, Slide, Stack, Overlay, OverlaySteps, Fragment }

/**
 * Spectacle のテーマ: スライドの大きさは最小サイズ(deck/slide-metrics.ts)。色と書体は本文の範囲(.deck)の規則が決める。
 * backdropStyle は Spectacle の既定(ウィンドウいっぱいに固定)を丸ごと置き換えるので、既定の値も書く
 * (無いと外枠が中身の大きさに縮み、拡大と中央寄せが効かない)。padding(Slide)はテーマの間隔の段階の番号として読まれるので、値で渡す
 */
const theme = {
  size: { width: MIN_WIDTH, height: SLIDE_HEIGHT },
  backdropStyle: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'var(--color-surface)' },
}

/**
 * Spectacle モード: React の部品でスライドを組むライブラリ(spectacle)。切り替えは横に滑る遷移。
 * Spectacle の機能はそのまま使える: 一覧(?overviewMode=true)、発表者ビュー(?presenterMode=true)、PDF 用の表示(?exportMode=true)。
 * 縦の続き(--)は横一列に並べる。
 */
export default function SpectacleApp({ Slides }: DeckSource) {
  useEffect(() => {
    document.documentElement.dataset.deckReady = ''
  }, [])
  return (
    <Deck theme={theme} template={() => null}>
      <Slides components={spectacleComponents} />
    </Deck>
  )
}
