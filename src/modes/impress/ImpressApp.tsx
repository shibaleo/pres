import { useEffect, useRef } from 'react'
import type { DeckSource } from '../../deck/source'
import { viewSize, watchViewSize } from '../../deck/view-size'
import { announcePresent, markReady, registerGoTo } from '../../deck/mode'
import { applyStep, currentStep } from '../marker-steps'
import { watchPageNumbers } from '../page-number'
import { impressComponents } from './components'
import { applyPlace, overviewOf, placeSlides } from './layout'
import './impress.css'

declare global {
  interface Window {
    impress?: (rootId?: string) => ImpressApi
  }
}

type ImpressApi = { init(): void; tear(): void; goto(target: string | number | Element, duration?: number): void }

/** step(スライド)を今の段の状態にする。段の印は substep で、見えている印(substep-visible)が進んだ印 */
const syncOverlays = (step: Element) => applyStep(step, currentStep(step, '.substep-visible'))

/**
 * impress モード: スライドを平面に並べ、カメラが移って拡大・縮小する(impress.js)。
 * 置き方はデッキの動きの設定(motion.ts の impress。既定は横の並びを右へ、縦の続き(--)を下へ。layout.ts)で、
 * 最後に全体を見渡す step を足す。スライドの大きさは窓と同じ縦横比(deck/view-size.ts)で、置き方の間隔もそこから決める。
 * impress は初期化のときの置き場所と step しか知らないので、窓の大きさが変わったときと原稿を直したとき(開発時の HMR)は、
 * 置き直して作り直し、同じ番目の step に戻る(rebuild)。
 * 段階表示は段の印(impress の substep。components.tsx)で進める。まわりとの約束は deck/mode.ts。
 */
