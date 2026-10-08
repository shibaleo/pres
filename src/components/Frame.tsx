import type { CSSProperties, ReactNode } from 'react'

/**
 * 見出し付きの囲み(Beamer の block と同じ 見出し + 本文 の 2 段)。見た目は theme/base.css のパネル。
 * color は見出しの下線の色で、--accent として渡す
 * (実際の色は theme/tokens.css の --color-frame-* トークンが持ち、ここは名前の一覧だけ)。
 */
export type FrameColor = 'gray' | 'red' | 'blue' | 'gold' | 'green' | 'purple'

export default function Frame({
  color = 'red',
  title,
  children,
}: {
  color?: FrameColor
  title?: ReactNode
  children: ReactNode
}) {
  const style = { '--accent': `var(--color-frame-${color})` } as CSSProperties
  return (
    <div className="frame" style={style}>
      {title && <div className="frame-title">{title}</div>}
      <div className="frame-body">{children}</div>
    </div>
  )
}
