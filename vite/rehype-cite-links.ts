/**
 * rehype-citation の後の引用の仕上げ。
 *
 * 1. 本文の引用の番号のリンク先を、文献リストのその番号の項目に合わせ直す。
 *    rehype-citation(linkCitations)は、引用の番号のリンクに、引用に書いた文献を書いた順に割り当てる。
 *    CSL が連続した番号を範囲にまとめると([8–11])、表示される番号(8 と 11)と割り当てる文献(1 つ目と 2 つ目)が食い違い、
 *    11 のリンクが 9 番の文献を指してしまう。そこで、表示された番号から文献リストの項目を引いて、リンク先を付け直す。
 *    番号は文献リストの並び(.csl-entry の順。続きのスライドに分かれていても文書の順)の何番目か
 * 2. \footfullcite の脚注(原稿の変換が置く span.fullcite。中は文献の引用)を、文献リストのその項目の書誌に置き換える
 *    (書誌の整形は rehype-citation = citeproc のものをそのまま使う。URL・DOI のリンクも含む)。
 * 3. スライドの外の文献リスト(<Bibliography /> を書かないデッキで、rehype-citation が文書の最後に足すもの)は、
 *    書誌を取り出した後に外す(どのスライドにも載らず、表示されない)
 */
import type { Element, ElementContent, Root } from 'hast'
import { visitParents } from 'unist-util-visit-parents'

const hasClass = (n: Element, cls: string) => {
  const c = n.properties?.className
  return Array.isArray(c) && c.includes(cls)
}
const textOf = (n: ElementContent): string => (n.type === 'text' ? n.value : 'children' in n ? n.children.map(textOf).join('') : '')
const clone = <T>(node: T): T => structuredClone(node)

export default function rehypeCiteLinks() {
  return (tree: Root) => {
    const ids: string[] = []
    /** 文献の key → 整形した書誌(.csl-right-inline の中身) */
    const entries = new Map<string, ElementContent[]>()
    visitParents(tree, 'element', (node: Element) => {
      if (!hasClass(node, 'csl-entry') || typeof node.properties?.id !== 'string') return
      ids.push(node.properties.id)
      const body = node.children.find((c): c is Element => c.type === 'element' && hasClass(c, 'csl-right-inline'))
      entries.set(node.properties.id.replace(/^bib-/, ''), body ? body.children : node.children)
    })
    if (ids.length === 0) return

    // \footfullcite の印(span.fullcite)は原稿の変換が JSX の要素として置くので、rehype の段階でも JSX の要素(mdxJsxTextElement)のまま
    visitParents(tree, (node) => {
      const jsx = node as unknown as { type: string; name?: string; attributes?: { name?: string; value?: unknown }[]; children: ElementContent[] }
      const isFullcite = jsx.type === 'mdxJsxTextElement' && jsx.name === 'span' && jsx.attributes?.some((a) => a.name === 'className' && a.value === 'fullcite')
      if (!isFullcite) return
      // 中の引用(rehype-citation の citation--key1--key2--n の id)の文献の書誌に置き換える
      const cite = jsx.children.find((c): c is Element => c.type === 'element' && String(c.properties?.id ?? '').startsWith('citation--'))
      const keys = cite ? String(cite.properties.id).split('--').slice(1, -1) : []
      const parts = keys.map((k) => entries.get(k.toLowerCase())).filter((e): e is ElementContent[] => !!e)
      jsx.children = parts.flatMap((p, i) => [...(i > 0 ? [{ type: 'text' as const, value: '; ' }] : []), ...clone(p)])
      return 'skip'
    })

    visitParents(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return
      const href = node.properties?.href
      if (typeof href !== 'string' || !href.startsWith('#bib-')) return
      const n = Number(textOf(node).trim())
      if (Number.isInteger(n) && n >= 1 && n <= ids.length) node.properties.href = `#${ids[n - 1]}`
    })

    tree.children = tree.children.filter((c) => !(c.type === 'element' && hasClass(c, 'csl-bib-body')))
  }
}
