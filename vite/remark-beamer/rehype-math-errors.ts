/**
 * 数式の誤りをビルドエラーにする rehype プラグイン(数式の描画 rehype-mathjax-document の前後に 1 つずつ置く)。
 *
 * MathJax は誤りのある数式も赤字の merror として描いてしまう(data-mjx-error 属性が付く)。
 * 描画後のノードには原稿の位置が残らないので、描画前に数式の位置を文書順に控えておき、
 * 描画後の数式(mjx-container)と順番で対応づけて、原稿の行で報告する。
 * \input で取り込んだファイルの数式は「ファイル:行」(data-beamer-source)をメッセージに含める。
 */
import type { Element, Root, RootContent } from 'hast'
import type { Position } from 'unist'
import type { VFile } from 'vfile'

type MathPlace = { position?: Position; source?: string }
const places = new WeakMap<VFile, MathPlace[]>()

function walk(node: Root | RootContent, fn: (el: Element, parent?: Element) => boolean | void, parent?: Element) {
  if (node.type === 'element' && fn(node, parent) === false) return
  if ('children' in node) for (const c of node.children) walk(c, fn, node.type === 'element' ? node : parent)
}

const isMath = (el: Element) => {
  const cls = el.properties?.className
  return el.tagName === 'code' && Array.isArray(cls) && (cls.includes('math-inline') || cls.includes('math-display'))
}

/** 描画の前: 数式の位置を文書順に控える */
export function rehypeMathPositions() {
  return (tree: Root, file: VFile) => {
    const list: MathPlace[] = []
    walk(tree, (el, parent) => {
      if (!isMath(el)) return
      const source = el.properties?.dataBeamerSource
      // 別行立て数式の <code> は remark-math が生成したもので位置を持たないので、親の <pre> の位置を使う
      list.push({ position: el.position ?? parent?.position, source: typeof source === 'string' ? source : undefined })
      return false
    })
    places.set(file, list)
  }
}

/** 描画の後: 誤りのある数式を原稿の位置付きで報告する */
export function rehypeMathErrors() {
  return (tree: Root, file: VFile) => {
    const list = places.get(file) ?? []
    let i = 0
    walk(tree, (el) => {
      if (el.tagName !== 'mjx-container') return
      const place = list[i++]
      let message: string | undefined
      walk(el, (inner) => {
        const err = inner.properties?.dataMjxError
        if (typeof err === 'string') message = err
      })
      if (message) file.fail(`${place?.source ? `${place.source}: ` : ''}数式の誤り: ${message}`, { place: place?.position })
      return false
    })
  }
}
