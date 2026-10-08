/**
 * スライドの並び順 = src/slides 以下の相対パスの自然順ソート。
 * (例: 10-abstract/10-title.mdx < 10-abstract/20-intro.mdx < 20-body/10-frames.mdx)
 *
 * ブラウザ側(slides.ts の import.meta.glob)とビルド側(引用番号の採番)の
 * 両方がこの関数を使うので、表示順と文献番号の順は必ず一致する。
 */
export function compareSlidePaths(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true })
}
