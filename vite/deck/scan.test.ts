import { describe, expect, it } from 'vitest'
import { splitRows, splitSlides, transformChunk } from './scan'

const BT = '`'
const t = (src: string) => transformChunk(src, 'k')
const errors = (src: string) => t(src).diagnostics.filter((d) => d.level === 'error')

describe('splitSlides', () => {
  it('--- だけの行で分割し、import を全スライドで共有する', () => {
    const src = ["import A from 'a'", '', '## 1', 'x', '---', '## 2', 'y'].join('\n')
    const slides = splitSlides(src)
    expect(slides).toHaveLength(2)
    expect(slides[1].source).toContain("import A from 'a'")
    expect(slides[1].source).toContain('## 2')
  })

  it('区切りが無ければ 1 枚、空のスライドは捨てる', () => {
    expect(splitSlides('## only')).toHaveLength(1)
    expect(splitSlides('---\n## a\n---\n\n---\n')).toHaveLength(1)
  })

  it('コードの中の --- では分割しない', () => {
    const src = ['## a', '```', '---', '```', 'b'].join('\n')
    expect(splitSlides(src)).toHaveLength(1)
  })

  it('各行を元ファイルの行番号に対応づける', () => {
    const src = ["import A from 'a'", '## 1', '---', '## 2', 'z'].join('\n')
    const [, second] = splitSlides(src)
    const zLine = second.source.split('\n').indexOf('z')
    expect(second.lines[zLine]).toBe(5)
  })
})

describe('定理環境', () => {
  it('\\begin{theorem}[名前] を <Theorem title> に変換し、通し番号用の id を付ける', () => {
    const r = t(String.raw`\begin{theorem}[Jensen]
本文
\end{theorem}`)
    expect(r.code).toMatch(/<Theorem refId="k:t0" title="Jensen">/)
    expect(r.code).toContain('</Theorem>')
    expect(r.items).toEqual([{ id: 'k:t0', kind: 'thm', line: 1 }])
  })

  it('proof の [..] は見出し語', () => {
    expect(t('\\begin{proof}[Proof of 1]\nx\n\\end{proof}').code).toContain('<Proof heading="Proof of 1">')
  })

  it('JSX で書いた <Theorem id> も番号と参照先になる', () => {
    expect(t('<Theorem id="thm:a">x</Theorem>').items[0]).toMatchObject({ kind: 'thm', label: 'thm:a' })
  })

  it('閉じ忘れはエラー(補わずに報告する)。行番号は元の原稿', () => {
    const errs = errors('a\n\\begin{theorem}\nx')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatchObject({ line: 2 })
    expect(errs[0].message).toContain('\\end がありません')
  })

  it('対応しない \\end はエラー', () => {
    expect(errors('\\begin{lemma}\nx\n\\end{theorem}\n\\end{lemma}')[0].message).toContain('\\end{theorem}')
  })
})

describe('相互参照と引用', () => {
  it('\\label は直近の環境に付き、\\ref / \\eqref は <Ref> になる', () => {
    const r = t(String.raw`\begin{lemma}\label{lem:a}
x
\end{lemma}
\ref{lem:a} と \eqref{eq:b}`)
    expect(r.items[0].label).toBe('lem:a')
    expect(r.code).toContain('<Ref k="lem:a" />')
    expect(r.code).toContain('<Ref k="eq:b" eq />')
    expect(r.refs.map((x) => x.key)).toEqual(['lem:a', 'eq:b'])
  })

  it('環境の外の \\label はエラー', () => {
    expect(errors('\\label{x}')[0].message).toContain('外にあります')
  })

  it('\\cite は複数 key と頁指定に対応する', () => {
    const r = t('a \\cite{x,y} b \\cite[p.~5]{z}')
    expect(r.code).toContain('<Cite keys="x;y" />')
    expect(r.code).toContain('<Cite keys="z" note="p.\u00a05" />')
    expect(r.cites.map((c) => c.key)).toEqual(['x', 'y', 'z'])
  })

  it('コード・テンプレート文字列の中は変換しない', () => {
    const r = t(`${BT}\\cite{a} \\ref{b}${BT}\n\n<Code>{${BT}\\begin{theorem}\n\\pause${BT}}</Code>`)
    expect(r.cites).toEqual([])
    expect(r.refs).toEqual([])
    expect(r.code).not.toContain('<Theorem')
    expect(r.code).not.toContain('<Overlay')
  })
})

