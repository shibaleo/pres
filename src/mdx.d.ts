declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const MDXComponent: ComponentType<Record<string, unknown>>
  export default MDXComponent
  /** 原稿の警告(参照先の無い \ref・未登録の文献など)。vite/remark-beamer が export する */
  export const deckWarnings: { line?: number; message: string }[]
}
