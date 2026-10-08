/**
 * デッキ全体で通し番号になる文献引用(旧: rehype-citation はMDXファイル単位で採番していた)。
 *
 * 仕組み:
 *   1) remark プラグインが本文の `[@key]` / `[@a; @b]` を <Cite keys="a;b" /> に置き換える。
 *      (番号はここでは決めない)
 *   2) 仮想モジュール `virtual:bibliography` が、全スライドを表示順(compareSlidePaths)に
 *      走査して「初出順の key 一覧」と、BibTeX を CSL(Vancouver)で整形した文献文字列を出力する。
 *   3) <Cite> / <Bibliography> は実行時にこのモジュールを読んで番号・一覧を描く。
 *
 * どれかのスライドや .bib を編集すると仮想モジュールを無効化するので、
 * 開発中も全スライドの番号が追従する。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'
import { Cite } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-csl'
import { compareSlidePaths } from '../src/deck/order'

const VIRTUAL_ID = 'virtual:bibliography'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/** `[@key]` または `[@a; @b]`。key は英数字と : . - _ / */
const CITE_RE = /\[(@[\w:.\-/]+(?:\s*;\s*@[\w:.\-/]+)*)\]/g

function parseKeys(group: string): string[] {
  return group.split(';').map((s) => s.trim().replace(/^@/, ''))
}

function listSlideFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listSlideFiles(p))
    else if (name.endsWith('.mdx')) out.push(p)
  }
  return out
}

// ---------- remark: [@key] → <Cite keys="key" /> ----------

type MdNode = {
  type: string
  value?: string
  children?: MdNode[]
  [k: string]: unknown
}

// コード・数式・JSX 式の中身は書き換えない
const SKIP = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'mdxFlowExpression', 'mdxTextExpression', 'mdxjsEsm'])

function splitCitations(text: string): MdNode[] | null {
  CITE_RE.lastIndex = 0
  if (!CITE_RE.test(text)) return null
  CITE_RE.lastIndex = 0
  const out: MdNode[] = []
  let last = 0
  for (const m of text.matchAll(CITE_RE)) {
    if (m.index! > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    out.push({
      type: 'mdxJsxTextElement',
      name: 'Cite',
      attributes: [{ type: 'mdxJsxAttribute', name: 'keys', value: parseKeys(m[1]).join(';') }],
      children: [],
    })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

function walk(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) return
  const next: MdNode[] = []
  for (const child of node.children) {
    const replaced = child.type === 'text' ? splitCitations(child.value ?? '') : null
    if (replaced) next.push(...replaced)
    else {
      walk(child)
      next.push(child)
    }
  }
  node.children = next
}

export function remarkCitations() {
  return (tree: MdNode) => walk(tree)
}

// ---------- vite: virtual:bibliography ----------

export function bibliography({ bib, slidesDir }: { bib: string; slidesDir: string }): Plugin {
  const bibPath = resolve(bib)
  const slidesPath = resolve(slidesDir)

  /** 全スライドを表示順に読み、初出順の key 一覧を返す */
  function citationOrder(): string[] {
    const files = listSlideFiles(slidesPath)
      .map((f) => ({ f, rel: relative(slidesPath, f).split(sep).join('/') }))
      .sort((a, b) => compareSlidePaths(a.rel, b.rel))
    const seen = new Set<string>()
    for (const { f } of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(CITE_RE)) {
        for (const k of parseKeys(m[1])) seen.add(k)
      }
    }
    return [...seen]
  }

  return {
    name: 'deck-bibliography',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      this.addWatchFile(bibPath)
      const order = citationOrder()
      const library = new Cite(readFileSync(bibPath, 'utf8'))
      const known = new Map<string, object>(library.data.map((e: { id: string }) => [e.id, e]))

      const entries: Record<string, { html: string; text: string }> = {}
      for (const key of order) {
        const data = known.get(key)
        if (!data) {
          this.warn(`文献 "${key}" が ${bib} に見つかりません`)
          continue
        }
        const one = new Cite(data)
        const opts = { template: 'vancouver', lang: 'en-US' }
        const html: string = one.format('bibliography', { ...opts, format: 'html' })
        const text: string = one.format('bibliography', { ...opts, format: 'text' })
        entries[key] = {
          // 番号は <Bibliography> が付けるので、CSL の「1. 」列を除いた本文だけ使う
          html: html.match(/<div class="csl-right-inline">([\s\S]*?)<\/div>/)?.[1] ?? html,
          text: text.replace(/^\s*\d+\.\s*/, '').trim(),
        }
      }
      return `export const order = ${JSON.stringify(order)}\nexport const entries = ${JSON.stringify(entries)}\n`
    },
    handleHotUpdate({ file, server, modules }) {
      const f = resolve(file)
      const affects = f === bibPath || (f.startsWith(slidesPath) && f.endsWith('.mdx'))
      if (!affects) return
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (!mod) return
      server.moduleGraph.invalidateModule(mod)
      return [...modules, mod]
    },
  }
}