describe('数式', () => {
  it('equation は番号付き、\\label が参照先になる', () => {
    const r = t(String.raw`\begin{equation}\label{eq:a}
x^2
\end{equation}`)
    expect(r.items).toEqual([{ id: 'k:e0', kind: 'eq', label: 'eq:a', line: 1 }])
    expect(r.code).toContain('<Equation env="equation"')
    expect(r.code).not.toContain('\\label')
  })

  it('$$..$$ は \\label があるときだけ番号付き', () => {
    expect(t('$$x \\label{a}$$').items).toHaveLength(1)
    expect(t('$$x$$').items).toHaveLength(0)
  })

  it('align は行ごとに番号。\\nonumber / \\notag / \\tag の行は自動番号なし', () => {
    const r = t(String.raw`\begin{align}
a &= b \label{eq:1} \\
c &= d \nonumber \\
e &= f \notag \\
g &= h \tag{*} \\
i &= j
\end{align}`)
    expect(r.items.map((x) => x.label)).toEqual(['eq:1', undefined])
    expect(errors(String.raw`\begin{align}
a \\ b
\end{align}`)).toEqual([])
  })

  it('align* は番号なし。番号の無い行の \\label はエラー', () => {
    expect(t('\\begin{align*}\na \\\\ b\n\\end{align*}').items).toHaveLength(0)
    expect(errors('\\begin{align*}\na \\label{x}\n\\end{align*}')[0].message).toContain('番号がありません')
  })

  it('数式の誤りは KaTeX で検出してエラーにする', () => {
    expect(errors('a $\\frac{1}{$ b')[0].message).toContain('数式の誤り')
    expect(errors('$\\undefinedmacro$')).toHaveLength(1)
    expect(errors('$$\\int_a^b$$')).toEqual([])
  })

  it('別行立て数式の変換で行数が変わらない', () => {
    const src = 'a\n\\begin{equation}\nx\n\\end{equation}\nb'
    expect(t(src).code.split('\n').indexOf('b')).toBe(4)
  })
})

describe('splitRows', () => {
  it('いちばん外側の \\\\ だけで分ける(cases・\\substack・中括弧の中では分けない)', () => {
    const rows = splitRows(String.raw`f &= \begin{cases} 1 \\ 0 \end{cases} \\
g &= \sum_{\substack{i \\ j}} a \\[4pt]
h`)
    expect(rows).toHaveLength(3)
    expect(rows[0].tex).toContain('\\end{cases}')
    expect(rows[1].sep).toBe('\\\\[4pt]')
    expect(rows[2].sep).toBe('')
  })

  it('% コメントの中の \\\\ は無視する', () => {
    expect(splitRows('a % \\\\ comment\n\\\\ b')).toHaveLength(2)
  })
})

describe('段階表示', () => {
  it('\\pause 以降を次のステップの Overlay で包み、ステップ数の分だけ見えない区切りを置く', () => {
    const r = t('a\n\\pause\nb\n\\pause\nc')
    expect(r.code).toContain('<Overlay from={2}>')
    expect(r.code).toContain('<Overlay from={3}>')
    expect(r.code).toContain('<OverlaySteps max={3} />')
  })

  it('環境の中の \\pause は環境の終わりで閉じる', () => {
    const code = t('\\begin{theorem}\na\n\\pause\nb\n\\end{theorem}\nc').code
    expect(code.indexOf('</Overlay>')).toBeLessThan(code.indexOf('</Theorem>'))
    expect(code.indexOf('c', code.indexOf('</Theorem>'))).toBeGreaterThan(0)
  })

  it('行単独の JSX ブロック(<Col> など)の中の \\pause はその閉じタグの前で閉じる', () => {
    const code = t('<Col>\n\na\n\\pause\nb\n\n</Col>').code
    expect(code.indexOf('</Overlay>')).toBeLessThan(code.indexOf('</Col>'))
  })

  it('箇条書きの <+-> は 1 つずつ次のステップに', () => {
    const code = t('- <+-> a\n- <+-> b\n- <+-> c').code
    expect(code).toContain('<Overlay from={1} as="span" li>a</Overlay>')
    expect(code).toContain('<Overlay from={2} as="span" li>b</Overlay>')
    expect(code).toContain('<OverlaySteps max={3} />')
  })

  it('\\only / \\uncover: 範囲指定、行単独なら段落、文中なら span', () => {
    const r = t('\\only<2>{x}\n\nmid \\uncover<2-3>{y} end\n\n\\visible<4->{z}')
    expect(r.code).toContain('<Overlay from={2} to={2} only>x</Overlay>')
    expect(r.code).toContain('<Overlay from={2} to={3} as="span">y</Overlay>')
    expect(r.code).toContain('<Overlay from={4}>z</Overlay>')
  })

  it('最後のステップ以降で消える指定は外す(存在しないステップを作らない)', () => {
    expect(t('\\uncover<2-3>{y}').code).toContain('<Overlay from={2}>y</Overlay>')
  })

  it('不正な指定はエラー', () => {
    expect(errors('\\only<x>{a}')[0].message).toContain('overlay 指定')
    expect(errors('\\begin{theorem}<x>\na\n\\end{theorem}')).toHaveLength(1)
  })

  it('JSX の <Cite> などの箇条書きは overlay と見なさない', () => {
    expect(t('- <Cite keys="a" /> x').code).not.toContain('<Overlay')
  })
})
