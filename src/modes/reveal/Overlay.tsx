import { createContext, useContext } from 'react'
import type { StepEffect } from '../names'
import type { OverlayProps } from '../structure'

/** 段の現れ方(デッキの motion.ts の step。RevealApp が配る) */
export const StepEffectContext = createContext<StepEffect>('fade')

/**
 * 段の現れ方を reveal の fragment の型にする。fade は reveal の既定(型なし)。blur と none は reveal に無いので、
 * reveal.css の規則(.fragment.blur・.fragment.instant)
 */
const FRAGMENT_STYLE: Record<StepEffect, string | false> = {
  fade: false,
  'fade-up': 'fade-up',
  'fade-down': 'fade-down',
  'fade-left': 'fade-left',
  'fade-right': 'fade-right',
  'zoom-in': 'zoom-in',
  blur: 'blur',
  none: 'instant',
}

/**
 * reveal モードの Overlay: Beamer の overlay(`\pause`, `<2->`, `\only<2>{…}`, <Fragment> など)を reveal の fragment にしたもの。
 * 原稿の記法は vite/remark-beamer/transform.ts がこの部品に置き換える(手で書く必要はない)。
 *
 * ステップの対応: Beamer の n 枚目 = reveal の fragment index n-2(1 枚目は何も出ていない状態)。
 *   from  … このステップから表示(外側の fragment)
 *   to    … このステップまで表示。次のステップで消える(内側の fade-out)
 *   only  … 非表示の間は場所も取らない(\only)。既定は場所を残す(\uncover)
 */
export function Overlay({ from, to, as: Tag = 'div', only = false, children }: OverlayProps) {
  const effect = useContext(StepEffectContext)
  const cls = (...c: (string | false)[]) => c.filter(Boolean).join(' ')
  let node = children
  if (to !== undefined) {
    node = (
      <Tag className={cls('fragment fade-out', only && 'only')} data-fragment-index={Number(to) - 1}>
        {node}
      </Tag>
    )
  }
  if (Number(from) >= 2) {
    // 現れ方の型は、現れる側の fragment に付ける(\only はどのモードでもすぐ出す)
    node = (
      <Tag className={cls('fragment', only && 'only', !only && FRAGMENT_STYLE[effect])} data-fragment-index={Number(from) - 2}>
        {node}
      </Tag>
    )
  }
  return <>{node}</>
}

/**
 * スライドのステップ数を Beamer と揃えるための、見えない fragment(Slide がスライドの末尾に置く)。
 * reveal は使われていない index を詰めてしまうので(`<3->` だけだと 2 枚目に出る)、
 * 1 枚目以外の全ステップに 1 つずつ置いて欠番を無くす。
 */
export function OverlaySteps({ steps }: { steps: number }) {
  return (
    <>
      {Array.from({ length: steps - 1 }, (_, i) => (
        <span key={i} className="fragment overlay-step" data-fragment-index={i} aria-hidden />
      ))}
    </>
  )
}
