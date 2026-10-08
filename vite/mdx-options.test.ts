import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { VFile } from 'vfile'
import { mdxOptions } from './mdx-options'

// 実際のビルドと同じ設定でコンパイルする(MathJax・rehype-citation を含む)
const build = (src: string, strict = false) =>
  compile(new VFile({ path: 'slides.mdx', value: src }), mdxOptions({ bibliography: 'src/references.bib', strict }))

async function failure(src: string) {
  try {
    await build(src)
  } catch (e) {
    return e as { message: string; line?: number; place?: { line?: number; start?: { line: number } } }
  }
  throw new Error('エラーになりませんでした')
}
const lineOf = (e: { line?: number; place?: { line?: number; start?: { line: number } } }) =>
  e.line ?? e.place?.start?.line ?? e.place?.line

describe('ビルド設定(結合)', () => {
  it('数式の誤りは MathJax の描画結果から検出し、原稿の行で報告する', async () => {
    const e = await failure('# a\n\nok $x$\n\n壊れた $\\frac{1}{$ 式')
    expect(e.message).toContain('数式の誤り')
    expect(lineOf(e)).toBe(5)
  })

  it('別行立て数式の誤りも同様', async () => {
    const e = await failure('a\n\n\\begin{align}\nx &= \\undefinedmacro\n\\end{align}')
    expect(lineOf(e)).toBe(3)
  })

  it('\\eqref は MathJax が式番号に解決する(スライドをまたいでも可)', async () => {
    const out = String(await build('\\begin{equation}\\label{eq:a}\nx\n\\end{equation}\n\n---\n\n後で \\eqref{eq:a}'))
    expect(out).not.toContain('"3F"') // MathJax の未解決参照 ??? が無い
  })

  it('後ろにある式への参照(前方参照)は rehype-mathjax の制約で解決できないので警告する', async () => {
    const file = await build('先に \\eqref{eq:a}\n\n\\begin{equation}\\label{eq:a}\nx\n\\end{equation}')
    expect(file.messages.map((m) => m.reason).join()).toContain('後ろにある式への参照')
  })

  it('\\cite は rehype-citation が番号付けし、文献リストを差し込む', async () => {
    const out = String(await build('\\cite{arnold2012} と \\cite{nakajima2020,arnold2012}\n\n<Bibliography />'))
    expect(out).toContain('csl-entry')
    expect(out).toContain('Arnold VI')
    // 角括弧版の CSL: [1] / [1,2]。複数文献の引用でも各番号のリンク先が正しい
    expect(out).toContain('"["')
    expect(out).toContain('href: "#bib-arnold2012",\n')
    const links = [...out.matchAll(/href: "#bib-(\w+)",\s*children: "(\d)"/g)].map((m) => `${m[1]}=${m[2]}`)
    expect(links).toEqual(['arnold2012=1', 'arnold2012=1', 'nakajima2020=2'])
  })

  it('\\input で取り込んだ JSX も主ファイルに直接書いたときと同じに扱う', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdx-input-'))
    const table = '<table>\n<tbody>\n<tr><td>a</td></tr>\n<tr><td>b</td></tr>\n</tbody>\n</table>\n'
    writeFileSync(join(dir, 'part.mdx'), table)
    const compileAt = async (value: string) => {
      const out = String(
        await compile(new VFile({ path: join(dir, 'main.mdx'), value }), mdxOptions({ bibliography: 'src/references.bib', strict: false })),
      )
      return out.slice(out.indexOf('function _createMdxContent'))
    }
    const included = await compileAt('\\input{part}')
    // 行ごとの JSX を <p> で包まない。明示的に書いた JSX(<table> など)は components の差し替えを受けない(MDX の規則)
    expect(included).not.toContain('_components.p')
    expect(included).toMatch(/_jsxs?\("table"/)
    // 違いは取り込んだスライドに付く出典(data-slide-file)だけ
    expect(included.replace(/\s*"data-slide-file": "part\.mdx",/, '')).toBe(await compileAt(table))
  })

  it('本番(strict)では警告で失敗する', async () => {
    await expect(build('\\cite{nobody}', true)).rejects.toThrow('警告が 1 件')
  })
})
