/**
 * GFM の表の数値のセルを整える(remark-beamer の後に走らせる。\input で取り込んだ表にも効くように)。
 *
 * 数値のセル = 右揃え(区切りの行の ---:)の列の、見出しの行を除くセルで、中身が数だけのもの
 * (1250・1,250・-1250・△1250・1250.5。負の印は - − △ ▲)。
 *   - 印 num を付ける(<td class="num">)。数値のセルだけの見た目(数字の書体など)をデッキの style.css で決められる
 *   - 4 桁以上の整数部に 3 桁ごとのカンマを打つ(すでにカンマのある数はそのまま)
 * 本文の年・日付・番号や、表の左揃えの列(科目名など)・数字以外を含むセル(「5(6 月)」「4 月」)は数値のセルにしない。
 * 記法ではなく表示の整え方なので、原稿の書き方は変わらない(CLAUDE.md)。
 */
import type { Root, Table, TableCell, Text } from 'mdast'
import { visitParents } from 'unist-util-visit-parents'

const NUMBER = /^([-−△▲]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/

/** 数だけの文字か(カンマ付きでもよい) */
export const isNumber = (value: string) => NUMBER.test(value.trim())

/** 1250 → 1,250(カンマの無い整数部が 4 桁以上のとき。それ以外は undefined) */
export function withCommas(value: string): string | undefined {
  const m = value.trim().match(NUMBER)
  if (!m || m[2].includes(',') || m[2].length < 4) return undefined
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${m[3] ?? ''}`
}

export default function remarkTableNumbers() {
  return (tree: Root) => {
    visitParents(tree, 'table', (table: Table) => {
      const right = (table.align ?? []).map((a) => a === 'right')
      for (const row of table.children.slice(1)) {
        row.children.forEach((cell: TableCell, i) => {
          if (!right[i] || cell.children.length !== 1 || cell.children[0].type !== 'text') return
          const text = cell.children[0] as Text
          if (!isNumber(text.value)) return
          text.value = withCommas(text.value) ?? text.value
          cell.data = { ...cell.data, hProperties: { ...cell.data?.hProperties, className: ['num'] } }
        })
      }
    })
  }
}
