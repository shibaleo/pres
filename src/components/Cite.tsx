import { order, entries } from 'virtual:bibliography'

/**
 * 文献引用と文献リスト。番号はデッキ全体の初出順(vite/citations.ts が採番)。
 * 本文では `[@key]` と書けば remark が <Cite keys="key" /> に変換するので、直接書く必要はない。
 */

const numberOf = (key: string) => order.indexOf(key) + 1

/** 本文中の [1] / [1, 2]。ホバーで文献を表示 */
export function Cite({ keys }: { keys: string }) {
  const list = keys.split(';')
  const nums = list.map((k) => (entries[k] ? String(numberOf(k)) : '?'))
  const title = list.map((k) => entries[k]?.text ?? `未登録の文献: ${k}`).join('\n')
  return (
    <span className="cite" title={title}>
      [{nums.join(', ')}]
    </span>
  )
}

/** 引用された文献だけを、番号順に一覧表示する */
export function Bibliography() {
  return (
    <ol className="bibliography">
      {order
        .filter((k) => entries[k])
        .map((k) => (
          <li key={k} value={numberOf(k)} dangerouslySetInnerHTML={{ __html: entries[k].html }} />
        ))}
    </ol>
  )
}
