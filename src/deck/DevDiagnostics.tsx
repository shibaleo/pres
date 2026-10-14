import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Overflow } from './overflow'

/**
 * 開発時だけ: 原稿の警告(参照先の無い \ref、未登録の文献、\label の重複)と、スライドの最小サイズからの
 * はみ出しを画面右上に出す。どちらも表示は続けられるがそのままでは配布できないもの(build・check では失敗する)を、
 * 書きながら気づけるように。はみ出しは押すとそのスライドへ移る(今見ていないスライドのはみ出しにも気づける)。
 * 記法エラーはここではなく Vite のエラー画面に出る。
 * warnings は deck.mdx の export(vite/remark-beamer が出力する)、overflows は deck/overflow.ts の検査の結果。
 */
export default function DevDiagnostics({
  warnings,
  overflows,
  onJump,
}: {
  warnings: { file?: string; line?: number; message: string }[]
  overflows: Overflow[]
  onJump: (h: number, v: number) => void
}) {
  const [open, setOpen] = useState(true)
  if (warnings.length === 0 && overflows.length === 0) return null
  const summary = [warnings.length > 0 && `原稿の警告 ${warnings.length} 件`, overflows.length > 0 && `はみ出し ${overflows.length} 件`]
    .filter(Boolean)
    .join('・')
  return createPortal(
    <div className="deck-diagnostics">
      <button onClick={() => setOpen((o) => !o)}>⚠ {summary}</button>
      {open && (
        <ul>
          {warnings.map((w, i) => (
            <li key={`w${i}`}>
              <code>
                {w.file ?? 'deck.mdx'}
                {w.line ? `:${w.line}` : ''}
              </code>{' '}
              {w.message}
            </li>
          ))}
          {overflows.map((o, i) => (
            <li key={`o${i}`}>
              <a href={`#/${o.h}/${o.v}`} onClick={(e) => (e.preventDefault(), onJump(o.h, o.v))}>
                <code>
                  {o.file}:{o.line}
                </code>
              </a>{' '}
              {o.message}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  )
}
