/**
 * LaTeX 風の文献引用 `\cite{key}` を、デッキ全体で通し番号にする。
 *
 *   \cite{arnold2012}             → [1]
 *   \cite{arnold2012,nakajima2020} → [1, 2]
 *   \cite[p.~5]{arnold2012}       → [1, p. 5]
 *
 * 仕組み:
 *   1) MDX をパースする前のソース文字列で `\cite…{…}` を <Cite keys="…" note="…" /> に置き換える。
 *      MDX では `{…}` が JS 式として解釈されるため、パース後(remark)では扱えない。
 *      コードブロック・インラインコード・テンプレート文字列(`…`)の中は書き換えない。
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

/** `\cite{a,b}` / `\cite[note]{a}` */
const CITE_RE = /\\cite(?:\[([^\]]*)\])?\{([^}]+)\}/g

/** 書き換え対象外: フェンスコード、バッククォートで囲まれた範囲(インラインコード・テンプレート文字列) */
const PROTECTED_RE = /```[\s\S]*?```|`[^`]*`/g

function parseKeys(group: string): string[] {
  return group
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 保護範囲を避けて、地の文の部分だけに fn を適用する */
function mapUnprotected(src: string, fn: (text: string) => string): string {
  let out = ''
  let last = 0
  for (const m of src.matchAll(PROTECTED_RE)) {
    out += fn(src.slice(last, m.index)) + m[0]
    last = m.index! + m[0].length
  }
  return out + fn(src.slice(last))
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

function replaceCitations(text: string): string {
  return text.replace(CITE_RE, (_all, note: string | undefined, keys: string) => {
    const attrs = [`keys="${escapeAttr(parseKeys(keys).join(';'))}"`]
    // LaTeX の ~ (改行しない空白) は NBSP に
    if (note) attrs.push(`note="${escapeAttr(note.replace(/~/g, ' '))}"`)
    return `<Cite ${attrs.join(' ')} />`
  })
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

export function bibliography({ bib, slidesDir }: { bib: string; slidesDir: string }): Plugin {
  const bibPath = resolve(bib)
  const slidesPath = resolve(slidesDir)

  /** 全スライドを表示順に読み、初出順の key 一覧を返す(保護範囲は数えない) */
  function citationOrder(): string[] {
    const files = listSlideFiles(slidesPath)
      .map((f) => ({ f, rel: relative(slidesPath, f).split(sep).join('/') }))
      .sort((a, b) => compareSlidePaths(a.rel, b.rel))
    const seen = new Set<string>()
    for (const { f } of files) {
      mapUnprotected(readFileSync(f, 'utf8'), (text) => {
        for (const m of text.matchAll(CITE_RE)) for (const k of parseKeys(m[2])) seen.add(k)
        return text
      })
    }
    return [...seen]
  }

  return {
    name: 'deck-bibliography',
    // MDX プラグインより前にソースを書き換える(vite.config で mdx より先に並べる)
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('.mdx')) return null
      const out = mapUnprotected(code, replaceCitations)
      return out === code ? null : { code: out, map: null }
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      this.addWatchFile(bibPath)
      const library = new Cite(readFileSync(bibPath, 'utf8'))
      const known = new Map<string, object>(library.data.map((e) => [e.id, e]))

      // 未登録の key は警告して番号を振らない(後続の番号がずれないように)
      const order = citationOrder().filter((key) => {
        if (known.has(key)) return true
        this.warn(`文献 "${key}" が ${bib} に見つかりません`)
        return false
      })

      const entries: Record<string, { html: string; text: string }> = {}
      for (const key of order) {
        const one = new Cite(known.get(key))
        const opts = { template: 'vancouver', lang: 'en-US' }
        const html = one.format('bibliography', { ...opts, format: 'html' })
        const text = one.format('bibliography', { ...opts, format: 'text' })
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
