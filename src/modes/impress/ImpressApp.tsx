import { useEffect } from 'react'
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
 * impress は初期化のときの置き場所しか知らないので、窓の大きさが変わったら、置き直して作り直す(tear してから init)。
 * 段階表示は段の印(impress の substep。components.tsx)で進める。まわりとの約束は deck/mode.ts。
 */
export default function ImpressApp({ Slides, motion }: DeckSource) {
  useEffect(() => {
    const onChange = (e: Event) => {
      const step = (e.target as Element).closest('.step')
      if (!step) return
      syncOverlays(step)
      if (e.type === 'impress:stepenter') announcePresent(step)
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
      applyPlace(document.getElementById('overview')!, overviewOf(places, size))
      return size
    }
    let size = layout()
    document.querySelectorAll('#impress .step.slide').forEach(syncOverlays)

    let api: ImpressApi | null = null
    const start = () => {
      api = window.impress!('impress')
      api.init()
      const a = api
      registerGoTo((slide) => a.goto(slide))
    }
    // impress.js は読み込むとグローバルの impress を作る(このモードのときだけ読み込む)
    import('impress.js').then(() => {
      start()
      markReady()
    })

    // 窓の大きさが変わったら、落ち着いてから置き直して作り直し、今のスライドに戻る
    let timer = 0
    const onResize = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        const next = viewSize()
        if (!api || (next.width === size.width && next.height === size.height)) return
        const active = document.querySelector('#impress .step.active')
        api.tear()
        size = layout()
        start()
        if (active) api!.goto(active, 0)
      }, 300)
    }
    addEventListener('resize', onResize)
    return () => {
      for (const name of events) document.removeEventListener(name, onChange)
      removeEventListener('resize', onResize)
      clearTimeout(timer)
      stopPageNumbers()
      stopViewSize()
    }
  }, [])

  return (
    <div
      id="impress"
      className="deck"
      data-max-scale="3"
      data-transition-duration="1000"
    >
      {/* impress は #impress の子を自分の canvas に移す。React の描く範囲をこの div の中に閉じて、移されても壊れないようにする */}
      <div className="impress-slides">
        <Slides components={impressComponents} />
      </div>
      <div id="overview" className="step overview" />
    </div>
  )
}
