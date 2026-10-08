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

type Row = { tex: string; sep: string; refId?: string }

/**
 * 別行立ての数式(\begin{equation|align|gather} と \label 付きの $$…$$)。
 * 番号は KaTeX の自動番号を使わず、行ごとに \tag{n} を差し込む
 * (デッキ全体の通し番号にし、\ref で参照できるようにするため)。
 */
export function Equation({ env, rows }: { env: string; rows: Row[] }) {
  const body = rows
    .map((r) => r.tex + (r.refId ? `\\tag{${items[r.refId] ?? '?'}}` : '') + r.sep)
    .join('')
  const tex = env === 'equation' ? body : `\\begin{${env}*}${body}\\end{${env}*}`
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false })
  return <div className="equation" dangerouslySetInnerHTML={{ __html: html }} />
}
