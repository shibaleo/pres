/**
 * スライド原稿(MDX)のコンパイル設定。vite.config.ts とテストで共有する。
 * 記法は remark-beamer(LaTeX / Beamer 風)、処理は標準の unified プラグインに任せる:
 *   remark-math(数式)/ MathJax(式の番号・\label・\eqref。rehype-mathjax-document.ts)/
 *   rehype-citation(引用の番号付け・文献リスト)
 */
import type { CompileOptions } from '@mdx-js/mdx'
import remarkMath from 'remark-math'
import rehypeCitation from 'rehype-citation'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import remarkBeamer from './remark-beamer'
import rehypeMathjaxDocument from './rehype-mathjax-document'
import { rehypeMathPositions, rehypeMathErrors } from './remark-beamer/rehype-math-errors'

export function mdxOptions({ bibliography, strict }: { bibliography: string; strict: boolean }): CompileOptions {
  return {
    remarkPlugins: [
      remarkMath,
      // Beamer / LaTeX 風記法(スライド分割・定理環境・\ref・\cite・段階表示)。詳細は vite/remark-beamer/
      // strict では警告(参照先なし・未登録の文献)も失敗扱い
      [remarkBeamer, { bibliography, strict }],
    ],
    rehypePlugins: [
      rehypeMathPositions,
      // 式の番号・\label・\eqref は MathJax(AMS と同じ規則)。SVG なのでフォント不要・オフラインで描ける
      // noundefined は未定義の命令を赤字で描いて通してしまうので外す(誤りとして報告する)
      [
        rehypeMathjaxDocument,
        {
          tex: { tags: 'ams', packages: AllPackages.filter((p) => p !== 'noundefined') },
          svg: { displayAlign: 'left', displayIndent: '0' },
        },
      ],
      rehypeMathErrors,
      // CSL は公式リポジトリの NLM/Vancouver(角括弧版)。本文の引用は [1] / [1,2] の形になる
      [rehypeCitation, { bibliography, csl: 'src/csl/nlm-citation-sequence-brackets.csl', linkCitations: true }],
    ],
  }
}
