import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Table from './Table'

// MDX が GFM の表から作るのと同じ形(<table><thead/><tbody/></table>)
const gfm = (
  <table>
    <thead>
      <tr><th>科目</th><th>金額</th></tr>
    </thead>
    <tbody>
      <tr><td>現金</td><td>1,250</td></tr>
      <tr><td>売掛金</td><td>880</td></tr>
      <tr><td>合計</td><td>2,130</td></tr>
    </tbody>
  </table>
)

describe('<Table>', () => {
  it('最後の foot 行を合計の行(<tfoot>)にし、表の題を付ける', () => {
    const html = renderToStaticMarkup(<Table caption="残高" foot={1}>{gfm}</Table>)
    expect(html).toContain('<caption>残高</caption>')
    expect(html).toMatch(/<tbody><tr><td>現金<\/td>.*<td>売掛金<\/td>.*<\/tbody><tfoot><tr><td>合計<\/td><td>2,130<\/td><\/tr><\/tfoot>/)
  })

  it('foot を書かなければ GFM の表のまま', () => {
    const html = renderToStaticMarkup(<Table>{gfm}</Table>)
    expect(html).not.toContain('<tfoot>')
    expect(html).not.toContain('<caption>')
  })

  it('表が無い・foot が行の数を超えるときはエラー', () => {
    expect(() => renderToStaticMarkup(<Table>本文</Table>)).toThrow('1 つだけ')
    expect(() => renderToStaticMarkup(<Table foot={4}>{gfm}</Table>)).toThrow('foot={4}')
  })
})
