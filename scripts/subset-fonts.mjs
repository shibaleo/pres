/**
 * フォントサブセット化: fonts-src/*.ttf を、実際に使う文字だけの woff2 へ絞る。
 * インタラクティブにフォントは変えないので、ソース中に出現する文字＋基本記号で十分。
 * 出力(src/fonts/*.woff2)は theme.css が参照し、singlefile ビルドで base64 インライン化される。
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')

// 使用文字を集める対象拡張子(表示テキストが含まれるもの)
const SCAN_EXT = new Set(['.mdx', '.md', '.tsx', '.ts', '.jsx', '.js', '.bib'])
function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'fonts') continue // 出力先はスキップ
    const p = join(dir, name)
    if (statSync(p).isDirectory()) collectFiles(p, acc)
    else if (SCAN_EXT.has(extname(name))) acc.push(p)
  }
  return acc
}

/**
 * 原稿から \input{…} で取り込まれるファイル(src の外にあってもよい)もたどる。
 * 解決の規則は vite/remark-beamer と同じ: 主ファイル(src/slides.mdx)のディレクトリ基準で、
 * まず .mdx を付けた名前、無ければ書いたままの名前。
 */
function collectInputs(file, acc = new Set()) {
  if (acc.has(file)) return acc
  acc.add(file)
  for (const m of readFileSync(file, 'utf8').matchAll(/^[ \t]*\\input\{([^}]+)\}[ \t]*$/gm)) {
    const target = m[1].trim()
    const found = [resolve(srcDir, `${target}.mdx`), resolve(srcDir, target)].find((c) => existsSync(c) && statSync(c).isFile())
    if (found) collectInputs(found, acc)
  }
  return acc
}

const files = new Set([...collectFiles(srcDir), ...collectInputs(join(srcDir, 'slides.mdx'))])
let text = ''
for (const f of files) text += readFileSync(f, 'utf8')

// 基本セット: 印字可能 ASCII + よく使う日本語記号/数学記号(保険)
let base = ''
for (let c = 0x20; c <= 0x7e; c++) base += String.fromCharCode(c)
const extra = '　、。，．・：；？！゛゜（）「」『』【】〔〕…—–‐※→←↑↓°±×÷≤≥≠≒∞∫∂√πλμαβγθφ'
const glyphs = [...new Set([...base, ...extra, ...text])]
  .filter((c) => c.codePointAt(0) >= 0x20)
  .join('')

const FONTS = [
  ['cmu.serif-roman.ttf', 'cmu.serif-roman.woff2'],
  ['cmu.serif-bold.ttf', 'cmu.serif-bold.woff2'],
  ['NotoSerifJP-VariableFont_wght.ttf', 'NotoSerifJP.woff2'],
  ['NotoSansJP-VariableFont_wght.ttf', 'NotoSansJP.woff2'],
  ['GenShinGothic-Monospace-Regular.ttf', 'GenShinGothic-Monospace.woff2'],
]

const outDir = join(srcDir, 'fonts')
mkdirSync(outDir, { recursive: true })

console.log(`subsetting to ${glyphs.length} unique glyphs`)
for (const [src, out] of FONTS) {
  const buf = readFileSync(join(root, 'fonts-src', src))
  const sub = await subsetFont(buf, glyphs, { targetFormat: 'woff2' })
  writeFileSync(join(outDir, out), sub)
  console.log(
    `  ${out}: ${(sub.length / 1024).toFixed(1)} KB  (from ${(buf.length / 1024 / 1024).toFixed(1)} MB)`,
  )
}
