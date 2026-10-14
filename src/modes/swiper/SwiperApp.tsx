import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import Swiper from 'swiper'
import { A11y, EffectCards, EffectCoverflow, EffectCreative, EffectCube, EffectFade, EffectFlip } from 'swiper/modules'
import type { SwiperOptions } from 'swiper/types'
import 'swiper/css'
import 'swiper/css/effect-cards'
import 'swiper/css/effect-coverflow'
import 'swiper/css/effect-creative'
import 'swiper/css/effect-cube'
import 'swiper/css/effect-fade'
import 'swiper/css/effect-flip'
import type { DeckSource } from '../../App'
import { announcePresent } from '../../components/figure/motion'
import { mdxComponents } from '../../deck/mdx-components'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { Overlay, applyStep } from '../marker-steps'
import './swiper.css'

/** スライド 1 枚 = Swiper の .swiper-slide(Swiper は、ループを使わなければスライドの DOM を動かさない) */
function Slide({ h: _h, v: _v, children, ...rest }: { h?: number | string; v?: number | string; children?: ReactNode }) {
  return (
    <section className="swiper-slide slide" {...rest}>
      {children}
    </section>
  )
}

/** 縦の続きの束。Swiper のスライドは一列なので、包まずに並べる */
function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/** スライドの段の数。Swiper には段階表示が無いので、段はこのモードが持つ(下の stepsOf で読む) */
function OverlaySteps({ max }: { max: number | string }) {
  return <span className="overlay-step" data-steps={max} />
}

const swiperComponents = { ...mdxComponents, Slide, Stack, Overlay, OverlaySteps }

const stepsOf = (slide: Element) => Number(slide.querySelector<HTMLElement>('[data-steps]')?.dataset.steps ?? 1)

/**
 * 切り替えの演出(Swiper の effect)。URL の &effect=<名前> で選ぶ(既定は slide。選び方は仮)。
 * 影(slideShadows など)は硬い見た目の方針に合わないので、どの演出でも切る
 */
const EFFECTS: Record<string, SwiperOptions> = {
  slide: {},
  fade: { effect: 'fade', fadeEffect: { crossFade: true } },
  cube: { effect: 'cube', cubeEffect: { shadow: false, slideShadows: false } },
  coverflow: { effect: 'coverflow', coverflowEffect: { slideShadows: false } },
  flip: { effect: 'flip', flipEffect: { slideShadows: false } },
  cards: { effect: 'cards', cardsEffect: { slideShadows: false } },
  creative: {
    effect: 'creative',
    creativeEffect: {
      prev: { translate: ['-120%', 0, -500], rotate: [0, 0, -15] },
      next: { translate: ['120%', 0, -500], rotate: [0, 0, 15] },
    },
  },
}

/**
 * Swiper モード: カルーセルの部品(swiper)でスライドを送る。切り替えの演出を選べる(EFFECTS)。
 * Swiper には段階表示もプレゼン向けのキー操作も無いので、どちらもこのモードが持つ:
 * キー(→ ↓ Space PageDown で次、← ↑ PageUp で前、Home / End)は、段が残っていれば段を進め、無ければスライドを移る。
 * 前のスライドへ戻ると最後の段、先へ進むと 1 段目から(reveal・Beamer と同じ)。スワイプ・ドラッグはスライドを移る。
 */
export default function SwiperApp({ Slides }: DeckSource) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = container.current!
    // 全体の倍率: 最小サイズのスライドがウィンドウに収まる最大(Swiper は倍率をかける前の大きさで組む)
    const resize = () => el.style.setProperty('--swiper-scale', String(Math.min(innerWidth / MIN_WIDTH, innerHeight / SLIDE_HEIGHT)))
    resize()
    addEventListener('resize', resize)

    const effect = new URLSearchParams(location.search).get('effect') ?? 'slide'
    if (!(effect in EFFECTS)) console.warn(`[deck] 演出「${effect}」はありません(${Object.keys(EFFECTS).join('・')})`)
    const step = new Map<number, number>()
    const swiper = new Swiper(el, {
      modules: [A11y, EffectCards, EffectCoverflow, EffectCreative, EffectCube, EffectFade, EffectFlip],
      ...(EFFECTS[effect] ?? {}),
      speed: 600,
      // 図(ドラッグできる点・スライダー・ボタン)の上ではスワイプにしない
      noSwipingSelector: '.figure, input, button, a',
    })
    const slides = () => swiper.slides as HTMLElement[]
    const show = (i: number, k: number) => {
      step.set(i, k)
      applyStep(slides()[i], k)
    }
    // どのスライドも 1 段目から
    slides().forEach((_, i) => show(i, 1))
    let previous = swiper.activeIndex
    swiper.on('slideChange', () => {
      const i = swiper.activeIndex
      const slide = slides()[i]
      show(i, i < previous ? stepsOf(slide) : 1)
      previous = i
      announcePresent(slide)
    })
    announcePresent(slides()[swiper.activeIndex])

    const next = () => {
      const i = swiper.activeIndex
      const k = step.get(i) ?? 1
      if (k < stepsOf(slides()[i])) show(i, k + 1)
      else swiper.slideNext()
    }
    const prev = () => {
      const i = swiper.activeIndex
      const k = step.get(i) ?? 1
      if (k > 1) show(i, k - 1)
      else swiper.slidePrev()
    }
    const onKey = (e: KeyboardEvent) => {
      // 図の中の操作(矢印キーで点を動かすなど)や、修飾キー付きはスライドの操作にしない
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as Element).closest('input, textarea, [contenteditable], .figure')) return
      const action: Record<string, () => void> = {
        ArrowRight: next,
        ArrowDown: next,
        PageDown: next,
        ' ': e.shiftKey ? prev : next,
        ArrowLeft: prev,
        ArrowUp: prev,
        PageUp: prev,
        Home: () => swiper.slideTo(0),
        End: () => swiper.slideTo(slides().length - 1),
      }
      const run = action[e.key]
      if (!run) return
      e.preventDefault()
      run()
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.dataset.deckReady = ''
    return () => {
      document.removeEventListener('keydown', onKey)
      removeEventListener('resize', resize)
      swiper.destroy(true, false)
    }
  }, [])

  return (
    <div
      ref={container}
      className="swiper deck"
      style={{ '--swiper-slide-width': `${MIN_WIDTH}px`, '--swiper-slide-height': `${SLIDE_HEIGHT}px` } as CSSProperties}
    >
      <div className="swiper-wrapper">
        <Slides components={swiperComponents} />
      </div>
    </div>
  )
}
