import { describe, expect, it } from 'vitest'
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
    const out = String(await build('\\cite{arnold2012} と \\cite{nakajima2020}\n\n<Bibliography />'))
    expect(out).toContain('csl-entry')
    expect(out).toContain('Arnold VI')
  })

  it('本番(strict)では警告で失敗する', async () => {
    await expect(build('\\cite{nobody}', true)).rejects.toThrow('警告が 1 件')
  })
})
