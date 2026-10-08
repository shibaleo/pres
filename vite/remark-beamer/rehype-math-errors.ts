/**
 * 数式の誤りをビルドエラーにする rehype プラグイン(rehype-mathjax の前後に 1 つずつ置く)。
 *
 * MathJax は誤りのある数式も赤字の merror として描いてしまう(data-mjx-error 属性が付く)。
 * 描画後のノードには原稿の位置が残らないので、描画前に数式の位置を文書順に控えておき、
 * 描画後の数式(mjx-container)と順番で対応づけて、原稿の行で報告する。
 */
import type { Element, Root, RootContent } from 'hast'
import type { Position } from 'unist'
import type { VFile } from 'vfile'

const positions = new WeakMap<VFile, (Position | undefined)[]>()

function walk(node: Root | RootContent, fn: (el: Element, parent?: Element) => boolean | void, parent?: Element) {
  if (node.type === 'element' && fn(node, parent) === false) return
  if ('children' in node) for (const c of node.children) walk(c, fn, node.type === 'element' ? node : parent)
}

const isMath = (el: Element) => {
  const cls = el.properties?.className
  return el.tagName === 'code' && Array.isArray(cls) && (cls.includes('math-inline') || cls.includes('math-display'))
}

/** rehype-mathjax の前: 数式の位置を文書順に控える */
export function rehypeMathPositions() {
  return (tree: Root, file: VFile) => {
    const list: (Position | undefined)[] = []
    walk(tree, (el, parent) => {
      if (!isMath(el)) return
      // 別行立て数式の <code> は remark-math が生成したもので位置を持たないので、親の <pre> の位置を使う
      list.push(el.position ?? parent?.position)
      return false
    })
    positions.set(file, list)
  }
}

/** rehype-mathjax の後: 誤りのある数式を原稿の位置付きで報告する */
export function rehypeMathErrors() {
  return (tree: Root, file: VFile) => {
    const list = positions.get(file) ?? []
    let i = 0
    walk(tree, (el) => {
      if (el.tagName !== 'mjx-container') return
      const place = list[i++]
      let message: string | undefined
      walk(el, (inner) => {
        const err = inner.properties?.dataMjxError
        if (typeof err === 'string') message = err
      })
      if (message) file.fail(`数式の誤り: ${message}`, { place })
      return false
    })
  }
}
