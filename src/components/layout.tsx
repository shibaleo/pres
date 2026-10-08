import type { ReactNode, CSSProperties } from 'react'

/**
 * スライド用のレイアウト部品。MDX から <div style> や <br> を追い出し、意味のあるタグだけで書けるようにする。
 * 見た目は theme.css(.cols / .byline / .note / .code)。style は原稿側の一時的な調整(文字の大きさなど)用。
 */

/** 中央寄せ */
export function Center({ children }: { children: ReactNode }) {
  return <div className="text-center">{children}</div>
}

/** 横並びの列コンテナ */
export function Cols({
  children,
  gap,
  style,
}: {
  children: ReactNode
  /** 列の間隔。省略時は theme.css の既定 */
  gap?: number | string
  style?: CSSProperties
}) {
  return (
    <div className="cols" style={{ gap, ...style }}>
      {children}
    </div>
  )
}

/** Cols の中の1列 */
export function Col({ children }: { children: ReactNode }) {
  return <div className="col">{children}</div>
}

/** 発表者・所属・日付など、中央寄せの複数行(<br> の代替)。1 行目を主、以降を従として表示する */
export function Byline({ lines }: { lines: string[] }) {
  return (
    <div className="byline">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  )
}

/** 淡いグレー背景の囲み */
export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="note" style={style}>
      {children}
    </div>
  )
}

/** ソースコード表示(本文より小さめ) */
export function Code({ children }: { children: string }) {
  return <pre className="code">{children}</pre>
}
