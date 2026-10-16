import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

type WithChildren = ReactElement<{ children?: ReactNode }>

const elements = (node: ReactNode) => Children.toArray(node).filter(isValidElement) as WithChildren[]

/**
 * GFM の表に、GFM に無いものを足す部品: 表の題(caption)と、最後の foot 行を合計の行(<tfoot>)にすること。
 * 合計の行は見出しと同じ書体になる(theme/base.css)ので、セルごとに ** を書かなくてよい。
 *
 *   <Table caption="残高試算表（単位：千円）" foot={1}>
 *
 *   | 借方残高 | 勘定科目 | 貸方残高 |
 *   | ---: | --- | ---: |
 *   | 1,250 | 現金預金 | |
 *   | 3,955 | 合計 | 3,955 |
 *
 *   </Table>
 *
 * 中身は GFM の表 1 つ(前後に空行)。表が無い・2 つ以上ある、foot が本文の行の数を超えるときはエラー(補わない)。
 */
export default function Table({ caption, foot = 0, children }: { caption?: string; foot?: number; children?: ReactNode }) {
  const tables = elements(children).filter((e) => e.type === 'table')
  if (tables.length !== 1) throw new Error(`<Table> の中には GFM の表を 1 つだけ書いてください(${tables.length} 個あります)`)
  const parts = elements(tables[0].props.children)
  const head = parts.find((p) => p.type === 'thead')
  const body = parts.find((p) => p.type === 'tbody')
  const rows = body ? elements(body.props.children) : []
  if (!Number.isInteger(foot) || foot < 0 || foot > rows.length) {
    throw new Error(`<Table foot={${foot}}> は本文の行の数(${rows.length})以下の 0 以上の整数にしてください`)
  }
  const split = rows.length - foot
  return (
    <table>
      {caption !== undefined && <caption>{caption}</caption>}
      {head}
      {split > 0 && <tbody>{rows.slice(0, split)}</tbody>}
      {foot > 0 && <tfoot>{rows.slice(split)}</tfoot>}
    </table>
  )
}
