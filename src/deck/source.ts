import type { ComponentType } from 'react'

/** 原稿(decks/<名前>/deck.mdx)のコンパイル結果。どのモードもこれを受け取る */
export type DeckSource = {
  Slides: ComponentType<Record<string, unknown>>
  /** 原稿の警告(参照先の無い \ref・未登録の文献など)。vite/remark-beamer が export する */
  warnings: { file?: string; line?: number; message: string }[]
}
