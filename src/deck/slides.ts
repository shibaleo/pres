import type { ComponentType } from 'react'
import type { SlideProps } from '@revealjs/react'
import { compareSlidePaths } from './order'

/**
 * スライドごとの設定。MDX で `export const slide = { ... }` と書く(省略可)。
 * stack 以外は reveal の <Slide> にそのまま渡る(background, transition など)。
 */
export type SlideMeta = Omit<SlideProps, 'children'> & {
  /** 同じ値を持つ「連続した」スライドを縦スライド(Stack)にまとめる */
  stack?: string
}

type SlideModule = {
  default: ComponentType<{ components?: Record<string, unknown> }>
  slide?: SlideMeta
}

export type SlideEntry = {
  /** src/slides からの相対パス(並び順のキー・警告表示用) */
  path: string
  Content: SlideModule['default']
  meta: SlideMeta
}

// src/slides/**/*.mdx を自動登録。ファイルを置くだけでスライドが増える。
const modules = import.meta.glob<SlideModule>('../slides/**/*.mdx', { eager: true })

export const slides: SlideEntry[] = Object.entries(modules)
  .map(([key, mod]) => ({
    path: key.replace(/^\.\.\/slides\//, ''),
    Content: mod.default,
    meta: mod.slide ?? {},
  }))
  .sort((a, b) => compareSlidePaths(a.path, b.path))

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
