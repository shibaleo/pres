/**
 * 図のラベル(x, y, μ, σ など)を、Unicode の数式用イタリックの文字(𝑥, 𝑦, 𝜇, 𝜎)にする。
 * 数式用フォント New Computer Modern Math(--font-math)で描くと、MathJax の数式(TeX の math italic)と
 * 同じ字形になる。ブラウザが普通の文字を斜めにしただけの文字とは形が違う。
 *
 * 変換するのはラテン文字とギリシャ文字の小文字だけ。それ以外(数字・記号)はそのまま。
 * これらの文字は scripts/subset-fonts.mjs が数式用フォントのサブセットに必ず入れる。
 */
const LATIN_UPPER = 0x1d434 // 𝐴
const LATIN_LOWER = 0x1d44e // 𝑎
const GREEK_LOWER = 0x1d6fc // 𝛼
const PLANCK = 'ℎ' // 数式用イタリックの h は、Unicode では U+210E(1D455 は欠番)

export function mathItalic(text: string): string {
  return [...text]
    .map((ch) => {
      const c = ch.codePointAt(0)!
      if (ch === 'h') return PLANCK
      if (c >= 0x41 && c <= 0x5a) return String.fromCodePoint(LATIN_UPPER + c - 0x41)
      if (c >= 0x61 && c <= 0x7a) return String.fromCodePoint(LATIN_LOWER + c - 0x61)
      if (c >= 0x3b1 && c <= 0x3c9) return String.fromCodePoint(GREEK_LOWER + c - 0x3b1)
      return ch
    })
    .join('')
}
