import type { ReactNode } from 'react'
import { mdxComponents } from '../../deck/mdx-components'

/**
 * impress モードの部品。原稿の変換結果(vite/remark-beamer の Slide / Stack / Overlay / OverlaySteps)を
 * impress.js の形(.step と .substep)にする。それ以外の部品(定理・囲み・段組み …)は reveal モードと同じものを使う。
 */

/** スライドを置く間隔(論理座標の px)。横の並び(h)は右へ、縦の続き(v)は下へ並べる */
export const GAP = { x: 1200, y: 900 }

/** スライド 1 枚 = impress の step。座標は並び(h・v。変換が付ける)から決める */
function Slide({ h, v, children, ...rest }: { h?: number | string; v?: number | string; children?: ReactNode }) {
  return (
    <div className="step slide" data-x={Number(h ?? 0) * GAP.x} data-y={Number(v ?? 0) * GAP.y} {...rest}>
      {children}
    </div>
  )
}

/** 縦の続きの束。impress は座標で並べるので包む要素は要らない */
function Stack({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

/**
 * Beamer の overlay(\pause・<2->・\only<2>{…} など)。表示するかは今の段で決める(ImpressApp の syncOverlays)。
 * from・to は Beamer の段の番号(1 枚目が 1)、only は非表示の間に場所も取らない(\only)
 */
function Overlay({
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
  return (
    <Tag className={only ? 'overlay only' : 'overlay'} data-from={from} data-to={to}>
      {children}
    </Tag>
  )
}

/**
 * スライドの段の数だけ、空の substep を置く。impress の substep は要素を文書順に 1 つずつ見せるだけで、
 * 段の番号の指定も「消える」も無いので、段を進める印としてだけ使い、今の段 = 見えている印の数 + 1 とする
 */
function OverlaySteps({ max }: { max: number | string }) {
  return (
    <>
      {Array.from({ length: Number(max) - 1 }, (_, i) => (
        <span key={i} className="substep overlay-step" aria-hidden />
      ))}
    </>
  )
}

/** reveal の Fragment に当たるもの。impress モードではまだ段に数えず、常に表示する */
function Fragment({ children }: { children?: ReactNode }) {
  return <div>{children}</div>
}

export const impressComponents = { ...mdxComponents, Slide, Stack, Overlay, OverlaySteps, Fragment }
