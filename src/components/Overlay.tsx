import type { ReactNode } from 'react'

/**
 * Beamer の overlay(`\pause`, `<2->`, `\only<2>{…}` など)を reveal の fragment に変換したもの。
 * 原稿の記法は vite/deck/scan.ts がこの部品に置き換える(手で書く必要はない)。
 *
 * ステップの対応: Beamer の n 枚目 = reveal の fragment index n-2(1 枚目は何も出ていない状態)。
 *   from  … このステップから表示(外側の fragment)
 *   to    … このステップまで表示。次のステップで消える(内側の fade-out)
 *   only  … 非表示の間は場所も取らない(\only)。既定は場所を残す(\uncover)
 */
export function Overlay({
  from,
  to,
  as: Tag = 'div',
  only = false,
  li = false,
  children,
}: {
  from: number
  to?: number
  as?: 'div' | 'span'
  only?: boolean
  /** 箇条書きの項目(`- <2-> …`)。CSS で行頭記号も一緒に隠す */
  li?: boolean
  children?: ReactNode
}) {
  const cls = (...c: (string | false)[]) => c.filter(Boolean).join(' ')
  let node = children
  if (to !== undefined) {
    node = (
      <Tag className={cls('fragment fade-out', only && 'only')} data-fragment-index={to - 1}>
        {node}
      </Tag>
    )
  }
  if (from >= 2) {
    node = (
      <Tag className={cls('fragment', only && 'only', li && 'ov-li')} data-fragment-index={from - 2}>
        {node}
      </Tag>
    )
  }
  return <>{node}</>
}

/**
 * スライドのステップ数を Beamer と揃えるための、見えない fragment。
 * reveal は使われていない index を詰めてしまうので(`<3->` だけだと 2 枚目に出る)、
 * 1 枚目以外の全ステップに 1 つずつ置いて欠番を無くす。
 */
export function OverlaySteps({ max }: { max: number }) {
  return (
    <>
      {Array.from({ length: max - 1 }, (_, i) => (
        <span key={i} className="fragment overlay-step" data-fragment-index={i} aria-hidden />
      ))}
    </>
  )
}
