import type { ReactNode } from 'react'

/**
 * スピーカーノート。スライドには表示されず、`S` キーで開く発表者ビューにだけ出る。
 * reveal の規約(<aside class="notes">)どおりに出力するだけの薄い部品。
 */
export default function Notes({ children }: { children: ReactNode }) {
  return <aside className="notes">{children}</aside>
}
