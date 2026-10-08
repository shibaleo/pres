import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkMath from 'remark-math'
import { VFile } from 'vfile'
import type { Root } from 'mdast'
import remarkBeamer, { type BeamerOptions } from './index'

type N = { type: string; name?: string; value?: string; children?: N[]; attributes?: { name: string; value: string | null }[] }

async function run(src: string, options: BeamerOptions = {}) {
  const processor = unified().use(remarkParse).use(remarkMdx).use(remarkMath).use(remarkBeamer, options)
  const file = new VFile(src)
  const tree = (await processor.run(processor.parse(file), file)) as Root
  return { tree: tree as unknown as N, file }
}
async function fails(src: string, options: BeamerOptions = {}) {
  try {
    await run(src, options)
  } catch (e) {
    return e as { message: string; line?: number; place?: { line?: number; start?: { line: number } } }
  }
  throw new Error('エラーになりませんでした')
}
const lineOf = (e: { line?: number; place?: { line?: number; start?: { line: number } } }) =>
  e.line ?? e.place?.start?.line ?? e.place?.line
function all(n: N, pred: (n: N) => boolean, out: N[] = []): N[] {
  if (pred(n)) out.push(n)
  for (const c of n.children ?? []) all(c, pred, out)
  return out
}
const jsx = (n: N, name: string) => all(n, (x) => x.name === name)
const attr = (n: N, name: string) => n.attributes?.find((a) => a.name === name)?.value
const textOf = (n: N): string => (n.value ?? '') + (n.children ?? []).map(textOf).join('')

describe('スライド分割', () => {
  it('--- で横、-- で縦に分け、import は Slide の外に置く', async () => {
    const { tree } = await run(["import A from 'a'", '', '# 1', '', '---', '', '# 2', '', '--', '', '# 3'].join('\n'))
    expect(tree.children!.find((c) => c.type === 'mdxjsEsm' && c.value!.includes("from 'a'"))).toBeTruthy()
    const top = tree.children!.filter((c) => c.name === 'Slide' || c.name === 'Stack')
    expect(top.map((c) => c.name)).toEqual(['Slide', 'Stack'])
    expect(jsx(top[1], 'Slide')).toHaveLength(2)
    expect(attr(top[0], 'data-slide-line')).toBe('3')
  })

  it('*** は区切りにしない(普通の横線)', async () => {
    const { tree } = await run('a\n\n***\n\nb')
    expect(jsx(tree, 'Slide')).toHaveLength(1)
  })
})

describe('定理環境と番号', () => {
  it('\\begin{theorem}[名前] を <Theorem> にし、デッキ全体で通し番号を振る', async () => {
    const { tree } = await run(String.raw`\begin{definition}[凸関数]
a
\end{definition}

---

\begin{theorem}[Jensen $f$]
b
\end{theorem}`)
    expect(jsx(tree, 'Definition').map((n) => attr(n, 'n'))).toEqual(['1'])
    const thm = jsx(tree, 'Theorem')[0]
    expect(attr(thm, 'n')).toBe('2')
    const title = jsx(thm, 'ThmTitle')[0]
    expect(all(title, (n) => n.type === 'inlineMath')).toHaveLength(1)
  })

  it('JSX の <Theorem id> も番号と参照先になる', async () => {
    const { tree } = await run('<Theorem id="thm:a">x</Theorem>\n\n\\ref{thm:a}')
    expect(textOf(tree)).toContain('1')
  })

  it('\\label と \\ref(定理)、\\eqref(式は MathJax に渡す)', async () => {
    const { tree } = await run(String.raw`\begin{lemma}\label{lem:a}
x
\end{lemma}

\begin{equation}\label{eq:b}
y
\end{equation}

\ref{lem:a} と \eqref{eq:b}`)
    expect(textOf(tree)).toContain('1 と ')
    expect(all(tree, (n) => n.type === 'inlineMath' && n.value === '\\eqref{eq:b}')).toHaveLength(1)
    expect(all(tree, (n) => n.type === 'math')[0].value).toContain('\\begin{equation}')
  })

  it('閉じ忘れはエラー(補わない)。位置は原稿の行', async () => {
    const e = await fails('a\n\n\\begin{theorem}\nx')
    expect(e.message).toContain('\\end{theorem} がありません')
    expect(lineOf(e)).toBe(3)
  })

  it('対応しない \\end・未対応の環境・環境の外の \\label はエラー', async () => {
    expect((await fails('\\begin{lemma}\nx\n\\end{theorem}\n\\end{lemma}')).message).toContain('\\end{theorem}')
    expect((await fails('\\begin{itemize}\n\\end{itemize}')).message).toContain('未対応の環境')
    expect((await fails('x \\label{a}')).message).toContain('外にあります')
  })

  it('数式環境の閉じ忘れはエラー', async () => {
    expect((await fails('\\begin{align}\na &= b')).message).toContain('\\end{align}')
  })
})

