// @ts-check
/**
 * ファイル取り込み命令のパス解決。LaTeX の \input と import パッケージ(v6.2, D. Arseneau)の規則に従う。
 * remark-beamer の変換と、フォントのサブセット化(scripts/subset-fonts.mjs)の両方が使うので、
 * そのまま Node で読める JavaScript(型は JSDoc)で書く。
 *
 *   \input{file}                 主ファイルのディレクトリ基準。\import / \subimport の中では
 *                                取り込み元のディレクトリを先に探し、無ければ主ファイルのディレクトリ
 *   \import{path}{file}          path は絶対パスか主ファイルのディレクトリ基準。その中の基準は path になる
 *   \subimport{path}{file}       path は今いるファイルの基準ディレクトリからの相対。入れ子にできる
 *   \inputfrom / \subinputfrom   \import / \subimport の別名。* 付きも同じ
 *
 * どれも、まず拡張子 .mdx を付けた名前、無ければ書いたままの名前を探す(LaTeX が .tex を補うのと同じ)。
 */
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/** @typedef {{ command: string; dir?: string; file: string }} Include */
/** 取り込みの文脈。baseDir は主ファイルのディレクトリ、importDir は \import / \subimport で決まった基準
 * @typedef {{ baseDir: string; importDir?: string }} IncludeContext */

/** 行単独の取り込み命令。引数が足りないものも拾い、parseInclude がエラーにする */
export const INCLUDE_LINE_RE = /^\s*\\(input|import|inputfrom|subimport|subinputfrom)\*?((?:\{[^}]*\}){1,2})\s*$/

/**
 * 行を解析する。取り込み命令でなければ null、引数の数が違えば { error }
 * @param {string} line
 * @returns {Include | { error: string } | null}
 */
export function parseInclude(line) {
  const m = line.match(INCLUDE_LINE_RE)
  if (!m) return null
  const args = [...m[2].matchAll(/\{([^}]*)\}/g)].map((a) => a[1].trim())
  const command = m[1]
  if (command === 'input') {
    if (args.length !== 1) return { error: '\\input は引数を 1 つ取ります(\\input{file})' }
    return { command, file: args[0] }
  }
  if (args.length !== 2) return { error: `\\${command} は引数を 2 つ取ります(\\${command}{path/}{file})` }
  return { command, dir: args[0], file: args[1] }
}

/**
 * 探す候補(優先順)と、取り込んだファイルの中で使う文脈を返す
 * @param {Include} inc
 * @param {IncludeContext} ctx
 * @returns {{ candidates: string[]; next: IncludeContext }}
 */
export function resolveInclude(inc, ctx) {
  /** @param {string} dir */
  const names = (dir) => [resolve(dir, `${inc.file}.mdx`), resolve(dir, inc.file)]
  if (inc.command === 'input') {
    const dirs = ctx.importDir ? [ctx.importDir, ctx.baseDir] : [ctx.baseDir]
    return { candidates: [...new Set(dirs.flatMap(names))], next: ctx }
  }
  const from = inc.command === 'import' || inc.command === 'inputfrom' ? ctx.baseDir : (ctx.importDir ?? ctx.baseDir)
  const dir = resolve(from, inc.dir ?? '')
  return { candidates: names(dir), next: { baseDir: ctx.baseDir, importDir: dir } }
}

/**
 * 候補のうち最初に存在するファイル
 * @param {string[]} candidates
 * @returns {string | undefined}
 */
export function findInclude(candidates) {
  return candidates.find((c) => existsSync(c) && statSync(c).isFile())
}
