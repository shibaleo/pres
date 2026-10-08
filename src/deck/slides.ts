import type { ComponentType } from 'react'
import type { SlideProps } from '@revealjs/react'
import deckSlides from 'virtual:deck-slides'

/**
 * スライドごとの設定。MDX で `export const slide = { ... }` と書く(省略可)。
 * 1 ファイルを `---` で複数枚に分けた場合は、書いた区画のスライドだけに効く。
 * stack 以外は reveal の <Slide> にそのまま渡る(background, transition など)。
 */
export type SlideMeta = Omit<SlideProps, 'children'> & {
  /** 同じ値を持つ「連続した」スライドを縦スライド(Stack)にまとめる */
  stack?: string
}

export type SlideEntry = {
  /** src/slides からの相対パス(1 ファイル複数枚なら #n 付き)。key・警告表示に使う */
  path: string
  Content: ComponentType<{ components?: Record<string, unknown> }>
  meta: SlideMeta
}

// src/slides/**/*.mdx を表示順に、`---` で分割済みの 1 枚ずつ(vite/deck/plugin.ts が生成)
export const slides: SlideEntry[] = deckSlides.map(({ path, mod }) => ({
  path,
  Content: mod.default,
  meta: (mod.slide ?? {}) as SlideMeta,
}))

/** 横方向の並び。要素が配列なら縦スライド(Stack) */
export type DeckItem = SlideEntry | SlideEntry[]

export function groupStacks(entries: SlideEntry[]): DeckItem[] {
  const out: DeckItem[] = []
  for (const e of entries) {
    const prev = out[out.length - 1]
    const stack = e.meta.stack
    if (stack && Array.isArray(prev) && prev[0].meta.stack === stack) prev.push(e)
    else out.push(stack ? [e] : e)
  }
  return out
}