export default function ImpressApp({ Slides, motion }: DeckSource) {
  // zoom(Prezi 風)の置き方では、全体を見渡すところから始め、最初のスライドへ寄っていく(最初の step を見渡しにする)
  const startFromOverview = motion?.impress?.layout === 'zoom'
  /** 作り直し(原稿が変わったときに呼ぶ。最初の効果が用意する) */
  const rebuild = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    /** 今の step の番目(#impress の .step の中で。作り直した後に戻る所) */
    let activeIndex = 0
    const allSteps = () => [...document.querySelectorAll<HTMLElement>('#impress .step')]
    const slideSteps = () => [...document.querySelectorAll<HTMLElement>('#impress .step.slide')]
    const onChange = (e: Event) => {
      const step = (e.target as Element).closest('.step')
      if (!step) return
      syncOverlays(step)
      if (e.type === 'impress:stepenter') {
        activeIndex = Math.max(0, allSteps().indexOf(step as HTMLElement))
        announcePresent(step)
      }
    }
    const events = ['impress:stepenter', 'impress:substep:enter', 'impress:substep:leave']
    for (const name of events) document.addEventListener(name, onChange)
    const stopPageNumbers = watchPageNumbers()
    const stopViewSize = watchViewSize()

    /**
     * 今の窓の大きさで置く: 全体の大きさ(impress が窓に合わせる基準)、スライドの置き場所(impress は初期化のときに data-x などを読む)、
     * 全体を見渡す step(全スライドが画面に収まる所)
     */
    const layout = () => {
      const size = viewSize()
      const root = document.getElementById('impress')!
      root.dataset.width = String(size.width)
      root.dataset.height = String(size.height)
      const slides = [...document.querySelectorAll<HTMLElement>('#impress .step.slide')]
      const places = placeSlides(
        slides.map((s) => ({ h: Number(s.dataset.h), v: Number(s.dataset.v), id: s.id || undefined })),
        size,
        motion?.impress,
      )
      slides.forEach((s, i) => applyPlace(s, places[i]))
      const overview = overviewOf(places, size)
      applyPlace(document.getElementById('overview')!, overview)
      const start = document.getElementById('overview-start')
      if (start) applyPlace(start, overview)
      slides.forEach(syncOverlays)
      return size
    }
    let size = layout()

    let api: ImpressApi | null = null
    const start = () => {
      api = window.impress!('impress')
      api.init()
      const a = api
      registerGoTo((slide) => a.goto(slide))
    }
    // impress.js は読み込むとグローバルの impress を作る(このモードのときだけ読み込む)
    import('impress.js').then(() => {
      if (cancelled) return // React の StrictMode が効果を 2 回走らせたときの 1 回目
      start()
      markReady()
    })

    /**
     * 置き直して作り直し、同じ番目の step に戻る。impress の tear は、全体の中身を innerHTML で書き直して元に戻す
     * (React が描いた要素が別の要素に置き換わり、図などが動かなくなる)。そこで React の要素(スライドの束と全体を見渡す step)を
     * 先に外へ出し、空の step だけを残して tear し、終わったら元の要素を戻して、impress が付けた class と style を外す
     */
    const rebuildNow = () => {
      if (!api) return
      const root = document.getElementById('impress')!
      const own = [
        ...(document.getElementById('overview-start') ? [document.getElementById('overview-start')!] : []),
        root.querySelector<HTMLElement>('.impress-slides')!,
        document.getElementById('overview')!,
      ]
      own.forEach((el) => el.remove())
      const placeholder = document.createElement('div')
      placeholder.className = 'step active' // tear は今の step(.active)があるものとして読む
      root.firstElementChild!.append(placeholder)
      api.tear()
      root.replaceChildren(...own)
      for (const step of root.querySelectorAll<HTMLElement>('.step')) {
        step.classList.remove('future', 'past', 'present', 'active')
        step.style.position = step.style.transform = step.style.transformStyle = ''
      }
      for (const el of root.querySelectorAll('.substep-visible, .substep-active')) el.classList.remove('substep-visible', 'substep-active')
      for (const c of [...document.body.classList]) if (c.startsWith('impress-on-')) document.body.classList.remove(c)
      size = layout()
      start()
      const steps = allSteps()
      api.goto(steps[Math.min(activeIndex, steps.length - 1)], 0)
    }
    rebuild.current = rebuildNow

    /**
     * 一覧: O キーで全体を見渡す step(#overview)と、その前のスライドを行き来する(impress の Esc は全画面の解除に使われている)。
     * 見渡しでスライドを押すと、そのスライドへ移る(impress の動き)
     */
    let beforeOverview: Element | null = null
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'o' && e.key !== 'O') return
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as Element).closest('input, textarea, [contenteditable], .figure')) return
      if (!api) return
      const overview = document.getElementById('overview')!
      const active = document.querySelector('#impress .step.active')
      e.preventDefault()
      // 作り直した後は前のスライドの要素が無くなっていることがある(そのときは最初のスライドへ)
      if (active === overview || active?.id === 'overview-start') api.goto(beforeOverview?.isConnected ? beforeOverview : slideSteps()[0])
      else {
        beforeOverview = active
        api.goto(overview)
      }
    }
    document.addEventListener('keydown', onKey)

    // 窓の大きさが変わったら、落ち着いてから作り直す
    let timer = 0
    const onResize = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        const next = viewSize()
        if (next.width !== size.width || next.height !== size.height) rebuildNow()
      }, 300)
    }
    addEventListener('resize', onResize)
    return () => {
      cancelled = true
      rebuild.current = null
      for (const name of events) document.removeEventListener(name, onChange)
      removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
      clearTimeout(timer)
      stopPageNumbers()
      stopViewSize()
    }
  }, [])

  // 原稿が変わったら(開発時の HMR。React はスライドを描き直したが、impress は前の step を持っている)作り直す
  const shown = useRef(Slides)
  useEffect(() => {
    if (shown.current === Slides) return
    shown.current = Slides
    rebuild.current?.()
  }, [Slides])

  return (
    <div
      id="impress"
      className="deck"
      data-max-scale="3"
      data-transition-duration="1000"
    >
      {startFromOverview && <div id="overview-start" className="step overview" />}
      {/* impress は #impress の子を自分の canvas に移す。React の描く範囲をこの div の中に閉じて、移されても壊れないようにする */}
      <div className="impress-slides">
        <Slides components={impressComponents} />
      </div>
      <div id="overview" className="step overview" />
    </div>
  )
}
