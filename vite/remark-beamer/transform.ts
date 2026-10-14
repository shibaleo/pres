/**
 * Beamer / LaTeX 風記法の意味づけ(mdast → mdast)。構文は syntax.ts / mdast.ts が切り出している。
 *
 *  1. スライド分割   `---`(横)/ `--`(縦)で <Slide> / <Stack> に包む
 *  2. 環境           \begin{theorem}[名前] … \end{theorem} を <Theorem> に、\pause 以降を <Overlay> に
 *  3. 番号付け       スライドの題に節番号、定理型の環境にデッキ全体の通し番号。式の番号は MathJax(tags: 'ams')に任せる
 *  4. 文中の命令     \ref \eqref \label \cite \only \uncover …
 *  5. 段階表示       Beamer の overlay 指定と <Fragment> を <Overlay from to> に。スライドの段の数(<Slide steps>)は Beamer と揃える
 *
 * 引用は rehype-citation の入力形式([@a; @b])に変換して、番号付け・整形はそちらに任せる。
 * エラーは file.fail、警告は file.message(unified の標準)。位置は構文解析器が付けた元の行。
 */
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { parse as parseJs } from 'acorn'
import { VFile as VFileCtor } from 'vfile'
import type { Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'
import type { InlineMath } from 'mdast-util-math'
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { Program } from 'estree'
import type { Processor } from 'unified'
import type { VFile } from 'vfile'
import type { Point, Position } from 'unist'
import { MATH_ENVS } from './syntax.ts'
import { findInclude, parseInclude, resolveInclude, type IncludeContext } from './inputs.js'
import type { LatexCommand, LatexLine } from './mdast.ts'

export type BeamerOptions = {
  /**
   * \cite の key を確認する BibTeX ファイル(未登録の key を警告する)。関数なら変換する主ファイルのパスから決める
   * (1 つの処理系で複数の文書を変換し、文書ごとに文献ファイルが違うとき。undefined なら文献ファイルは無い)
   */
  bibliography?: string | ((file: string) => string | undefined)
  /** 警告もエラーとして扱う(本番ビルド用) */
  strict?: boolean
}

/**
 * 定理型の環境。tag は変換先の部品、heading は見出しの語(無ければ部品の既定の英語)、counter は番号を共有する
 * 環境の名前、within は番号を節ごとにするか(\newtheorem の末尾の [section] / [subsection])、numbered は番号の有無
 * (\newtheorem* なら無し)
 */
type TheoremEnv = { tag: string; heading?: string; counter: string; within?: 'section' | 'subsection'; numbered: boolean }
/**
 * 既定の定理型の環境。amsthm で \newtheorem{theorem}{Theorem}、\newtheorem{lemma}[theorem]{Lemma} …… と
 * 宣言したのと同じ(5 つの環境が 1 本の通し番号を共有する)。原稿の \newtheorem で宣言した環境はこれより優先する
 */
const DEFAULT_THEOREMS: Record<string, TheoremEnv> = {
  theorem: { tag: 'Theorem', counter: 'theorem', numbered: true },
  lemma: { tag: 'Lemma', counter: 'theorem', numbered: true },
  proposition: { tag: 'Proposition', counter: 'theorem', numbered: true },
  corollary: { tag: 'Corollary', counter: 'theorem', numbered: true },
  definition: { tag: 'Definition', counter: 'theorem', numbered: true },
}
/** JSX で直接書いた部品(<Theorem> など)の環境の名前 */
const TAG_ENV: Record<string, string> = Object.fromEntries(Object.entries(DEFAULT_THEOREMS).map(([env, t]) => [t.tag, env]))
const OVERLAY_COMMANDS = new Set(['only', 'uncover', 'visible', 'onslide'])

type Jsx = MdxJsxFlowElement | MdxJsxTextElement
type BeamerData = { pause?: boolean; spec?: string; label?: string; env?: string }
type AnyNode = RootContent | PhrasingContent | Root

// ---------- 小道具 ----------

function attrs(values: Record<string, string | number | true | undefined>): MdxJsxAttribute[] {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([name, v]) => ({ type: 'mdxJsxAttribute', name, value: v === true ? null : String(v) }))
}
function jsxFlow(name: string, a: Record<string, string | number | true | undefined>, children: RootContent[], position?: Position): MdxJsxFlowElement {
  return { type: 'mdxJsxFlowElement', name, attributes: attrs(a), children: children as MdxJsxFlowElement['children'], position }
}
function jsxText(name: string, a: Record<string, string | number | true | undefined>, children: PhrasingContent[], position?: Position): MdxJsxTextElement {
  return { type: 'mdxJsxTextElement', name, attributes: attrs(a), children, position }
}
function setAttr(node: Jsx, name: string, value: string | number | undefined) {
  node.attributes = node.attributes.filter((a) => a.type !== 'mdxJsxAttribute' || a.name !== name)
  if (value !== undefined) node.attributes.push({ type: 'mdxJsxAttribute', name, value: String(value) })
}
function getAttr(node: Jsx, name: string): string | undefined {
  const a = node.attributes.find((x) => x.type === 'mdxJsxAttribute' && x.name === name)
  return a && typeof a.value === 'string' ? a.value : undefined
}
const isJsx = (n: AnyNode, name?: string): n is Jsx =>
  (n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement') && (name === undefined || n.name === name)
const beamer = (n: { data?: object }) => (n.data as { beamer?: BeamerData } | undefined)?.beamer
/** remark-math と同じ形のインライン数式(MathJax が描く) */
function inlineMath(value: string, position?: Position): InlineMath {
  return {
    type: 'inlineMath',
    value,
    position,
    data: { hName: 'code', hProperties: { className: ['language-math', 'math-inline'] }, hChildren: [{ type: 'text', value }] },
  }
}
const text = (value: string, position?: Position): Text => ({ type: 'text', value, position })

/** \input で取り込んだノードの出どころ。input は主ファイルでの \input の位置 */
type Source = { file: string; input?: Position }
const sourceOf = (n?: { data?: object }) => (n?.data as { beamerSource?: Source } | undefined)?.beamerSource
/** 取り込んだ木の全ノードに出どころを記録する。数式は MathJax のエラー報告用に hast の属性にも残す */
function markSource(node: AnyNode, src: Source) {
  node.data = { ...node.data, beamerSource: src } as unknown as typeof node.data
  if (node.type === 'math' || node.type === 'inlineMath') {
    const label = `${src.file}:${node.position?.start.line ?? '?'}`
    const d = node.data as { hProperties?: Record<string, unknown>; hChildren?: { properties?: Record<string, unknown> }[] }
    if (node.type === 'inlineMath') d.hProperties = { ...d.hProperties, dataBeamerSource: label }
    else if (d.hChildren?.[0]) d.hChildren[0].properties = { ...d.hChildren[0].properties, dataBeamerSource: label }
    node.position = src.input
  }
  if ('children' in node) for (const c of node.children) markSource(c as AnyNode, src)
}
/** 生成したノードに、元になったノードの出どころを引き継ぐ */
function inherit<T extends { data?: object }>(to: T, from?: { data?: object }): T {
  const src = sourceOf(from)
  if (src) to.data = { ...to.data, beamerSource: src } as T['data']
  return to
}

/** BibTeX の key 一覧(`@book{key,` の key) */
function readBibKeys(path: string): Set<string> {
  return new Set([...readFileSync(path, 'utf8').matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)].map((m) => m[1]))
}

