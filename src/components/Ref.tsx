import katex from 'katex'
import { items, labels } from 'virtual:refs'

/**
 * 相互参照と番号付きの式。番号はデッキ全体の出現順(vite/deck/plugin.ts の virtual:refs)。
 * 原稿では LaTeX と同じく \label{…} / \ref{…} / \eqref{…} と書く。
 */

/** \ref{key} → 2、\eqref{key} → (3)。参照先が無ければ LaTeX と同じく ?? */
export function Ref({ k, eq = false }: { k: string; eq?: boolean }) {
  const n = labels[k]?.n
  const text = n === undefined ? '??' : String(n)
  return <span className="ref">{eq ? `(${text})` : text}</span>
}

/** 番号付きの別行立て数式(\begin{equation} / \label 付きの $$…$$) */
export function Equation({ refId, tex }: { refId: string; tex: string }) {
  const n = items[refId]
  const html = katex.renderToString(`${tex}\\tag{${n ?? '?'}}`, { displayMode: true, throwOnError: false })
  return <div className="equation" dangerouslySetInnerHTML={{ __html: html }} />
}
