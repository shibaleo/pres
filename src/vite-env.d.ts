/// <reference types="vite/client" />

// 以下の仮想モジュールは vite/deck/plugin.ts が生成する

/** 全スライド(表示順)。path は src/slides からの相対パス(1 ファイル複数枚なら #n 付き) */
declare module 'virtual:deck-slides' {
  import type { ComponentType } from 'react'
  const slides: {
    path: string
    mod: {
      default: ComponentType<{ components?: Record<string, unknown> }>
      slide?: Record<string, unknown>
    }
  }[]
  export default slides
}

/** 定理・式の通し番号。items: 項目 id → 番号、labels: \label の key → 番号 */
declare module 'virtual:refs' {
  export const items: Record<string, number>
  export const labels: Record<string, { n: number; kind: 'thm' | 'eq' }>
}

/** 引用の通し番号。order = デッキ全体の初出順の key */
declare module 'virtual:bibliography' {
  export const order: string[]
  export const entries: Record<string, { html: string; text: string }>
}

/** 原稿の警告(開発時に画面へ出す。build では失敗扱い) */
declare module 'virtual:deck-diagnostics' {
  const warnings: { file: string; line?: number; message: string }[]
  export default warnings
}

declare module 'reveal.js/plugin/notes/notes.esm.js' {
  const RevealNotes: () => unknown
  export default RevealNotes
}
