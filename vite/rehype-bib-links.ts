/**
 * 文献リストの URL と DOI をリンクにする(rehype-citation の後に走らせる)。
 * 文献リストの整形は citeproc-js(rehype-citation の中)が行い、citeproc-js には URL・DOI をリンクで包む設定
 * (development_extensions.wrap_url_and_doi)があるが、rehype-citation はそれを常に切っていて、外から入れられない。
 * そこで、出来上がった文献リスト(CSL の標準のマークアップ .csl-entry)の文字の中の URL と「doi:10.…」だけを <a> にする。
 * 文献の中身は変えない(文字はそのまま、リンクを付けるだけ)。DOI のリンク先は https://doi.org/<DOI>
 */
import type { Element, ElementContent, Root, Text } from 'hast'
import { visitParents } from 'unist-util-visit-parents'

// URL と DOI。文の終わりの句点(CSL が項目の後に付ける「.」)はリンクに含めない
const LINK = /(https?:\/\/[^\s<>"]+[^\s<>".,;])|(doi:\s?(10\.[^\s<>"]+[^\s<>".,;]))/g

const isEntry = (node: Element) => {
  const cls = node.properties?.className
  return Array.isArray(cls) && cls.includes('csl-entry')
}

function linkify(text: string): ElementContent[] | undefined {
  const out: ElementContent[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) })
    const href = m[1] ?? `https://doi.org/${m[3]}`
    out.push({ type: 'element', tagName: 'a', properties: { href }, children: [{ type: 'text', value: m[0] }] })
    last = start + m[0].length
  }
  if (out.length === 0) return undefined
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

export default function rehypeBibLinks() {
  return (tree: Root) => {
    const targets: { node: Text; parent: Element }[] = []
    visitParents(tree, 'text', (node, ancestors) => {
      const parent = ancestors[ancestors.length - 1]
      if (parent?.type !== 'element' || parent.tagName === 'a') return
      if (!ancestors.some((a) => a.type === 'element' && isEntry(a))) return
      targets.push({ node, parent })
    })
    for (const { node, parent } of targets) {
      const parts = linkify(node.value)
      if (!parts) continue
      parent.children.splice(parent.children.indexOf(node), 1, ...parts)
    }
  }
}
