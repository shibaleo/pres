import type { ReactNode, CSSProperties } from 'react'

/**
 * スライド用のレイアウト部品。
 * MDX から <div style> や <br> を追い出し、意味のあるタグだけで書けるようにする。
 */

/** 中央寄せ */
export function Center({ children }: { children: ReactNode }) {
  return <div className="text-center">{children}</div>
}

/** 横並びの列コンテナ(旧: flex の div) */
export function Cols({
  children,
  gap = 24,
  style,
}: {
  children: ReactNode
  gap?: number
  style?: CSSProperties
}) {
  return (
    <div className="flex justify-center items-start" style={{ gap, ...style }}>
      {children}
    </div>
  )
}

/** Cols の中の1列 */
export function Col({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1 }}>{children}</div>
}

/** 発表者・所属・日付など、中央寄せの複数行(<br> の代替) */
export function Byline({ lines }: { lines: string[] }) {
  return (
    <div className="font-heading text-center" style={{ lineHeight: 2 }}>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  )
}

/** 淡いグレー背景の囲み(旧 .gray-background 相当) */
export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ backgroundColor: 'var(--color-eq)', padding: '0.4em 1em', ...style }}>
      {children}
    </div>
  )
}

/** ソースコード表示(影なし・小さめ) */
export function Code({ children }: { children: string }) {
  return <pre style={{ fontSize: '0.7em', boxShadow: 'none', margin: '0.4em 0' }}>{children}</pre>
}
