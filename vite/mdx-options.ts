/**
 * スライド原稿(MDX)のコンパイル設定。vite.config.ts とテストで共有する。
 * 記法は remark-beamer(LaTeX / Beamer 風)、処理は標準の unified プラグインに任せる:
 *   remark-math(数式)/ MathJax(式の番号・\label・\eqref。rehype-mathjax-document.ts)/
 *   rehype-citation(引用の番号付け・文献リスト)
 */
import type { CompileOptions } from '@mdx-js/mdx'
import type { Root as HastRoot } from 'hast'
import type { VFile } from 'vfile'
import type { Processor } from 'unified'
import { relative } from 'node:path'
import { MIN_WIDTH } from '../src/deck/slide-metrics.ts'
import remarkMath from 'remark-math'
import rehypeCitation from 'rehype-citation'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import remarkBeamer from './remark-beamer/index.ts'
import rehypeMathjaxDocument from './rehype-mathjax-document.ts'
import { rehypeMathPositions, rehypeMathErrors } from './remark-beamer/rehype-math-errors.ts'

/** 文献ファイル。関数なら変換する主ファイルのパスから決める(デッキごとに文献ファイルが違うため。vite/decks.js) */
export type Bibliography = string | ((file: string) => string | undefined)

const CSL = 'vite/csl/nlm-citation-sequence-brackets.csl'

/**
 * 数式を入れる箱の幅(ex)。最小サイズのスライド(src/deck/slide-metrics.ts)の本文の幅を、本文の書体の 1ex で割ったもの。
 * 本文の幅 = 最小の幅 − 左右のスライドの余白(tokens.css の --slide-pad = 1 行 = --text-base 28px × --leading 1.4)。
 * 1ex は書体で違う(New Computer Modern は 0.431em、Noto Serif JP / Noto Sans JP は約 0.54em)ので、
 * どの書体でもはみ出さないよう大きい方(0.55em)で見積もる。トークンを変えたデッキでは合わないことがあるが、
 * はみ出しは e2e/overflow.spec.ts が捕まえる
 */
const TEXT_BASE = 28
const SLIDE_PAD = TEXT_BASE * 1.4
const CONTAINER_WIDTH_EX = (MIN_WIDTH - 2 * SLIDE_PAD) / (TEXT_BASE * 0.55)

/**
 * rehype-citation を、変換する原稿ごとの文献ファイルで動かす。rehype-citation の設定は処理系に 1 つだけなので、
 * 原稿ごとに設定を作って呼ぶ(変換そのものは rehype-citation のまま)。文献ファイルの無い原稿では何もしない
 * (\cite が書かれていれば remark-beamer がエラーにする)
 */
function rehypeCitationPerFile(this: Processor, { bibliography }: { bibliography: Bibliography }) {
  const processor = this
  return async (tree: HastRoot, file: VFile) => {
    const bib = typeof bibliography === 'function' ? bibliography(file.path) : bibliography
    if (!bib) return
    // rehype-citation は Windows の絶対パス(C:\…)を URL と見なして読めないので、作業ディレクトリからの相対パスで渡す
    const rel = relative(process.cwd(), bib).split('\\').join('/')
    const transform = rehypeCitation.call(processor, { bibliography: rel, csl: CSL, linkCitations: true }) as (t: HastRoot, f: VFile) => Promise<void>
    await transform(tree, file)
  }
}

export function mdxOptions({ bibliography, strict }: { bibliography: Bibliography; strict: boolean }): CompileOptions {
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
          // fontCache: 'global' = 字形の輪郭を文書全体で 1 回だけ持ち、各数式は参照する(出力が小さくなる)
          svg: { displayAlign: 'left', displayIndent: '0', fontCache: 'global' },
          containerWidthEx: CONTAINER_WIDTH_EX,
        },
      ],
      rehypeMathErrors,
      // CSL は公式リポジトリの NLM/Vancouver(角括弧版)。本文の引用は [1] / [1,2] の形になる
      [rehypeCitationPerFile, { bibliography }],
    ],
  }
}
