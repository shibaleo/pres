import type { ReactNode } from 'react'

/**
 * Beamer の overlay(`\pause`, `<2->`, `\only<2>{…}` など)を reveal の fragment に変換したもの。
 * 原稿の記法は vite/remark-beamer/transform.ts がこの部品に置き換える(手で書く必要はない)。
 * MDX の属性は文字列で渡るので、数値は文字列でも受け付ける。
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
  children,
}: {
  from: number | string
  to?: number | string
  as?: 'div' | 'span'
  only?: boolean
  children?: ReactNode
}) {
  const cls = (...c: (string | false)[]) => c.filter(Boolean).join(' ')
  from = Number(from)
  to = to === undefined ? undefined : Number(to)
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
      <Tag className={cls('fragment', only && 'only')} data-fragment-index={from - 2}>
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
export function OverlaySteps({ max }: { max: number | string }) {
  return (
    <>
      {Array.from({ length: Number(max) - 1 }, (_, i) => (
        <span key={i} className="fragment overlay-step" data-fragment-index={i} aria-hidden />
      ))}
    </>
  )
}