// ---------- overlay 指定 ----------

const SPEC_RE = /^(\+|\d+)?(-)?(\d+)?$/
class Steps {
  cur = 1
  max = 1
  parse(spec: string): { from: number; to?: number } | null {
    const m = spec.match(SPEC_RE)
    if (!m || (!m[1] && !m[3])) return null
    const from = m[1] === '+' ? this.cur++ : m[1] ? Number(m[1]) : 1
    const to = m[3] ? Number(m[3]) : m[2] ? undefined : from
    this.max = Math.max(this.max, from, to ?? 0)
    return { from, to }
  }
  pause(): number {
    this.cur += 1
    this.max = Math.max(this.max, this.cur)
    return this.cur
  }
}

// ---------- 行・命令の解析 ----------

type Line =
  | { kind: 'begin'; name: string; spec?: string; opt?: string; label?: string }
  | { kind: 'end'; name: string }
  | { kind: 'pause' }
  | { kind: 'newtheorem'; star: boolean; name: string; shared?: string; heading: string; within?: string }
function parseLine(raw: string): Line {
  const s = raw.trim()
  if (s === '\\pause') return { kind: 'pause' }
  // amsthm: \newtheorem{名前}[番号を共有する環境]{見出し} / \newtheorem{名前}{見出し}[section] / \newtheorem*{名前}{見出し}
  const nt = s.match(/^\\newtheorem(\*?)\{([^}]*)\}(?:\[([^\]]*)\])?\{([^}]*)\}(?:\[([^\]]*)\])?$/)
  if (nt) return { kind: 'newtheorem', star: nt[1] === '*', name: nt[2].trim(), shared: nt[3]?.trim(), heading: nt[4].trim(), within: nt[5]?.trim() }
  const end = s.match(/^\\end\{([A-Za-z]+\*?)\}$/)
  if (end) return { kind: 'end', name: end[1] }
  const b = s.match(/^\\begin\{([A-Za-z]+\*?)\}(?:<([^>]*)>)?(?:\[([^\]]*)\])?\s*(?:\\label\{([^}]*)\})?$/)!
  return { kind: 'begin', name: b[1], spec: b[2], opt: b[3], label: b[4]?.trim() }
}
function parseCommand(raw: string) {
  const m = raw.match(/^\\([A-Za-z]+)(?:<([^>]*)>)?(?:\[([^\]]*)\])?\{([\s\S]*)\}$/)!
  return { name: m[1], spec: m[2], opt: m[3], body: m[4] }
}

