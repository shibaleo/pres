import { readFileSync } from 'node:fs'
import { Cite } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-csl'

export type BibEntries = Record<string, { html: string; text: string }>

/**
 * 引用された key を、BibTeX から CSL(Vancouver)で整形する。
 * 未登録の key は onUnknown に知らせて除外する(後続の番号がずれないように)。
 */
export function formatBibliography(
  bibPath: string,
  citedInOrder: string[],
  onUnknown: (key: string) => void,
): { order: string[]; entries: BibEntries } {
  const library = new Cite(readFileSync(bibPath, 'utf8'))
  const known = new Map<string, object>(library.data.map((e) => [e.id, e]))

  const order = citedInOrder.filter((key) => {
    if (known.has(key)) return true
    onUnknown(key)
    return false
  })

  const entries: BibEntries = {}
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
  return { order, entries }
}
