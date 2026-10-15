/**
 * reveal.js のテーマ(node_modules/reveal.js/dist/theme/*.css)を、この土台の見た目のプリセットに写す。
 * 出力は src/theme/presets/themes/reveal-<名前>.css(1 テーマ 1 ファイル。手で直さず、このスクリプトで作り直す)。
 *
 *   node scripts/reveal-themes.mjs      (npm run themes)
 *
 * 写すのは各テーマが :root の CSS 変数で持つ値: 地の色(--r-background-color。グラデーションの面 --r-background も)、
 * 文字の色(--r-main-color)、見出しの色・大文字・字間・影・太さ(--r-heading-*)、リンクの色(--r-link-color)、書体の系統。
 * 書体はテーマの書体(Source Sans Pro・League Gothic・Lato など)を埋め込まず、明朝(serif だけの書体)か
 * ゴシック(それ以外)の、埋め込み済みの Noto で代える(単一 HTML を保つため)。大きさは写さない(土台のまま)。
 * テーマに共通の規則(題の置き方・中央揃え・ページ番号)は reveal-common.css。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ROOT } from '../vite/decks.js'

const THEMES = join(ROOT, 'node_modules', 'reveal.js', 'dist', 'theme')
const OUT = join(ROOT, 'src', 'theme', 'presets', 'themes')
const version = JSON.parse(readFileSync(join(ROOT, 'node_modules', 'reveal.js', 'package.json'), 'utf8')).version

/** テーマの :root の CSS 変数(--r-*)。最初に現れた値 */
function variables(css) {
  const vars = {}
  for (const [, name, value] of css.matchAll(/--r-([a-z0-9-]+):([^;}]+)/g)) if (!(name in vars)) vars[name] = value.trim()
  return vars
}

/** 書体の並びを、埋め込み済みの書体に代える: serif だけの並び(sans-serif を含まない)は明朝、それ以外はゴシック */
const font = (stack) => (/\bserif\b/.test(stack) && !/sans-serif/.test(stack) ? "'Noto Serif JP', serif" : "'Noto Sans JP', sans-serif")
const weight = (w) => ({ normal: '400', bold: '700' })[w] ?? w

function preset(name, v) {
  const id = `reveal-${name}`
  const gradient = v.background?.includes('gradient') ? v.background : undefined
  return `/* プリセット: reveal.js(${version})のテーマ ${name}(reveal.js/dist/theme/${name}.css)の見た目を、この土台の上で写したもの。
   scripts/reveal-themes.mjs が作る(手で直さない。npm run themes で作り直す)。共通の規則は reveal-common.css。

   - 地 ${v['background-color']}${gradient ? `(面は ${gradient})` : ''}、文字 ${v['main-color']}、見出し ${v['heading-color']}、リンク ${v['link-color']}
   - 書体: 本文は ${v['main-font']}、見出しは ${v['heading-font']} の代わりに、埋め込み済みの ${font(v['main-font']).split(',')[0]}・${font(v['heading-font']).split(',')[0]}
   - 大きさ(文字・行送り・余白)は土台のまま

   使い方(デッキの decks/<名前>/style.css): @import '@/theme/presets/themes/${id}.css'; したうえで
     :root { --deck-preset: ${id}; }(ほかのプリセットと並べるときは後ろに書く) */
@import './reveal-common.css';

[data-preset~='${id}'] {
  --font-body: ${font(v['main-font'])};
  --font-heading: ${font(v['heading-font'])};
  --body-weight: 400;
  --heading-weight: ${weight(v['heading-font-weight'])};
  --color-brand: ${v['link-color']};
  --color-ink: ${v['main-color']};
  --color-muted: color-mix(in srgb, ${v['main-color']} 70%, ${v['background-color']});
  --color-canvas: ${v['background-color']};
  --color-surface: color-mix(in srgb, ${v['main-color']} 10%, ${v['background-color']});
  --reveal-heading-color: ${v['heading-color']};
  --reveal-heading-transform: ${v['heading-text-transform']};
  --reveal-heading-letter-spacing: ${v['heading-letter-spacing']};
  --reveal-heading-shadow: ${v['heading-text-shadow']};
}
${gradient ? `[data-preset~='${id}'] body {\n  background: ${gradient};\n  background-color: ${v['background-color']};\n}\n` : ''}`
}

const names = readdirSync(THEMES).filter((f) => f.endsWith('.css')).map((f) => basename(f, '.css')).sort()
for (const name of names) {
  const v = variables(readFileSync(join(THEMES, `${name}.css`), 'utf8'))
  writeFileSync(join(OUT, `reveal-${name}.css`), preset(name, v))
}
console.log(`reveal のテーマ ${names.length} 種を src/theme/presets/themes/ に書き出しました: ${names.join(', ')}`)
