import { isValidElement, useRef, type ReactNode, type CSSProperties } from 'react'
import { useSlideStep } from '../figure/steps'

/**
 * スライド用のレイアウト部品。MDX から <div style> や <br> を追い出し、意味のあるタグだけで書けるようにする。
 * 見た目は theme/base.css(.cols / .byline / .note / .code)。style は原稿側の一時的な調整(文字の大きさなど)用。
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
  /** 列の間隔。省略時は theme/base.css の既定 */
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

/**
 * ソースコード表示(本文より小さめ)。中身は文字列か、CommonMark のコードブロック(```。行頭の空白が残るのでこちらがよい。
 * MDX の {`…`} の複数行の文字列は、2 行目以降の行頭の空白が Markdown の字下げとして落ちる)。
 * highlight="1-2 | 3 | 5-6" で、段ごとに強調する行を変える
 * (範囲 1 つが 1 段。段の数は原稿の変換が数え、各範囲の段を highlightSteps に書く。vite/remark-beamer/transform.ts)。
 * 強調している間は、ほかの行を薄くする。今の段は figure/steps.ts の useSlideStep で受け取る
 */
export function Code({ children, highlight, highlightSteps }: { children: ReactNode; highlight?: string; highlightSteps?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const step = useSlideStep(ref)
  const source = textOf(children)
  if (highlight === undefined) return <pre className="code">{source}</pre>
  const ranges = highlight.split('|').map(lineSet)
  const at = (highlightSteps ?? '').split(' ').map(Number)
  // 今の段までに来た最後の範囲(コードの出る段より前は強調なし)
  let active = -1
  at.forEach((s, i) => {
    if (step >= s) active = i
  })
  const on = active >= 0 ? ranges[active] : undefined
  const lines = source.replace(/\n$/, '').split('\n')
  return (
    <pre ref={ref} className="code code-steps">
      {lines.map((line, i) => (
        <span key={i} className={on ? (on.has(i + 1) ? 'code-line code-line-on' : 'code-line code-line-off') : 'code-line'}>
          {line}
        </span>
      ))}
    </pre>
  )
}

/** 中身の文字(コードブロックなら <pre><code> の中の文字) */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** "1-2, 5" → {1, 2, 5}(行は 1 から数える) */
function lineSet(range: string): Set<number> {
  const out = new Set<number>()
  for (const part of range.split(',')) {
    const [a, b] = part.trim().split('-').map(Number)
    for (let k = a; k <= (b ?? a); k++) out.add(k)
  }
  return out
}
