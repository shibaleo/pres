import { useEffect, useRef } from 'react'
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
import type { DeckSource } from '../../deck/source'
import { documentComponents } from '../../components'
import { announcePresent, markReady, registerGoTo } from '../../deck/mode'
import { watchViewSize } from '../../deck/view-size'
import { Overlay, applyStep } from '../marker-steps'
import { PageNumber, watchPageNumbers } from '../page-number'
import { MODE_TRANSITIONS, type SwiperEffect } from '../names'
import { FlatStack, slideAttributes, stepsOf, type SlideProps } from '../structure'
import './swiper.css'

/**
 * スライド 1 枚 = Swiper の .swiper-slide(Swiper は、ループを使わなければスライドの DOM を動かさない)。
 * Swiper には段階表示が無いので、段はこのモードが持つ。段の数は data-steps に置いて読む(slideSteps)
 */
function Slide(props: SlideProps) {
  return (
    <section className="swiper-slide slide" data-steps={stepsOf(props)} {...slideAttributes(props)}>
      {props.children}
      <PageNumber />
    </section>
  )
}

/** 縦の続きの束は包まない(Swiper のスライドは一列) */
const swiperComponents = { ...documentComponents, Slide, Stack: FlatStack, Overlay }

const slideSteps = (slide: HTMLElement) => Number(slide.dataset.steps ?? 1)

/**
 * 切り替えの演出(Swiper の effect)。URL の &effect=<名前> で選ぶ(既定は slide。選び方は仮)。
 * 影(slideShadows など)は硬い見た目の方針に合わないので、どの演出でも切る
 */
const EFFECTS: Record<SwiperEffect, SwiperOptions> = {
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
export default function SwiperApp({ Slides, motion }: DeckSource) {
  const container = useRef<HTMLDivElement>(null)
  /** 今のスライドの番目。原稿が変わって(開発時の HMR)作り直したとき、同じ番目から始める */
  const activeIndex = useRef(0)

  // 原稿が変わると React はスライドを描き直すが、Swiper は前のスライドを持っているので、Slides が変わるたびに作り直す
  useEffect(() => {
    const el = container.current!
    // 容器の大きさと倍率: 窓と同じ縦横比の大きさを、窓に合わせて縮小する(Swiper は倍率をかける前の大きさで組む)
    const stopFit = watchViewSize()
    const stopPageNumbers = watchPageNumbers()

    // URL の &effect= が無ければ、デッキの動きの設定の既定の遷移(Swiper にあるもの)
    const fromMotion = motion?.transition && MODE_TRANSITIONS.swiper.deck.includes(motion.transition) ? motion.transition : undefined
    const effect = new URLSearchParams(location.search).get('effect') ?? fromMotion ?? 'slide'
    if (!(effect in EFFECTS)) console.warn(`[deck] 演出「${effect}」はありません(${Object.keys(EFFECTS).join('・')})`)
    const step = new Map<number, number>()
    const swiper = new Swiper(el, {
      modules: [A11y, EffectCards, EffectCoverflow, EffectCreative, EffectCube, EffectFade, EffectFlip],
      ...(EFFECTS[effect as SwiperEffect] ?? {}),
      speed: 600,
      initialSlide: activeIndex.current,
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
      activeIndex.current = i
      const slide = slides()[i]
      show(i, i < previous ? slideSteps(slide) : 1)
      previous = i
      announcePresent(slide)
    })
    announcePresent(slides()[swiper.activeIndex])

    const next = () => {
      const i = swiper.activeIndex
      const k = step.get(i) ?? 1
      if (k < slideSteps(slides()[i])) show(i, k + 1)
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
    registerGoTo((slide) => {
      const i = slides().indexOf(slide)
      if (i >= 0) swiper.slideTo(i)
    })
    markReady()
    return () => {
      document.removeEventListener('keydown', onKey)
      stopFit()
      stopPageNumbers()
      swiper.destroy(true, false)
    }
  }, [Slides])

  return (
    <div ref={container} className="swiper deck">
      <div className="swiper-wrapper">
        <Slides components={swiperComponents} />
      </div>
    </div>
  )
}
