import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { VFile } from 'vfile'
import { mdxOptions } from './mdx-options.ts'

// 実際のビルドと同じ設定でコンパイルする(MathJax・rehype-citation を含む)
const build = (src: string, strict = false) =>
  compile(new VFile({ path: 'slides.mdx', value: src }), mdxOptions({ bibliography: 'decks/legendre/references.bib', strict }))

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

  it('後ろにある式への参照(前方参照)も MathJax が文書全体を組むときに解決する', async () => {
    const file = await build('先に \\eqref{eq:b}\n\n\\begin{equation}\\label{eq:a}\nx\n\\end{equation}\n\n\\begin{equation}\\label{eq:b}\ny\n\\end{equation}')
    const out = String(file)
    expect(file.messages).toEqual([])
    expect(out).not.toContain('"3F"') // 未解決の参照 ???(U+003F)が無い
    // 参照(最初の別行立て数式より前)は 2 番目の式の番号 (2) を指す。
    // MathJax の SVG は文字を字形の id(TEX-N-<文字コード>)で参照する: "2" = 32、"1" = 31
    const ref = out.slice(out.indexOf('先に'), out.indexOf('display: "true"'))
    expect(ref).toContain('TEX-N-32')
    expect(ref).not.toContain('TEX-N-31')
  })

  it('節番号はビルド時にスライドの題に振る(横が 1.、その下の縦が 1.1.)', async () => {
    const out = String(await build('# 表紙\n\n---\n\n## A\n\n---\n\n## B\n\n--\n\n## B1'))
    const nums = [...out.matchAll(/className: "secnum",\s*children: "([^"]*)"/g)].map((m) => m[1].trim())
    expect(nums).toEqual(['1.', '2.', '2.1.'])
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

  it('GFM の表は表になり、区切りの行の揃えがセルに付く。ほかの GFM の拡張(取り消し線・自動リンク)は入れない', async () => {
    const out = String(await build('| 科目 | 金額 |\n| --- | ---: |\n| 現金 | 1,250 |\n\n~消さない~ と https://example.com'))
    expect(out).toContain('_components.table')
    expect(out).toContain('textAlign: "right"')
    expect(out).not.toContain('_components.del')
    expect(out).not.toContain('href: "https://example.com"')
  })

  it('表の右揃えの列の数字だけのセルに 3 桁ごとのカンマを打つ(見出し・左揃えの列・数字以外を含むセル・本文は変えない)', async () => {
    const src = [
      '| 年 | 項目 | 1000 |',
      '| --- | --- | ---: |',
      '| 2026 | 現金 | 1250 |',
      '| 2027 | 損失 | △12345 |',
      '| 2028 | 利息 | 1250.5 |',
      '| 2029 | 家賃 | 5（6 月） |',
      '| 2030 | 既に | 3,955 |',
      '| 2031 | 小さい | 999 |',
      '',
      '本文の 2064227 は変えない',
    ].join('\n')
    const out = String(await build(src))
    const cells = [...out.matchAll(/children: "([^"]*)"/g)].map((m) => m[1])
    expect(cells).toEqual(expect.arrayContaining(['1000', '2026', '1,250', '△12,345', '1,250.5', '5（6 月）', '3,955', '999']))
    expect(out).not.toContain('2,026')
    expect(out).toContain('2064227')
    // 数値のセル(右揃えの列の数だけのセル。カンマ付きも)にだけ印 num。数字以外を含むセルと見出しには付けない
    const numCells = [...out.matchAll(/className: "num",(?:\s*style: \{[^}]*\},)?\s*children: "([^"]*)"/g)].map((m) => m[1])
    expect(numCells).toEqual(['1,250', '△12,345', '1,250.5', '3,955', '999'])
  })

  it('範囲にまとめた引用([1–4])の番号は、その番号の文献へリンクする', async () => {
    const keys = ['halmos1974', 'rota1997', 'mccarthy', 'higham2020']
    const out = String(
      await compile(
        new VFile({ path: 'slides.mdx', value: `\\cite{${keys.join(',')}}\n\n<Bibliography />` }),
        mdxOptions({ bibliography: 'decks/speech/references.bib', strict: false }),
      ),
    )
    const links = [...out.matchAll(/href: "#bib-(\w+)",\s*children: "(\d+)"/g)].map((m) => `${m[2]}=${m[1]}`)
    expect(links).toEqual(['1=halmos1974', '4=higham2020'])
  })

  it('\\footfullcite は、その文献の書誌(リンクを含む)をスライドの脚注に出す。<Bibliography /> が無ければ文献リストは出さない', async () => {
    const out = String(
      await compile(
        new VFile({ path: 'slides.mdx', value: '## 題\n\n本文\\footfullcite{halmos1974}' }),
        mdxOptions({ bibliography: 'decks/speech/references.bib', strict: true }),
      ),
    )
    expect(out).toContain('"footnotes"')
    expect(out).toContain('How to Talk Mathematics')
    expect(out).toContain('href: "https://doi.org/10.1007/978-1-4613-8211-9_17"')
    expect(out).not.toContain('csl-bib-body')
  })

  it('\\footfullcite の文献は <Bibliography /> にも載る', async () => {
    const out = String(
      await compile(
        new VFile({ path: 'slides.mdx', value: '本文\\footfullcite{halmos1974}\\cite{rota1997}\n\n---\n\n<Bibliography />' }),
        mdxOptions({ bibliography: 'decks/speech/references.bib', strict: true }),
      ),
    )
    // 番号の順は構文木の順(脚注の本文はスライドの下にあるので、本文の \cite より後)
    expect([...out.matchAll(/id: "bib-(\w+)"/g)].map((m) => m[1]).sort()).toEqual(['halmos1974', 'rota1997'])
  })

  it('文献リストの URL と DOI はリンクになる(句点は含めない)', async () => {
    const out = String(
      await compile(
        new VFile({ path: 'slides.mdx', value: '\\cite{halmos1974,mccarthy}\n\n<Bibliography />' }),
        mdxOptions({ bibliography: 'decks/speech/references.bib', strict: false }),
      ),
    )
    expect(out).toContain('href: "https://doi.org/10.1007/978-1-4613-8211-9_17"')
    expect(out).toContain('href: "https://www.math.wustl.edu/~mccarthy/public_papers/colloquium.pdf"')
  })

  it('1 枚に収まらない文献リストは、同じ題に（続き）を付けた縦の続きのスライドへ送る', async () => {
    const keys = ['halmos1974', 'rota1997', 'mccarthy', 'higham2020', 'viray2023', 'kercheval2019', 'devadoss2019', 'lew2016', 'inglis2012', 'hodds2014', 'alcock2015', 'roy2017']
    const src = `# 題\n\n${keys.map((k) => `\\cite{${k}}`).join(' ')}\n\n---\n\n## 参考文献 \\label{sec:refs}\n\n<Bibliography />`
    const out = String(await compile(new VFile({ path: 'slides.mdx', value: src }), mdxOptions({ bibliography: 'decks/speech/references.bib', strict: false })))
    const pages = out.split('（続き）').length - 1
    expect(pages).toBeGreaterThan(0)
    // 全項目が番号の順に 1 回ずつ出る。ラベル(id)は最初の 1 枚だけ
    expect([...out.matchAll(/id: "bib-(\w+)"/g)].map((m) => m[1])).toEqual(keys)
    expect(out.match(/"sec:refs"/g)).toHaveLength(1)
    // 縦の続きとして並ぶ(v が 0, 1, 2, …)
    const vs = [...out.matchAll(/v: "(\d+)"/g)].map((m) => Number(m[1]))
    expect(vs.slice(-(pages + 1))).toEqual([...Array(pages + 1).keys()])

    // 原稿で <small> に包んだ文献リストは、小さい文字で見積もる(枚数が減る)。続きのスライドも <small> に包まれる
    const small = src.replace('<Bibliography />', '<small>\n\n<Bibliography />\n\n</small>')
    const outSmall = String(await compile(new VFile({ path: 'slides.mdx', value: small }), mdxOptions({ bibliography: 'decks/speech/references.bib', strict: false })))
    const pagesSmall = outSmall.split('（続き）').length - 1
    expect(pagesSmall).toBeLessThan(pages)
    expect(outSmall.match(/_components\.small|"small"/g)?.length).toBeGreaterThanOrEqual(pagesSmall + 1)
  })

  it('\\input で取り込んだ JSX も主ファイルに直接書いたときと同じに扱う', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdx-input-'))
    const table = '<table>\n<tbody>\n<tr><td>a</td></tr>\n<tr><td>b</td></tr>\n</tbody>\n</table>\n'
    writeFileSync(join(dir, 'part.mdx'), table)
    const compileAt = async (value: string) => {
      const out = String(
        await compile(new VFile({ path: join(dir, 'main.mdx'), value }), mdxOptions({ bibliography: 'decks/legendre/references.bib', strict: false })),
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
