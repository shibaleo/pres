import type { ReactNode } from 'react'

/**
 * 段の印: 段階表示が「要素を文書順に 1 つずつ現す」だけのライブラリ(impress の substep、Shower の .next)で、
 * Beamer の段(番号の指定・消える指定を含む)を表す手。
 * スライドの段の数だけ空の要素(印)を置き、ライブラリには印だけを進めさせる。今の段 = 進んだ印の数 + 1 とし、
 * 各 Overlay の表示はそこから決める(applyStep)。見た目は theme/base.css の .overlay-hidden
 */

type OverlayProps = {
  /** Beamer の段の番号(1 枚目が 1)。この段から表示 */
  from: number | string
  /** この段まで表示(次の段で消える) */
  to?: number | string
  as?: 'div' | 'span'
  /** 非表示の間は場所も取らない(\only) */
  only?: boolean
  children?: ReactNode
}

/** Beamer の overlay(\pause・<2->・\only<2>{…} など)。表示するかは applyStep が決める */
export function Overlay({ from, to, as: Tag = 'div', only = false, children }: OverlayProps) {
  return (
    <Tag className={only ? 'overlay only' : 'overlay'} data-from={from} data-to={to}>
      {children}
    </Tag>
  )
}

/** 段の印を置く部品を作る。markerClass はライブラリが段として数える class(impress は substep、Shower は next) */
export function markerSteps(markerClass: string) {
  return function OverlaySteps({ max }: { max: number | string }) {
    return (
      <>
        {Array.from({ length: Number(max) - 1 }, (_, i) => (
          <span key={i} className={`${markerClass} overlay-step`} aria-hidden />
        ))}
      </>
    )
  }
}

/** スライドを段 k の状態にする(各 Overlay の表示を決める) */
export function applyStep(slide: Element, k: number) {
  for (const el of slide.querySelectorAll<HTMLElement>('.overlay')) {
    const from = Number(el.dataset.from)
    const to = el.dataset.to === undefined ? Infinity : Number(el.dataset.to)
    el.classList.toggle('overlay-hidden', k < from || k > to)
  }
}

/** 今の段: 進んだ印(passed に当たる印)の数 + 1 */
export function currentStep(slide: Element, passed: string): number {
  return slide.querySelectorAll(`.overlay-step:is(${passed})`).length + 1
}
