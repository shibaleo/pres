/**
 * remark-beamer: Beamer / LaTeX 風記法の remark プラグイン。
 * remark-math・remark-directive と同じく「構文拡張(micromark)+ mdast 変換 + 構文木の変換」の 3 段で作る。
 *
 *   remarkPlugins: [remarkMath, [remarkBeamer, { bibliography: 'src/references.bib' }]]
 */
import type { Processor } from 'unified'
import type { Extension as MicromarkExtension } from 'micromark-util-types'
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown'
import { beamerSyntax } from './syntax'
import { beamerFromMarkdown } from './mdast'
import { beamerTransform, type BeamerOptions } from './transform'

export type { BeamerOptions }

export default function remarkBeamer(this: Processor, options: BeamerOptions = {}) {
  const data = this.data() as { micromarkExtensions?: MicromarkExtension[]; fromMarkdownExtensions?: FromMarkdownExtension[] }
  ;(data.micromarkExtensions ??= []).push(beamerSyntax())
  ;(data.fromMarkdownExtensions ??= []).push(beamerFromMarkdown())
  return beamerTransform.call(this, options)
}
