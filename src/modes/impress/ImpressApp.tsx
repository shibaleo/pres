import { useEffect } from 'react'
import type { DeckSource } from '../../deck/source'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { announcePresent, markReady, registerGoTo } from '../../deck/mode'
import { applyStep, currentStep } from '../marker-steps'
import { impressComponents } from './components'
import './impress.css'

declare global {
  interface Window {
    impress?: (rootId?: string) => { init(): void; goto(target: string | number | Element): void }
  }
}

/** step(スライド)を今の段の状態にする。段の印は substep で、見えている印(substep-visible)が進んだ印 */
const syncOverlays = (step: Element) => applyStep(step, currentStep(step, '.substep-visible'))

/**
 * impress モード: スライドを平面に並べ、カメラが移って拡大・縮小する(impress.js)。
 * 横の並びは右へ、縦の続き(--)は下へ置き、最後に全体を見渡す step を足す。
 * 段階表示は段の印(impress の substep。components.tsx)で進める。まわりとの約束は deck/mode.ts。
 */
export default function ImpressApp({ Slides }: DeckSource) {
  useEffect(() => {
    const onChange = (e: Event) => {
      const step = (e.target as Element).closest('.step')
      if (!step) return
      syncOverlays(step)
      if (e.type === 'impress:stepenter') announcePresent(step)
    }
    const events = ['impress:stepenter', 'impress:substep:enter', 'impress:substep:leave']
    for (const name of events) document.addEventListener(name, onChange)

    // 全体を見渡す step: 全スライドの範囲の中央に置き、範囲が画面に収まる倍率にする
    const slides = [...document.querySelectorAll<HTMLElement>('#impress .step.slide')]
    const xs = slides.map((s) => Number(s.dataset.x))
    const ys = slides.map((s) => Number(s.dataset.y))
    const overview = document.getElementById('overview')!
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    overview.dataset.x = String((minX + maxX) / 2)
    overview.dataset.y = String((minY + maxY) / 2)
    overview.dataset.scale = String(1.1 * Math.max((maxX - minX + MIN_WIDTH) / MIN_WIDTH, (maxY - minY + SLIDE_HEIGHT) / SLIDE_HEIGHT))

    slides.forEach(syncOverlays)
    // impress.js は読み込むとグローバルの impress を作る(このモードのときだけ読み込む)
    import('impress.js').then(() => {
      const api = window.impress!('impress')
      api.init()
      registerGoTo((slide) => api.goto(slide))
      markReady()
    })
    return () => {
      for (const name of events) document.removeEventListener(name, onChange)
    }
  }, [])

  return (
    <div
      id="impress"
      className="deck"
      data-width={MIN_WIDTH}
      data-height={SLIDE_HEIGHT}
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