describe('数式', () => {
  it('地の文の \\begin{align} は中括弧を含んでも数式になる(MDX の式にならない)', async () => {
    const { tree } = await run(String.raw`\begin{align}
f &= \begin{cases} 1 \\ 0 \end{cases} \label{eq:f} \\
g &= h
\end{align}`)
    const math = all(tree, (n) => n.type === 'math')
    expect(math).toHaveLength(1)
    expect(math[0].value).toContain('\\end{align}')
  })
})

describe('引用', () => {
  it('\\cite を rehype-citation の入力([@a; @b])にする。頁指定は locator に', async () => {
    const { tree } = await run('a \\cite{x,y} b \\cite[p.~5]{z}')
    expect(textOf(tree)).toContain('[@x; @y]')
    expect(textOf(tree)).toContain('[@z, p.\u00a05]')
  })

  it('<Bibliography /> は rehype-citation の差し込み位置 [^ref] になる', async () => {
    const { tree } = await run('<Bibliography />')
    expect(textOf(tree)).toContain('[^ref]')
  })
})

describe('警告', () => {
  it('参照先の無い \\ref・未登録の文献は警告。strict ではエラー', async () => {
    const { file, tree } = await run('\\ref{nope} \\cite{nobody}', { bibliography: 'src/references.bib' })
    expect(file.messages.map((m) => m.reason)).toEqual([
      '\\ref{nope} の参照先がありません',
      '文献 "nobody" が src/references.bib に見つかりません',
    ])
    expect(tree.children![0].value).toContain('deckWarnings')
    expect((await fails('\\ref{nope}', { strict: true })).message).toContain('警告が 1 件')
  })
})

describe('段階表示', () => {
  it('\\pause 以降を Overlay にし、ステップ数の分だけ見えない区切りを置く', async () => {
    const { tree } = await run('a\n\n\\pause\n\nb\n\n\\pause\n\nc')
    expect(jsx(tree, 'Overlay').map((o) => attr(o, 'from'))).toEqual(['2', '3'])
    expect(attr(jsx(tree, 'OverlaySteps')[0], 'max')).toBe('3')
  })

  it('環境・JSX ブロックの中の \\pause はそのブロックの中で閉じる', async () => {
    const { tree } = await run('\\begin{theorem}\na\n\n\\pause\n\nb\n\\end{theorem}\n\nc')
    const thm = jsx(tree, 'Theorem')[0]
    expect(jsx(thm, 'Overlay')).toHaveLength(1)
    const col = (await run('<Col>\n\na\n\n\\pause\n\nb\n\n</Col>\n\nc')).tree
    expect(jsx(jsx(col, 'Col')[0], 'Overlay')).toHaveLength(1)
  })

  it('箇条書きの <+-> は 1 つずつ次のステップに', async () => {
    const { tree } = await run('- <+-> a\n- <+-> b\n- <+-> c')
    expect(jsx(tree, 'Overlay').map((o) => attr(o, 'from'))).toEqual(['1', '2', '3'])
    expect(attr(jsx(tree, 'OverlaySteps')[0], 'max')).toBe('3')
  })

  it('\\only / \\uncover: 範囲指定。段落全体なら段落ごと、文中なら span', async () => {
    const { tree } = await run('\\only<2>{x}\n\nmid \\uncover<2-3>{y \\cite{k}} end\n\n\\visible<4->{z}')
    const [only, uncover, visible] = jsx(tree, 'Overlay')
    expect([attr(only, 'from'), attr(only, 'to'), only.attributes!.some((a) => a.name === 'only')]).toEqual(['2', '2', true])
    expect([attr(uncover, 'as'), attr(uncover, 'to')]).toEqual(['span', '3'])
    expect(textOf(uncover)).toContain('[@k]')
    expect(attr(visible, 'from')).toBe('4')
  })

  it('最後のステップ以降で消える指定は外す', async () => {
    const { tree } = await run('\\uncover<2-3>{y}')
    expect(attr(jsx(tree, 'Overlay')[0], 'to')).toBeUndefined()
  })

  it('環境ごとの overlay 指定 \\begin{theorem}<2->', async () => {
    const { tree } = await run('\\begin{theorem}<2->\na\n\\end{theorem}')
    const o = jsx(tree, 'Overlay')[0]
    expect(attr(o, 'from')).toBe('2')
    expect(jsx(o, 'Theorem')).toHaveLength(1)
  })

  it('不正な指定・未対応の命令はエラー', async () => {
    expect((await fails('\\only<x>{a}')).message).toContain('overlay 指定')
    expect((await fails('\\textbf{a}')).message).toContain('未対応の命令')
  })
})

describe('変換しない場所', () => {
  it('インラインコード・コードブロック・数式の中の記法はそのまま', async () => {
    const { tree } = await run('`\\cite{a}`\n\n```\n\\begin{theorem}\n\\pause\n```\n\n$\\label{x}$')
    expect(jsx(tree, 'Theorem')).toHaveLength(0)
    expect(jsx(tree, 'Overlay')).toHaveLength(0)
    expect(textOf(tree)).toContain('\\cite{a}')
  })

  it('<Cite> のような JSX は overlay 指定と見なさない', async () => {
    const { tree } = await run('- <Note>x</Note> y')
    expect(jsx(tree, 'Overlay')).toHaveLength(0)
  })
})
