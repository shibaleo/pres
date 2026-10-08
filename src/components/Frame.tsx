import type { CSSProperties, ReactNode } from 'react'

/**
 * 色付きの囲み。見た目は theme.css の .frame。アクセント色は --accent として渡す
 * (実際の色は theme.css の --color-frame-* トークンが持ち、ここは名前の一覧だけ)。
 */
export type FrameColor = 'gray' | 'red' | 'blue' | 'gold' | 'green' | 'purple'

export default function Frame({
  color = 'red',
  title,
  math = false,
  children,
}: {
  color?: FrameColor
  title?: ReactNode
  /** 定理枠など: 背景を数式用のグレーにする */
  math?: boolean
  children: ReactNode
}) {
  const style = { '--accent': `var(--color-frame-${color})` } as CSSProperties
  return (
    <div className={math ? 'frame frame-math' : 'frame'} style={style}>
      {title && <div className="frame-title">{title}</div>}
      {children}
    </div>
  )
}
