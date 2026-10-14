/**
 * スライドの最小サイズ(論理座標の px)。原稿が当てにしてよいのはこの大きさだけ(modes/reveal/slide-size.ts)。
 * ブラウザに依存しないので、ビルド側(vite/mdx-options.ts の数式の組む幅)からも読む。
 */
export const SLIDE_HEIGHT = 700
export const MIN_WIDTH = Math.round((SLIDE_HEIGHT * 4) / 3)
