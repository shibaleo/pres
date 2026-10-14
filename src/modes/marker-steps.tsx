import { isShown, overlayClass, type OverlayProps } from './structure'

/**
 * 段の印: 段階表示が「要素を文書順に 1 つずつ現す」だけのライブラリ(impress の substep、Shower の .next)で、
 * Beamer の段(番号の指定・消える指定を含む)を表す手。
 * スライドの段の数 - 1 個の空の要素(印)を置き、ライブラリには印だけを進めさせる。今の段 = 進んだ印の数 + 1 とし、
 * 各 Overlay の表示はそこから決める(applyStep)。段の印を使わないモード(Swiper)も、表示は applyStep で決める
 */

/** Overlay: 段の番号を data 属性に持ち、表示は applyStep が決める(最初は 1 段目の状態) */
export function Overlay({ from, to, as: Tag = 'div', only = false, children }: OverlayProps) {
  return (
    <Tag className={overlayClass(isShown(1, from, to), only)} data-from={from} data-to={to}>
      {children}
    </Tag>
  )
}

/** 段の印。markerClass はライブラリが段として数える class(impress は substep、Shower は next) */
export function StepMarkers({ steps, markerClass }: { steps: number; markerClass: string }) {
  return (
    <>
      {Array.from({ length: steps - 1 }, (_, i) => (
        <span key={i} className={`${markerClass} overlay-step`} aria-hidden />
      ))}
    </>
  )
}

/** スライドを段 k の状態にする(各 Overlay の表示を決める) */
export function applyStep(slide: Element, k: number) {
  for (const el of slide.querySelectorAll<HTMLElement>('.overlay')) {
    el.classList.toggle('overlay-hidden', !isShown(k, el.dataset.from!, el.dataset.to))
  }
}

/** 今の段: 進んだ印(passed に当たる印)の数 + 1 */
export function currentStep(slide: Element, passed: string): number {
  return slide.querySelectorAll(`.overlay-step:is(${passed})`).length + 1
}
