/**
 * デッキ(src/slides.mdx と \input で取り込むファイル)を実際に描いて、出来上がりを確かめる。
 * 開発時と同じ Vite の設定で原稿を読み込み、サーバー側の描画(renderToStaticMarkup)で HTML にする
 * (useEffect は走らないので、図の動き(自転など)には依存しない)。番号・参照・構造はすべて
 * ビルド時に決まるので、ここで描いた HTML がそのままブラウザに出るものと同じになる。
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Slides, { deckWarnings } from '../slides.mdx'
import { mdxComponents } from './mdx-components'
import { slideTitle } from './slide-title'

const html = renderToStaticMarkup(<Slides components={mdxComponents} />)
const root = document.createElement('div')
root.innerHTML = html

/** reveal と同じ並び: 横のスライド(h)と、縦のスライドの束の中の位置(v) */
type Leaf = { h: number; v: number; el: Element }
const top = [...root.children].filter((c) => c.tagName === 'SECTION')
const isStack = (s: Element) => s.querySelector(':scope > section') !== null
const leaves: Leaf[] = top.flatMap((s, h) =>
  isStack(s) ? [...s.children].filter((c) => c.tagName === 'SECTION').map((el, v) => ({ h, v, el })) : [{ h, v: 0, el: s }],
)
const where = (l: Leaf) => `#/${l.h}/${l.v}(${l.el.getAttribute('data-slide-file') ?? 'slides.mdx'}:${l.el.getAttribute('data-slide-line')})`
/** スライドの題の見出し(先頭の h2)。無ければ null */
const titleHeading = (l: Leaf) => {
  const first = l.el.firstElementChild
  return first?.tagName === 'H2' ? first : null
}

