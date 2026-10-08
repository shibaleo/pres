import { useState } from 'react'
import { createPortal } from 'react-dom'
import warnings from 'virtual:deck-diagnostics'

/**
 * 開発時だけ: 原稿の警告(参照先の無い \ref、未登録の文献、\label の重複)を画面右上に出す。
 * 表示は続けられるがそのままでは配布できないもの(build では失敗する)を、書きながら気づけるように。
 * 記法エラーはここではなく Vite のエラー画面に出る。
 */
export default function DevDiagnostics() {
  const [open, setOpen] = useState(true)
  if (warnings.length === 0) return null
  return createPortal(
    <div className="deck-diagnostics">
      <button onClick={() => setOpen((o) => !o)}>⚠ 原稿の警告 {warnings.length} 件</button>
      {open && (
        <ul>
          {warnings.map((w, i) => (
            <li key={i}>
              <code>
                {w.file}
                {w.line ? `:${w.line}` : ''}
              </code>{' '}
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  )
}
