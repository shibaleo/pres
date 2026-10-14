import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { deckSlides, goToSlide } from './mode'
import { watchOverflow, type Overflow } from './overflow'

/**
 * 開発時の道具(どのモードでも同じ。main.tsx がモードと並べて置く):
 *   - スライドの最小サイズからのはみ出しの検査(deck/overflow.ts)。開発時と、ビルドしたデッキを ?check-overflow で開いたとき
 *   - 開発時だけ、原稿の警告(参照先の無い \ref、未登録の文献、\label の重複)とはみ出しの一覧を画面右上に出す
 * どちらも表示は続けられるがそのままでは配布できないもの(build・check では失敗する)を、書きながら気づけるように。
 * はみ出しは押すとそのスライドへ移る(今見ていないスライドのはみ出しにも気づける。移り方はモードが登録する。deck/mode.ts)。
 * 記法エラーはここではなく Vite のエラー画面に出る。warnings は deck.mdx の export(vite/remark-beamer が出力する)。
 */
export default function DevDiagnostics({ warnings, check }: { warnings: { file?: string; line?: number; message: string }[]; check: boolean }) {
  const [overflows, setOverflows] = useState<Overflow[]>([])
  useEffect(() => (check ? watchOverflow(setOverflows) : undefined), [check])

  const [open, setOpen] = useState(true)
  if (!import.meta.env.DEV) return null
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
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  const slide = deckSlides()[o.index]
                  if (slide) goToSlide(slide)
                }}
              >
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