// ---------- 本体 ----------

export function beamerTransform(this: Processor, options: BeamerOptions = {}) {
  const processor = this
  // @mdx-js/mdx は解析の直後に remark-mark-and-unravel を通す(JSX だけの段落を外し、明示的に書いた JSX に印を付ける)。
  // \input で取り込むファイルはその後(このプラグインの中)で解析するので、主ファイルと同じ変換をここで通す
  // (通さないと <tr> などの行が <p> に包まれる)。@mdx-js/mdx はこのプラグインを公開していないので、
  // 処理系に登録済みのものを使う。登録されていない(MDX を通さない)ときは主ファイルにもかかっていないので通さない
  const unravelAttacher = processor.attachers.find(([plugin]) => plugin.name === 'remarkMarkAndUnravel')
  const unravel = unravelAttacher
    ? (unravelAttacher[0].call(processor, ...unravelAttacher.slice(1)) as unknown as (tree: Root) => void)
    : () => {}

  return function (tree: Root, file: VFile) {
    // 文献ファイルは変換のたびに読む(開発中に .bib を書き換えても、読み直した原稿に反映されるように)
    const bibliography = typeof options.bibliography === 'function' ? options.bibliography(file.path) : options.bibliography
    const bibKeys = bibliography ? readBibKeys(bibliography) : null
    // 定理型の環境(既定 + 原稿の \newtheorem)。宣言した環境と、使った環境(宣言より前の使用を誤りにするため)
    const theorems: Record<string, TheoremEnv> = { ...DEFAULT_THEOREMS }
    const declared = new Set<string>()
    const used = new Set<string>()
    // 文書ごとに決める指定で、この文書には文献ファイルが無い(\cite を書くと文献を引けない)
    const noBibliography = typeof options.bibliography === 'function' && !bibliography
    // 診断。\input で取り込んだファイルのノードは「ファイル:行」をメッセージに含め、
    // 位置(place)は主ファイルの \input の行にする(VFile は主ファイルのものなので)
    // raw: ファイル名なしのメッセージ(開発時の一覧で使う)
    type Diag = { message: string; raw: string; place?: Position | Point; file?: string; line?: number }
    const errors: Diag[] = []
    const warnings: Diag[] = []
    const diag = (message: string, node?: { position?: Position; data?: object }): Diag => {
      const src = sourceOf(node)
      if (!src) return { message, raw: message, place: node?.position, line: node?.position?.start.line }
      const line = node?.position?.start.line
      return { message: `${src.file}:${line ?? '?'}: ${message}`, raw: message, place: src.input, file: src.file, line }
    }
    const error = (message: string, node?: { position?: Position; data?: object }) => errors.push(diag(message, node))
    const warn = (message: string, node?: { position?: Position; data?: object }) => warnings.push(diag(message, node))

    // (0) ファイルの取り込み(\input、import パッケージの \import / \subimport)。取り込むファイルを
    //     構文解析して、その場に差し込む(1 つの文書として番号を通す)。パスの規則は inputs.ts(LaTeX と同じ)
    const mainPath = file.path ? resolve(file.path) : undefined
    const baseDir = mainPath ? dirname(mainPath) : process.cwd()
    const texts = new Map<string | undefined, string>([[undefined, String(file.value)]])
    const rel = (abs: string) => relative(baseDir, abs).split(sep).join('/')
    tree.children = expandInputs(tree.children, mainPath ? [mainPath] : [], { baseDir })

    function expandInputs(children: RootContent[], chain: string[], ctx: IncludeContext, via?: Position): RootContent[] {
      const out: RootContent[] = []
      for (const child of children) {
        if ('children' in child && (child.type === 'mdxJsxFlowElement' || child.type === 'blockquote' || child.type === 'listItem' || child.type === 'list')) {
          ;(child as Parent).children = expandInputs((child as Parent).children as RootContent[], chain, ctx, via) as Parent['children']
        }
        const inc = child.type === 'latexLine' ? parseInclude(child.value) : null
        if (!inc) {
          out.push(child)
          continue
        }
        const written = (child as LatexLine).value.trim()
        if ('error' in inc) {
          error(inc.error, child)
          continue
        }
        const { candidates, next } = resolveInclude(inc, ctx)
        const abs = findInclude(candidates)
        if (!abs) {
          error(`${written}: ファイルがありません(探した場所: ${candidates.map(rel).join(' , ')})`, child)
          continue
        }
        if (chain.includes(abs)) {
          error(`${written} が循環しています(${[...chain, abs].map(rel).join(' → ')})`, child)
          continue
        }
        const value = readFileSync(abs, 'utf8')
        const at = via ?? child.position // 主ファイルでの位置(入れ子の \input でも一番外側)
        let sub: Root
        try {
          sub = processor.parse(new VFileCtor({ path: abs, value })) as Root
          unravel(sub)
        } catch (e) {
          const err = e as { reason?: string; message: string; line?: number }
          const where = { position: child.position, data: child.data }
          error(`${rel(abs)}:${err.line ?? '?'}: MDX の構文エラー: ${err.reason ?? err.message}`, where)
          continue
        }
        texts.set(rel(abs), value)
        markSource(sub, { file: rel(abs), input: at })
        out.push(...expandInputs(sub.children, [...chain, abs], next, at))
      }
      return out
    }

    // (1) スライド分割。import / export は Slide の外(文書の先頭)に残す(取り込んだファイルの同じ import は 1 つに)
    const esm: RootContent[] = []
    const stacks: RootContent[][][] = [[[]]]
    const isSeparator = (n: RootContent, sep: string) => {
      const text = texts.get(sourceOf(n)?.file)
      return n.position?.start.offset !== undefined && text?.slice(n.position.start.offset, n.position.end.offset).trim() === sep
    }
    for (const node of tree.children) {
      if (node.type === 'mdxjsEsm') {
        if (!esm.some((e) => e.type === 'mdxjsEsm' && e.value === node.value)) esm.push(node)
      }
      else if (node.type === 'thematicBreak' && isSeparator(node, '---')) stacks.push([[]])
      else if (node.type === 'paragraph' && isSeparator(node, '--')) stacks[stacks.length - 1].push([])
      else stacks[stacks.length - 1][stacks[stacks.length - 1].length - 1].push(node)
    }
    const slides = stacks.map((s) => s.filter((nodes) => nodes.length > 0)).filter((s) => s.length > 0)

    // (2) 環境と \pause を構造にする(スライドごと)
    const built = slides.map((stack) => stack.map((nodes) => buildEnvs(nodes)))

    function buildEnvs(children: RootContent[]): RootContent[] {
      type Frame = { kind: 'root' | 'env' | 'pause'; node?: MdxJsxFlowElement; name?: string; items: RootContent[]; head?: RootContent[] }
      const stack: Frame[] = [{ kind: 'root', items: [] }]
      const top = () => stack[stack.length - 1]
      const finish = (f: Frame) => {
        f.node!.children = [...(f.head ?? []), ...f.items] as MdxJsxFlowElement['children']
        const spec = beamer(f.node!)?.spec
        // \begin{theorem}<2-> は環境ごと Overlay で包む
        const out: RootContent = spec !== undefined ? overlayFlow({ spec }, [f.node!], f.node!.position) : f.node!
        top().items.push(out)
      }
      const closePauses = () => {
        while (top().kind === 'pause') finish(stack.pop()!)
      }
      for (const child of children) {
        if ('children' in child && (child.type === 'mdxJsxFlowElement' || child.type === 'blockquote' || child.type === 'listItem' || child.type === 'list')) {
          ;(child as Parent).children = buildEnvs((child as Parent).children as RootContent[]) as Parent['children']
        }
        if (child.type !== 'latexLine') {
          top().items.push(child)
          continue
        }
        const line = parseLine((child as LatexLine).value)
        if (line.kind === 'pause') {
          stack.push({ kind: 'pause', node: inherit(overlayFlow({ pause: true }, [], child.position), child), items: [] })
        } else if (line.kind === 'newtheorem') {
          declareTheorem(line, child)
        } else if (line.kind === 'begin') {
          const env = theorems[line.name]
          const tag = env?.tag ?? (line.name === 'proof' ? 'Proof' : undefined)
          if (!tag) {
            error(`未対応の環境 \\begin{${line.name}} です(使えるのは ${[...Object.keys(theorems), 'proof'].join(', ')} と数式環境。定理型の環境は \\newtheorem で足せる)`, child)
            continue
          }
          used.add(line.name)
          // 見出しの語: 証明は [ ] の中身(LaTeX の \begin{proof}[…] と同じ)、定理型は \newtheorem の見出し
          const el = jsxFlow(tag, tag === 'Proof' ? { heading: line.opt } : { heading: env?.heading }, [], child.position)
          el.data = { beamer: { spec: line.spec, label: line.label, env: line.name } } as object
          inherit(el, child)
          const head = line.opt && tag !== 'Proof' ? [titleElement(line.opt, child.position)] : []
          stack.push({ kind: 'env', node: el, name: line.name, items: [], head })
        } else {
          closePauses()
          const f = top()
          if (f.kind !== 'env' || f.name !== line.name) {
            const open = f.kind === 'env' ? `(開いているのは ${f.node!.position?.start.line} 行目の \\begin{${f.name}})` : ''
            error(`\\end{${line.name}} に対応する \\begin{${line.name}} がありません${open}`, child)
            continue
          }
          stack.pop()
          finish(f)
        }
      }
      for (;;) {
        closePauses()
        if (stack.length === 1) break
        const f = stack.pop()!
        error(`\\begin{${f.name}} に対応する \\end{${f.name}} がありません`, f.node)
        finish(f)
      }
      return stack[0].items
    }

    /**
     * 定理型の環境の宣言(amsthm の \newtheorem と同じ)。
     *   \newtheorem{名前}{見出し}            その環境だけの通し番号
     *   \newtheorem{名前}[共有する環境]{見出し}  共有する環境と同じ番号の並び
     *   \newtheorem{名前}{見出し}[section]    節ごとの番号(節.番号。節はスライドの題の番号。subsection なら 節.小節.番号)
     *   \newtheorem*{名前}{見出し}           番号なし
     * LaTeX と同じく、宣言はその環境を使う前に書く。既定の環境(theorem など)は宣言し直せる
     */
    function declareTheorem(line: Extract<Line, { kind: 'newtheorem' }>, node: RootContent) {
      const { name, shared, heading, within, star } = line
      const where = `\\newtheorem${star ? '*' : ''}{${name}}`
      if (!/^[A-Za-z]+$/.test(name)) return error(`${where} の環境の名前は英字で書いてください`, node)
      if (name === 'proof') return error(`${where}: proof は証明の環境なので宣言し直せません`, node)
      if (declared.has(name)) return error(`${where} が 2 回宣言されています`, node)
      if (used.has(name)) return error(`${where} は環境を使う前に書いてください(LaTeX と同じく、宣言より前の \\begin{${name}} は使えません)`, node)
      if (star && (shared || within)) return error(`${where}: 番号の無い環境(*)には [ ] を付けられません`, node)
      if (shared && within) return error(`${where}: 番号を共有する環境 [${shared}] と節ごとの番号 [${within}] は同時に指定できません(amsthm と同じ)`, node)
      if (within && within !== 'section' && within !== 'subsection') {
        return error(`${where}: 番号を区切る単位は section か subsection です([${within}] は使えません)`, node)
      }
      const base = shared ? theorems[shared] : undefined
      if (shared && !base) return error(`${where}: 番号を共有する環境 [${shared}] がありません(先に宣言してください)`, node)
      declared.add(name)
      theorems[name] = {
        // 既定の環境は部品(見た目の区別: 定義は thm-def)を保ち、新しい環境は Theorem で描く
        tag: DEFAULT_THEOREMS[name]?.tag ?? 'Theorem',
        heading,
        counter: base ? base.counter : name,
        // 節ごとかどうかは番号の持ち主(counter の環境)が決める。共有する環境はそれに従う
        within: within as TheoremEnv['within'],
        numbered: !star,
      }
    }

    /** \begin{theorem}[名前] の名前。数式などを含められるよう Markdown として解析する */
    function titleElement(title: string, position?: Position): MdxJsxFlowElement {
      const parsed = processor.parse(title) as Root
      const first = parsed.children[0]
      const phrasing = first && first.type === 'paragraph' ? first.children : [text(title)]
      setPosition(phrasing, position)
      return jsxFlow('ThmTitle', {}, phrasing as unknown as RootContent[], position)
    }

    function overlayFlow(b: BeamerData, children: RootContent[], position?: Position): MdxJsxFlowElement {
      const el = jsxFlow('Overlay', {}, children, position)
      el.data = { beamer: b } as object
      return el
    }

    // (3) 番号付け(デッキ全体・文書順)。節番号、定理型の環境と \label、数式中の \label を集める
    //
    // 節番号: スライドの題(先頭の ## 見出し)に振る。横のスライドが節(4.)、縦のスライドの 2 枚目以降が
    // その小節(4.1.)。LaTeX の \section / \subsection と同じく番号を見出しの文字に含める
    // (ビルド時に決まるので、ブラウザで全スライドを描いて数える必要がない。メニューも同じ番号を出せる)
    let sec = 0
    /** 各スライドの節と小節の番号(定理型の環境の節ごとの番号に使う。題の無いスライドは直前の番号のまま) */
    const sectionOf = built.map((stack) => {
      let sub = 0
      return stack.map((nodes, v) => {
        const first = nodes.find((n) => n.type !== 'mdxFlowExpression') // 先頭の {/* コメント */} は飛ばす
        if (first?.type === 'heading' && first.depth === 2) {
          const number = v === 0 ? `${++sec}.` : `${sec}.${++sub}.`
          first.children.unshift(jsxText('span', { className: 'secnum' }, [text(`${number} `)], first.position))
        }
        return { sec, sub }
      })
    })

    type Label = { kind: 'thm' | 'eq'; n?: string }
    /** 文献 key の初出順(\cite を文書順に処理しながら記録する) */
    const citeOrder = new Map<string, number>()
    const labels = new Map<string, Label>()
    const addLabel = (key: string, value: Label, node: { position?: Position }) => {
      if (labels.has(key)) warn(`\\label{${key}} が重複しています`, node)
      labels.set(key, value)
    }
    /** 番号の並び(counter の環境の名前)ごとの、今の区切り(節ごとの番号の節)と番号 */
    const counters = new Map<string, { scope: string; n: number }>()
    let place = { sec: 0, sub: 0 }
    const numberWalk = (node: AnyNode, envs: Jsx[]) => {
      let inner = envs
      // 定理型の環境: \begin から作ったもの(環境の名前を持つ)と、JSX で直接書いた <Theorem> など
      const envName = (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name
        ? (beamer(node)?.env ?? TAG_ENV[node.name])
        : undefined
      const env = envName ? theorems[envName] : undefined
      if (env && (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement')) {
        // JSX で直接書いたものにも \newtheorem の見出しを当てる(heading 属性を書いていればそちら)
        if (env.heading && getAttr(node, 'heading') === undefined) setAttr(node, 'heading', env.heading)
        let n = ''
        if (env.numbered) {
          const within = theorems[env.counter]?.within
          const scope = within === 'section' ? `${place.sec}` : within === 'subsection' ? `${place.sec}.${place.sub}` : ''
          const c = counters.get(env.counter)
          const next = c && c.scope === scope ? c.n + 1 : 1
          counters.set(env.counter, { scope, n: next })
          n = scope ? `${scope}.${next}` : `${next}`
        }
        setAttr(node, 'n', n)
        const label = beamer(node)?.label ?? getAttr(node, 'id')
        if (label) {
          if (n) addLabel(label, { kind: 'thm', n }, node)
          else warn(`番号の無い環境(${envName})に \\label{${label}} が付いています`, node)
        }
        inner = [...envs, node]
      }
      if (node.type === 'latexCommand' && parseCommand((node as LatexCommand).value).name === 'label') {
        const key = parseCommand((node as LatexCommand).value).body.trim()
        const env = inner[inner.length - 1]
        if (env) addLabel(key, { kind: 'thm', n: getAttr(env, 'n') }, node)
        else error(`\\label{${key}} が定理環境・数式の外にあります`, node)
      }
      if (node.type === 'math' || node.type === 'inlineMath') {
        for (const m of node.value.matchAll(/\\label\{([^}]+)\}/g)) addLabel(m[1].trim(), { kind: 'eq' }, node)
        // \begin{align} などの閉じ忘れ(構文上は数式の終わりまで取り込まれている)
        const env = node.value.match(/^\\begin\{([A-Za-z]+\*?)\}/)?.[1]
        if (env && MATH_ENVS.includes(env.replace(/\*$/, '')) && !node.value.includes(`\\end{${env}}`)) {
          error(`\\begin{${env}} に対応する \\end{${env}} がありません`, node)
        }
      }
      if ('children' in node) for (const c of node.children) numberWalk(c as AnyNode, inner)
    }
    built.forEach((stack, h) =>
      stack.forEach((nodes, v) => {
        place = sectionOf[h][v]
        for (const n of nodes) numberWalk(n, [])
      }),
    )

    // (4)(5) 文中の命令と段階表示(スライドごと・文書順)
    const slideElements: RootContent[] = built.map((stack, h) => {
      const els = stack.map((nodes, v) => {
        const steps = new Steps()
        const overlays: Jsx[] = []
        const root = { type: 'root', children: nodes } as Root
        transformChildren(root, steps, overlays)
        // to が最後のステップ以降なら「消える」ステップは存在しないので外す
        for (const o of overlays) {
          const to = getAttr(o, 'to')
          if (to !== undefined && Number(to) >= steps.max) setAttr(o, 'to', undefined)
        }
        const line = nodes[0]?.position?.start.line
        // h・v はスライドの並び(横の位置と、縦の続き(--)の中の位置。モードがスライドを置く場所を決めるのに使う)、
        // steps は段の数(Beamer と同じ数え方。段階表示の無いスライドは 1)。
        // data-slide-line / data-slide-file は開発時のはみ出し警告で原稿の位置を示すため(\input で取り込んだスライドはそのファイル)
        return jsxFlow(
          'Slide',
          { h, v, steps: steps.max, 'data-slide-line': line, 'data-slide-file': sourceOf(nodes[0])?.file },
          root.children,
          nodes[0]?.position,
        )
      })
      return els.length === 1 ? els[0] : jsxFlow('Stack', {}, els)
    })

    function transformChildren(parent: Parent, steps: Steps, overlays: Jsx[]) {
      const out: AnyNode[] = []
      for (const child of parent.children as AnyNode[]) out.push(...transformNode(child, steps, overlays))
      parent.children = out as Parent['children']
    }

    function transformNode(node: AnyNode, steps: Steps, overlays: Jsx[]): AnyNode[] {
      // Overlay(\pause・環境の overlay 指定): 文書順にステップを割り当てる
      if (isJsx(node, 'Overlay') && beamer(node)) {
        const b = beamer(node)!
        if (b.pause) setAttr(node, 'from', steps.pause())
        else applySpec(node, b.spec!, steps, node)
        overlays.push(node)
      }
      // <Fragment>(JSX の段階表示): \pause と同じく段を 1 つ進め、その段から中身を見せる(\pause と違い、後ろの本文は隠さない)。
      // どのモードでも同じに出るよう、\pause などと同じ <Overlay> にする
      // (isJsx は型の判定なので、ここで使うと後ろの判定で JSX が除かれてしまう。type と name で直に見る)
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Fragment') {
        const extra = node.attributes.filter((a) => a.type !== 'mdxJsxAttribute' || a.name !== 'as')
        if (extra.length) error('<Fragment> に書けるのは as だけです(現れる段は書いた順に決まります)', node)
        node.name = 'Overlay'
        if (node.type === 'mdxJsxTextElement' && getAttr(node, 'as') === undefined) setAttr(node, 'as', 'span')
        setAttr(node, 'from', steps.pause())
        overlays.push(node)
        transformChildren(node as Parent, steps, overlays)
        return [node]
      }
      // <Bibliography /> → rehype-citation が文献リストを差し込む印
      if (isJsx(node, 'Bibliography')) {
        return [{ type: 'paragraph', children: [text('[^ref]')], position: node.position }]
      }
      // 段落が overlay 命令 1 つだけなら、段落ごと(ブロックとして)包む
      if (node.type === 'paragraph') {
        const meaningful = node.children.filter((c) => !(c.type === 'text' && c.value.trim() === ''))
        const only = meaningful[0]
        if (meaningful.length === 1 && only.type === 'latexCommand' && OVERLAY_COMMANDS.has(parseCommand(only.value).name)) {
          const el = overlayCommand(only, steps, overlays, false)
          const flow = jsxFlow('Overlay', {}, [{ type: 'paragraph', children: el.children, position: node.position } as Paragraph], node.position)
          flow.attributes = el.attributes
          overlays.push(flow)
          return [flow]
        }
      }
      if (node.type === 'latexCommand') return replaceCommand(node, steps, overlays)
      if (node.type === 'latexLine') return [] // buildEnvs で処理済み(エラー報告済みのもの)
      if ('children' in node) transformChildren(node as Parent, steps, overlays)
      return [node]
    }

    function applySpec(el: Jsx, spec: string, steps: Steps, at: { position?: Position }) {
      const s = steps.parse(spec)
      if (!s) {
        error(`overlay 指定 <${spec}> を解釈できません(例: <2-> <2> <2-3> <-3> <+->)`, at)
        return
      }
      setAttr(el, 'from', s.from)
      setAttr(el, 'to', s.to)
    }

    /** \only<2>{…} など。呼び出し側が overlays に登録する */
    function overlayCommand(node: LatexCommand, steps: Steps, overlays: Jsx[], inline: boolean): MdxJsxTextElement {
      const cmd = parseCommand(node.value)
      const el = jsxText('Overlay', { as: inline ? 'span' : undefined, only: cmd.name === 'only' ? true : undefined }, [], node.position)
      applySpec(el, cmd.spec ?? '', steps, node)
      // 中身を Markdown として解析し、入れ子の命令も変換する
      const parsed = processor.parse(cmd.body) as Root
      const first = parsed.children[0]
      const holder = { type: 'paragraph', children: first?.type === 'paragraph' ? first.children : [] } as Paragraph
      setPosition(holder.children, node.position)
      transformChildren(holder, steps, overlays)
      el.children = holder.children
      return el
    }

    /**
     * 式の参照は数式の中の \ref / \eqref として MathJax に解決させる。後ろにある式への参照も、
     * MathJax が文書全体を組むときに組み直して解決する(vite/rehype-mathjax-document.ts)
     */
    function eqRef(name: 'ref' | 'eqref', key: string, node: LatexCommand): InlineMath {
      return inlineMath(`\\${name}{${key}}`, node.position)
    }

    function replaceCommand(node: LatexCommand, steps: Steps, overlays: Jsx[]): AnyNode[] {
      const cmd = parseCommand(node.value)
      const key = cmd.body.trim()
      switch (cmd.name) {
        case 'label':
          return [] // (3) で登録済み
        case 'ref': {
          const l = labels.get(key)
          if (!l) warn(`\\ref{${key}} の参照先がありません`, node)
          if (l?.kind === 'eq') return [eqRef('ref', key, node)]
          return [text(l ? String(l.n) : '??', node.position)]
        }
        case 'eqref': {
          const l = labels.get(key)
          if (!l) warn(`\\eqref{${key}} の参照先がありません`, node)
          if (l?.kind === 'eq') return [eqRef('eqref', key, node)]
          return [text(l ? `(${l.n})` : '(??)', node.position)]
        }
        case 'cite': {
          const keys = cmd.body.split(',').map((k) => k.trim()).filter(Boolean)
          if (noBibliography) error(`\\cite{${cmd.body}} を書いていますが、文献ファイル(references.bib)がありません`, node)
          for (const k of keys) if (bibKeys && !bibKeys.has(k)) warn(`文献 "${k}" が ${bibliography} に見つかりません`, node)
          // 初出順(= 番号順)に並べてから渡す。rehype-citation は複数文献の引用で、番号の並べ替え(CSL)と
          // リンク先の割り当て(書いた順)が食い違い、[1,2] の 1 が別の文献を指してしまうため
          for (const k of keys) if (!citeOrder.has(k)) citeOrder.set(k, citeOrder.size)
          keys.sort((a, b) => citeOrder.get(a)! - citeOrder.get(b)!)
          // rehype-citation(pandoc 記法)の入力に。LaTeX の ~ は改行しない空白
          const locator = cmd.opt ? `, ${cmd.opt.replace(/~/g, ' ')}` : ''
          return [text(`[${keys.map((k) => `@${k}`).join('; ')}${locator}]`, node.position)]
        }
        default:
          if (OVERLAY_COMMANDS.has(cmd.name)) {
            const el = overlayCommand(node, steps, overlays, true)
            overlays.push(el)
            return [el]
          }
          error(`未対応の命令 \\${cmd.name} です`, node)
          return []
      }
    }

    tree.children = [...esm, ...slideElements]

    // 開発時の画面表示用に、警告を deck の export として出す
    const list = warnings.map((w) => ({ file: w.file, line: w.line, message: w.raw }))
    const code = `export const deckWarnings = ${JSON.stringify(list)}`
    tree.children.unshift({
      type: 'mdxjsEsm',
      value: code,
      data: { estree: parseJs(code, { ecmaVersion: 'latest', sourceType: 'module' }) as unknown as Program },
    })

    // 取り込んだファイルの診断はメッセージに「ファイル:行」が入っているので行番号を足さない
    const where = (d: Diag) => (d.file ? '' : `${lineOf(d.place) ?? '?'} 行目: `)
    if (errors.length) {
      const rest = errors.slice(1).map((e) => `\n  ${where(e)}${e.message}`).join('')
      file.fail(`${errors[0].message}${rest ? `\n他 ${errors.length - 1} 件:${rest}` : ''}`, { place: errors[0].place })
    }
    for (const w of warnings) file.message(w.message, { place: w.place })
    if (options.strict && warnings.length) {
      const all = warnings.map((w) => `\n  ${where(w)}${w.message}`).join('')
      file.fail(`原稿に警告が ${warnings.length} 件あります(npm run build -- <デッキ> --allow-warnings で許可):${all}`, { place: warnings[0].place })
    }
  }
}

function lineOf(place?: Position | Point): number | undefined {
  if (!place) return undefined
  return 'start' in place ? place.start.line : place.line
}

/** 別の文字列から解析したノードに、元の命令の位置を付け直す(エラーの位置を原稿の行にするため) */
function setPosition(nodes: AnyNode[], position?: Position) {
  for (const n of nodes) {
    n.position = position
    if ('children' in n) setPosition(n.children as AnyNode[], position)
  }
}
