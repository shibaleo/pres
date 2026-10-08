/**
 * Beamer / LaTeX 風記法の意味づけ(mdast → mdast)。構文は syntax.ts / mdast.ts が切り出している。
 *
 *  1. スライド分割   `---`(横)/ `--`(縦)で <Slide> / <Stack> に包む
 *  2. 環境           \begin{theorem}[名前] … \end{theorem} を <Theorem> に、\pause 以降を <Overlay> に
 *  3. 番号付け       定理型の環境にデッキ全体の通し番号。式の番号は MathJax(tags: 'ams')に任せる
 *  4. 文中の命令     \ref \eqref \label \cite \only \uncover …
 *  5. 段階表示       Beamer の overlay 指定を reveal の fragment(<Overlay>)に。ステップ数は Beamer と揃える
 *
 * 引用は rehype-citation の入力形式([@a; @b])に変換して、番号付け・整形はそちらに任せる。
 * エラーは file.fail、警告は file.message(unified の標準)。位置は構文解析器が付けた元の行。
 */
import { readFileSync } from 'node:fs'
import { parse as parseJs } from 'acorn'
import type { Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'
import type { InlineMath } from 'mdast-util-math'
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { Program } from 'estree'
import type { Processor } from 'unified'
import type { VFile } from 'vfile'
import type { Point, Position } from 'unist'
import { MATH_ENVS } from './syntax'
import type { LatexCommand, LatexLine } from './mdast'

export type BeamerOptions = {
  /** \cite の key を確認する BibTeX ファイル(未登録の key を警告する) */
  bibliography?: string
  /** 警告もエラーとして扱う(本番ビルド用) */
  strict?: boolean
}

/** 定理型の環境(1 本の通し番号を共有する) */
const THEOREM_ENVS: Record<string, string> = {
  theorem: 'Theorem',
  lemma: 'Lemma',
  proposition: 'Proposition',
  corollary: 'Corollary',
  definition: 'Definition',
}
const ENV_TAGS: Record<string, string> = { ...THEOREM_ENVS, proof: 'Proof' }
const THEOREM_TAGS = new Set(Object.values(THEOREM_ENVS))
const OVERLAY_COMMANDS = new Set(['only', 'uncover', 'visible', 'onslide'])

type Jsx = MdxJsxFlowElement | MdxJsxTextElement
type BeamerData = { pause?: boolean; spec?: string; label?: string }
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
/** remark-math と同じ形のインライン数式(rehype-mathjax が描く) */
function inlineMath(value: string, position?: Position): InlineMath {
  return {
    type: 'inlineMath',
    value,
    position,
    data: { hName: 'code', hProperties: { className: ['language-math', 'math-inline'] }, hChildren: [{ type: 'text', value }] },
  }
}
const text = (value: string, position?: Position): Text => ({ type: 'text', value, position })

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
function parseLine(raw: string): Line {
  const s = raw.trim()
  if (s === '\\pause') return { kind: 'pause' }
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
  const bibKeys = options.bibliography ? readBibKeys(options.bibliography) : null

  return function (tree: Root, file: VFile) {
    const errors: { message: string; place?: Position | Point }[] = []
    const warnings: { message: string; place?: Position | Point }[] = []
    const error = (message: string, node?: { position?: Position }) => errors.push({ message, place: node?.position })
    const warn = (message: string, node?: { position?: Position }) => warnings.push({ message, place: node?.position })

    // (1) スライド分割。import / export は Slide の外(文書の先頭)に残す
    const esm: RootContent[] = []
    const stacks: RootContent[][][] = [[[]]]
    const source = String(file.value)
    const isSeparator = (n: RootContent, sep: string) =>
      n.position?.start.offset !== undefined && source.slice(n.position.start.offset, n.position.end.offset).trim() === sep
    for (const node of tree.children) {
      if (node.type === 'mdxjsEsm') esm.push(node)
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
          stack.push({ kind: 'pause', node: overlayFlow({ pause: true }, [], child.position), items: [] })
        } else if (line.kind === 'begin') {
          const tag = ENV_TAGS[line.name]
          if (!tag) {
            error(`未対応の環境 \\begin{${line.name}} です(使えるのは ${Object.keys(ENV_TAGS).join(', ')} と数式環境)`, child)
            continue
          }
          const el = jsxFlow(tag, tag === 'Proof' ? { heading: line.opt } : {}, [], child.position)
          el.data = { beamer: { spec: line.spec, label: line.label } } as object
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

    // (3) 番号付け(デッキ全体・文書順)。定理型の環境と \label、数式中の \label を集める
    // offset: 式のラベルの位置(前方参照の判定用)
    type Label = { kind: 'thm' | 'eq'; n?: number; offset?: number }
    const labels = new Map<string, Label>()
    const addLabel = (key: string, value: Label, node: { position?: Position }) => {
      if (labels.has(key)) warn(`\\label{${key}} が重複しています`, node)
      labels.set(key, value)
    }
    let thm = 0
    const numberWalk = (node: AnyNode, envs: Jsx[]) => {
      let inner = envs
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name && THEOREM_TAGS.has(node.name)) {
        thm++
        setAttr(node, 'n', thm)
        const label = beamer(node)?.label ?? getAttr(node, 'id')
        if (label) addLabel(label, { kind: 'thm', n: thm }, node)
        inner = [...envs, node]
      }
      if (node.type === 'latexCommand' && parseCommand((node as LatexCommand).value).name === 'label') {
        const key = parseCommand((node as LatexCommand).value).body.trim()
        const env = inner[inner.length - 1]
        if (env) addLabel(key, { kind: 'thm', n: Number(getAttr(env, 'n')) }, node)
        else error(`\\label{${key}} が定理環境・数式の外にあります`, node)
      }
      if (node.type === 'math' || node.type === 'inlineMath') {
        for (const m of node.value.matchAll(/\\label\{([^}]+)\}/g)) addLabel(m[1].trim(), { kind: 'eq', offset: node.position?.start.offset }, node)
        // \begin{align} などの閉じ忘れ(構文上は数式の終わりまで取り込まれている)
        const env = node.value.match(/^\\begin\{([A-Za-z]+\*?)\}/)?.[1]
        if (env && MATH_ENVS.includes(env.replace(/\*$/, '')) && !node.value.includes(`\\end{${env}}`)) {
          error(`\\begin{${env}} に対応する \\end{${env}} がありません`, node)
        }
      }
      if ('children' in node) for (const c of node.children) numberWalk(c as AnyNode, inner)
    }
    for (const stack of built) for (const nodes of stack) for (const n of nodes) numberWalk(n, [])

    // (4)(5) 文中の命令と段階表示(スライドごと・文書順)
    const slideElements: RootContent[] = built.map((stack) => {
      const els = stack.map((nodes) => {
        const steps = new Steps()
        const overlays: Jsx[] = []
        const root = { type: 'root', children: nodes } as Root
        transformChildren(root, steps, overlays)
        // to が最後のステップ以降なら「消える」ステップは存在しないので外す
        for (const o of overlays) {
          const to = getAttr(o, 'to')
          if (to !== undefined && Number(to) >= steps.max) setAttr(o, 'to', undefined)
        }
        if (steps.max >= 2) root.children.push(jsxFlow('OverlaySteps', { max: steps.max }, []))
        const line = nodes[0]?.position?.start.line
        return jsxFlow('Slide', { 'data-slide-line': line }, root.children, nodes[0]?.position)
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
      // 箇条書きの先頭の overlay 指定 `- <2-> 項目`(1 行目は構文拡張が行ごと拾っている)
      if (node.type === 'listItem' && node.children[0]?.type === 'latexOverlayLine') {
        const line = node.children[0]
        const m = line.value.match(/^<([^>]*)>\s+([\s\S]*)$/)!
        const parsed = processor.parse(m[2]) as Root
        const first = parsed.children[0]
        const rest = first?.type === 'paragraph' ? first.children : []
        setPosition(rest, line.position)
        const el = jsxText('Overlay', { as: 'span', li: true }, rest, line.position)
        applySpec(el, m[1], steps, line)
        overlays.push(el)
        node.children[0] = { type: 'paragraph', children: [el], position: line.position }
      }
      if (node.type === 'latexOverlayLine') {
        error(`overlay 指定 ${node.value.split(/\s/)[0]} は箇条書きの先頭にだけ書けます`, node)
        return []
      }
      if (node.type === 'latexOverlaySpec') {
        error(`overlay 指定 ${node.value} は箇条書きの先頭にだけ書けます`, node)
        return []
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
     * 式の参照は数式の中の \ref / \eqref として MathJax に解決させる。
     * rehype-mathjax は文書順に 1 式ずつ描くため、後ろにある式への参照(前方参照)は解決できない(??? になる)。
     */
    function eqRef(name: 'ref' | 'eqref', key: string, l: Label, node: LatexCommand): InlineMath {
      const here = node.position?.start.offset ?? 0
      if (l.offset !== undefined && l.offset > here) {
        warn(`\\${name}{${key}} は後ろにある式への参照です。数式の描画(rehype-mathjax)の制約で表示できません`, node)
      }
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
          if (l?.kind === 'eq') return [eqRef('ref', key, l, node)]
          return [text(l ? String(l.n) : '??', node.position)]
        }
        case 'eqref': {
          const l = labels.get(key)
          if (!l) warn(`\\eqref{${key}} の参照先がありません`, node)
          if (l?.kind === 'eq') return [eqRef('eqref', key, l, node)]
          return [text(l ? `(${l.n})` : '(??)', node.position)]
        }
        case 'cite': {
          const keys = cmd.body.split(',').map((k) => k.trim()).filter(Boolean)
          for (const k of keys) if (bibKeys && !bibKeys.has(k)) warn(`文献 "${k}" が ${options.bibliography} に見つかりません`, node)
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
    const list = warnings.map((w) => ({ line: lineOf(w.place), message: w.message }))
    const code = `export const deckWarnings = ${JSON.stringify(list)}`
    tree.children.unshift({
      type: 'mdxjsEsm',
      value: code,
      data: { estree: parseJs(code, { ecmaVersion: 'latest', sourceType: 'module' }) as unknown as Program },
    })

    if (errors.length) {
      const rest = errors.slice(1).map((e) => `\n  ${lineOf(e.place) ?? '?'} 行目: ${e.message}`).join('')
      file.fail(`${errors[0].message}${rest ? `\n他 ${errors.length - 1} 件:${rest}` : ''}`, { place: errors[0].place })
    }
    for (const w of warnings) file.message(w.message, { place: w.place })
    if (options.strict && warnings.length) {
      const all = warnings.map((w) => `\n  ${lineOf(w.place) ?? '?'} 行目: ${w.message}`).join('')
      file.fail(`原稿に警告が ${warnings.length} 件あります(DECK_ALLOW_WARNINGS=1 で許可):${all}`, { place: warnings[0].place })
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
