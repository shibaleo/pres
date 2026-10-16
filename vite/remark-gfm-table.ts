/**
 * GFM の表(`| a | b |` と区切りの行 `| --- | ---: |`)だけを読む remark のプラグイン。
 * remark-gfm と同じ作り(micromark の構文拡張 + mdast の変換)で、GFM のうち表だけを登録する。
 * ほかの GFM の拡張は入れない: 脚注 [^1] は \footnote と二重になり、文献リストの差し込みの印 [^ref] と衝突する。
 * 取り消し線は LaTeX の ~(改行しない空白)と衝突する。自動リンクは本文の URL を書いた覚えのないリンクにする(CLAUDE.md)。
 * 表の題と合計の行(GFM に無いもの)は部品の <Table caption foot> で書く(src/components/Table.tsx)。
 */
import type { Processor } from 'unified'
import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'

export default function remarkGfmTable(this: Processor) {
  const data = this.data()
  ;(data.micromarkExtensions ??= []).push(gfmTable())
  ;(data.fromMarkdownExtensions ??= []).push(gfmTableFromMarkdown())
}
