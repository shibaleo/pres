import { useEffect, type CSSProperties } from 'react'
import type { DeckSource } from '../../App'
import { MIN_WIDTH, SLIDE_HEIGHT } from '../../deck/slide-metrics'
import { impressComponents } from './components'
import './impress.css'

declare global {
  interface Window {
    impress?: (rootId?: string) => { init(): void; goto(target: string | number | Element): void }
  }
}

/** step(スライド)の今の段: 見えている段の印(OverlaySteps の substep)の数 + 1 */
function syncOverlays(step: Element) {
  const k = step.querySelectorAll('.overlay-step.substep-visible').length + 1
  for (const el of step.querySelectorAll<HTMLElement>('.overlay')) {
    const from = Number(el.dataset.from)
    const to = el.dataset.to === undefined ? Infinity : Number(el.dataset.to)
    el.classList.toggle('overlay-hidden', k < from || k > to)
  }
}

/**
 * impress モード: スライドを平面に並べ、カメラが移って拡大・縮小する(impress.js)。
 * 横の並びは右へ、縦の続き(--)は下へ置き、最後に全体を見渡す step を足す。
 * 段階表示は impress の substep で進める(components.tsx の OverlaySteps)。
 * reveal モードにある一覧・ページ番号・はみ出しの検査・PDF 出力・開発時の警告の表示は、まだ無い。
 */
export default function ImpressApp({ Slides }: DeckSource) {
  useEffect(() => {
    const onChange = (e: Event) => {
      const step = (e.target as Element).closest('.step')
      if (step) syncOverlays(step)
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
      window.impress!('impress').init()
      document.documentElement.dataset.deckReady = ''
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
      style={{ '--impress-slide-width': `${MIN_WIDTH}px`, '--impress-slide-height': `${SLIDE_HEIGHT}px` } as CSSProperties}
    >
      {/* impress は #impress の子を自分の canvas に移す。React の描く範囲をこの div の中に閉じて、移されても壊れないようにする */}
      <div className="impress-slides">
        <Slides components={impressComponents} />
      </div>
      <div id="overview" className="step overview" />
    </div>
  )
}
