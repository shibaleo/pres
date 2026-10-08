/**
 * 数式を MathJax で SVG に描く rehype プラグイン(rehype-mathjax の代わり)。
 *
 * rehype-mathjax は数式を 1 つずつ MathJax の convert() で描くため、後ろにある式への参照
 * (\eqref が \label より前にある)を解決できない(??? になる)。MathJax 自身は文書全体を組むとき、
 * 未解決の参照を含む式を最後にもう一度組み直して解決する(MathDocument.compile の recompile)。
 * そこで、文書の数式をすべて 1 つの MathJax 文書に入れ、MathJax の標準の手順(compile → typeset)で組む。
 * 自作するのはこの「数式を集めて MathJax の文書に入れ、結果を戻す」部分だけで、
 * 組版・式番号・参照の解決はすべて MathJax に任せる。
 *
 * 入力の見つけ方と出力の形は rehype-mathjax 7 と同じ:
 *   remark-math の <code class="math-inline"> / <pre><code class="math-display"> を <mjx-container> に置き換え、
 *   文書の末尾に MathJax のスタイルシートを足す。
 */
import type { Element, ElementContent, Parents, Root } from 'hast'
import { h } from 'hastscript'
import { toText } from 'hast-util-to-text'
import { SKIP, visitParents } from 'unist-util-visit-parents'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js'
import type { LiteText } from 'mathjax-full/js/adaptors/lite/Text.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { mathjax } from 'mathjax-full/js/mathjax.js'

export type Options = {
  /** MathJax の TeX 入力の設定(rehype-mathjax の tex と同じ) */
  tex?: Record<string, unknown>
  /** MathJax の SVG 出力の設定(rehype-mathjax の svg と同じ) */
  svg?: Record<string, unknown>
}

// MathJax の convert() の既定値と同じ(rehype-mathjax もこれで描いていた)
const EM = 16
const EX = 8
const CONTAINER_WIDTH = 80 * EX
const LINE_WIDTH = 1000000

type Found = { scope: Element; parent: Parents; text: string; display: boolean }

export default function rehypeMathjaxDocument(options: Options = {}) {
  return (tree: Root) => {
    // (1) 数式を文書順に集める
    const found: Found[] = []
    visitParents(tree, 'element', (element, parents) => {
      const cls = Array.isArray(element.properties.className) ? element.properties.className : []
      const inline = cls.includes('math-inline')
      const display = cls.includes('math-display')
      if (!inline && !display) return
      let scope: Element = element
      let parent = parents[parents.length - 1]
      // 別行立ては remark-math が <pre><code> にするので <pre> ごと置き換える(rehype-mathjax と同じ)
      if (display && parent?.type === 'element' && parent.tagName === 'pre') {
        scope = parent
        parent = parents[parents.length - 2]
      }
      if (!parent) return
      found.push({ scope, parent, text: toText(scope, { whitespace: 'pre' }), display })
      return SKIP
    })
    if (found.length === 0) return

    // (2) 1 つの MathJax 文書に入れて、MathJax の標準の手順で組む
    const adaptor = liteAdaptor()
    const handler = RegisterHTMLHandler(adaptor)
    try {
      const input = new TeX(options.tex)
      const output = new SVG(options.svg)
      const doc = mathjax.document('', { InputJax: input, OutputJax: output })
      const items = found.map((f) => {
        const item = new doc.options.MathItem(f.text, input, f.display)
        item.start.node = adaptor.body(doc.document)
        item.setMetrics(EM, EX, CONTAINER_WIDTH, LINE_WIDTH, 1)
        doc.math.push(item)
        return item
      })
      // compile: 全部の式を組み、後ろの式への参照を含むものを組み直す。typeset: SVG にする
      doc.compile().typeset()

      // (3) 結果を文書に戻す(後ろから置き換えても位置がずれないよう、親の中の位置はその都度探す)
      found.forEach((f, i) => {
        const root = items[i].typesetRoot as LiteElement
        const index = f.parent.children.indexOf(f.scope)
        f.parent.children.splice(index, 1, fromLite(root))
      })
      tree.children.push(fromLite(output.styleSheet(doc) as LiteElement, true))
    } finally {
      mathjax.handlers.unregister(handler)
    }
  }
}

/** MathJax の lite DOM を hast にする(rehype-mathjax と同じ変換) */
function fromLite(node: LiteElement, dropId = false): Element {
  const children: ElementContent[] = node.children.map((c) =>
    'value' in c ? { type: 'text', value: (c as LiteText).value } : fromLite(c as LiteElement),
  )
  const el = h(node.kind, node.attributes as Record<string, string>, children)
  // スタイルシートに MathJax が付ける id は出さない(rehype-mathjax と同じ)
  if (dropId) el.properties.id = undefined
  return el
}