describe('デッキの描画', () => {
  it('原稿に警告が無い', () => {
    expect(deckWarnings).toEqual([])
  })

  it('スライドの並び: 最上位は section(横のスライド・縦の束)と MathJax のスタイルだけ', () => {
    // MathJax の字形の定義(fontCache: 'global' の隠れた <svg id="MJX-SVG-global-cache">)も最上位に 1 つ
    const kind = (c: Element) => (c.id === 'MJX-SVG-global-cache' ? 'GLYPHS' : c.tagName)
    // React 19 のサーバー側の描画は画像の先読み(<link rel="preload">)を先頭に足す。ブラウザでの描画には無いので数えない
    const preload = (c: Element) => c.tagName === 'LINK' && c.getAttribute('rel') === 'preload'
    for (const c of root.children) if (!preload(c)) expect(['SECTION', 'STYLE', 'GLYPHS'], c.outerHTML.slice(0, 80)).toContain(kind(c))
    expect([...root.children].filter((c) => kind(c) === 'GLYPHS').length).toBe(1)
    expect(leaves.length).toBeGreaterThan(1)
    // 縦の束の中にさらに束は無い(reveal は 2 段まで)
    for (const l of leaves) expect(isStack(l.el), where(l)).toBe(false)
  })

  it('各スライドに原稿の位置(data-slide-line)が付く', () => {
    for (const l of leaves) expect(l.el.getAttribute('data-slide-line'), where(l)).toMatch(/^\d+$/)
  })

  describe('節番号', () => {
    it('スライドの題に、横は「N.」、縦の 2 枚目以降は「N.M.」が文書順に振られる', () => {
      let sec = 0
      let sub = 0
      let checked = 0
      for (const l of leaves) {
        if (l.v === 0) sub = 0
        const h2 = titleHeading(l)
        if (!h2) {
          expect(l.el.querySelector('.secnum'), `${where(l)}: 題の無いスライドに番号`).toBeNull()
          continue
        }
        const expected = l.v === 0 ? `${++sec}.` : `${sec}.${++sub}.`
        expect(h2.querySelector('.secnum')?.textContent?.trim(), where(l)).toBe(expected)
        checked++
      }
      expect(checked).toBeGreaterThan(5)
    })

    it('番号はスライドの題にだけ付く(1 枚に 1 つ)', () => {
      for (const l of leaves) {
        const nums = l.el.querySelectorAll('.secnum')
        expect(nums.length, where(l)).toBe(titleHeading(l) ? 1 : 0)
      }
    })

    it('表紙(h1)には番号を振らない', () => {
      const h1 = root.querySelector('h1')
      expect(h1).not.toBeNull()
      expect(h1!.querySelector('.secnum')).toBeNull()
    })
  })

  describe('メニュー', () => {
    it('メニューの題はスライドの見出しの文字と一致する(節番号を含む)', () => {
      for (const l of leaves) {
        const heading = l.el.querySelector('h1,h2,h3,h4')
        const title = slideTitle(l.el)
        if (!heading) {
          expect(title, where(l)).toBe('(無題)')
          continue
        }
        expect(title, where(l)).toBe(heading.textContent!.trim())
        const num = titleHeading(l)?.querySelector('.secnum')?.textContent?.trim()
        if (num) expect(title.startsWith(`${num} `), where(l)).toBe(true)
      }
    })

    it('題の無いスライドが無い', () => {
      for (const l of leaves) expect(slideTitle(l.el), where(l)).not.toBe('(無題)')
    })
  })

  describe('定理環境', () => {
    it('定理・定義などの番号はデッキ全体の通し番号(1 から順に)', () => {
      const nums = [...root.querySelectorAll('.thm > .thm-head')].map((e) => Number(e.textContent!.match(/^\S+ (\d+)/)?.[1]))
      expect(nums.length).toBeGreaterThan(0)
      expect(nums).toEqual(nums.map((_, i) => i + 1))
    })

    it('見出しと本文の 2 段で描かれる', () => {
      for (const thm of root.querySelectorAll('.thm')) {
        expect(thm.querySelector(':scope > .thm-head'), thm.textContent!).not.toBeNull()
        expect(thm.querySelector(':scope > .thm-body'), thm.textContent!).not.toBeNull()
      }
    })

    it('Frame も見出し(あれば)と本文の 2 段', () => {
      for (const f of root.querySelectorAll('.frame')) {
        const kids = [...f.children].map((c) => c.className)
        expect(kids.at(-1), f.textContent!).toBe('frame-body')
        expect(kids.filter((k) => k !== 'frame-title' && k !== 'frame-body'), f.textContent!).toEqual([])
      }
    })
  })

  describe('参照', () => {
    it('\\ref の未解決(??)が無い', () => {
      expect(root.textContent).not.toContain('??')
    })

    it('式の参照(\\eqref)はすべて存在する式の番号へリンクする', () => {
      const links = [...root.querySelectorAll('mjx-container a[href^="#mjx-eqn"]')]
      expect(links.length).toBeGreaterThan(0)
      for (const a of links) {
        const id = decodeURIComponent(a.getAttribute('href')!.slice(1))
        expect(root.querySelector(`[id="${id}"]`), id).not.toBeNull()
      }
    })

    it('スライドへのリンク(#/h/v)は存在するスライドを指す', () => {
      for (const a of root.querySelectorAll('a[href^="#/"]')) {
        const [h, v = 0] = a.getAttribute('href')!.slice(2).split('/').map(Number)
        expect(leaves.some((l) => l.h === h && l.v === v), a.getAttribute('href')!).toBe(true)
      }
    })
  })

  describe('数式', () => {
    it('数式の字形の参照(<use>)は、すべて字形の定義の中にある', () => {
      const glyphs = root.querySelector('#MJX-SVG-global-cache')!
      const uses = [...root.querySelectorAll('mjx-container use')]
      expect(uses.length).toBeGreaterThan(0)
      for (const u of uses) {
        const ref = (u.getAttribute('xlink:href') ?? u.getAttribute('href'))!.slice(1)
        expect(glyphs.querySelector(`[id="${ref}"]`), ref).not.toBeNull()
      }
    })

    it('各数式に MathML(assistive MathML)が添えられ、それを画面から隠すスタイルがある', () => {
      const containers = [...root.querySelectorAll('mjx-container')]
      expect(containers.length).toBeGreaterThan(0)
      for (const m of containers) {
        expect(m.querySelector(':scope > mjx-assistive-mml > math'), m.outerHTML.slice(0, 80)).not.toBeNull()
        expect(m.querySelector(':scope > svg')?.getAttribute('aria-hidden')).toBe('true')
      }
      const css = [...root.querySelectorAll('style')].map((s) => s.textContent).join('\n')
      expect(css).toMatch(/mjx-assistive-mml\s*\{[^}]*clip:/)
    })

    it('誤りのある数式(merror)が無い', () => {
      expect(root.querySelector('[data-mjx-error]')).toBeNull()
    })

    it('未解決の参照(MathJax の ???)が無い', () => {
      expect(html).not.toContain('TEX-N-3F')
    })

    it('数式はすべて SVG に描かれている(remark-math の <code> が残っていない)', () => {
      expect(root.querySelector('code.math-inline, code.math-display')).toBeNull()
      for (const m of root.querySelectorAll('mjx-container')) expect(m.querySelector('svg')).not.toBeNull()
    })
  })

  describe('文献', () => {
    it('引用の番号は文献リストでの順番と一致し、リンク先が存在する', () => {
      const entries = [...root.querySelectorAll('.csl-bib-body')][0]?.querySelectorAll('.csl-entry') ?? []
      const order = [...entries].map((e) => e.id)
      const cites = [...root.querySelectorAll('a[href^="#bib-"]')]
      expect(cites.length).toBeGreaterThan(0)
      for (const a of cites) {
        const id = a.getAttribute('href')!.slice(1)
        expect(order, id).toContain(id)
        expect(a.textContent, id).toBe(String(order.indexOf(id) + 1))
      }
    })
  })

  describe('HTML の構造', () => {
    it('表の行は表の中にだけあり、段落に包まれていない', () => {
      for (const tr of root.querySelectorAll('tr')) expect(['TABLE', 'THEAD', 'TBODY', 'TFOOT']).toContain(tr.parentElement!.tagName)
      for (const t of root.querySelectorAll('table, thead, tbody')) {
        for (const c of t.children) expect(['THEAD', 'TBODY', 'TFOOT', 'TR', 'CAPTION', 'COLGROUP'], c.outerHTML.slice(0, 60)).toContain(c.tagName)
      }
    })

    it('段落の中に段落やブロック要素が入っていない', () => {
      for (const p of root.querySelectorAll('p')) {
        expect(p.querySelector('p, div, section, table, ul, ol, dl, pre, h1, h2, h3, h4'), p.outerHTML.slice(0, 80)).toBeNull()
      }
    })

    it('画像には src がある', () => {
      for (const img of root.querySelectorAll('img')) expect(img.getAttribute('src'), img.outerHTML).toBeTruthy()
    })
  })

  describe('段階表示', () => {
    it('各スライドの fragment の番号は 0 から欠けなく続く(Beamer のステップと揃う)', () => {
      for (const l of leaves) {
        const idx = [...l.el.querySelectorAll('[data-fragment-index]')].map((e) => Number(e.getAttribute('data-fragment-index')))
        if (idx.length === 0) continue
        const steps = [...new Set(idx)].sort((a, b) => a - b)
        expect(steps, where(l)).toEqual(steps.map((_, i) => i))
      }
    })
  })
})
