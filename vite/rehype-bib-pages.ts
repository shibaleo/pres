/**
 * 文献リストが 1 枚に収まらないとき、続きのスライドへ送る(rehype-citation の後に走らせる)。
 * Beamer の \begin{frame}[allowframebreaks] と同じ考え方: 続きのスライドは同じ題に「（続き）」を付け、
 * 元のスライドのすぐ後に、同じ節の縦の続き(--)として並べる。文献の番号と、引用からのリンク先(#bib-key)は変わらない。
 *
 * スライドの組版はブラウザがするので、ビルドの時点では高さを測れない。項目ごとに文字数から行数を見積もり、
 * 1 枚に入る行数(最小サイズのスライドから計算)を超えないように分ける。見積もりは控えめにしてあり、
 * 実際に収まったかは、はみ出しの検査(src/devtools/overflow.ts・e2e/overflow.spec.ts)が確かめる。
 */
import type { Element, ElementContent, Root, RootContent } from 'hast'

type Jsx = {
  type: 'mdxJsxFlowElement'
  name: string | null
  attributes: { type: string; name?: string; value?: unknown }[]
  children: (ElementContent | Jsx)[]
  position?: unknown
}
type Node = RootContent | ElementContent | Jsx

export type BibPagesOptions = {
  /** 最小サイズのスライドの幅と高さ(論理座標の px) */
  width: number
  height: number
  /** 本文の文字の大きさと行送り(px) */
  textBase: number
  line: number
  /** 文字の段階の比(tokens.css の --type-ratio)。<small> の中の文献リストは 1 段小さく組まれる */
  typeRatio: number
}

/** 続きのスライドの題に付ける語(Beamer の \insertcontinuationtext に当たる) */
export const CONTINUATION = '（続き）'

const isJsx = (n: Node, name: string): n is Jsx => n.type === 'mdxJsxFlowElement' && (n as Jsx).name === name
const hasClass = (n: Node, cls: string): n is Element => {
  const c = n.type === 'element' ? n.properties?.className : undefined
  return Array.isArray(c) && c.includes(cls)
}
/** test に合う最初のノードまでの道(n から順に) */
function pathTo(n: Node, test: (n: Node) => boolean): Node[] | undefined {
  if (test(n)) return [n]
  for (const c of 'children' in n ? (n.children as Node[]) : []) {
    const rest = pathTo(c, test)
    if (rest) return [n, ...rest]
  }
}
const isSmall = (n: Node) => (n.type === 'element' && n.tagName === 'small') || isJsx(n, 'small')
function textOf(n: Node): string {
  if (n.type === 'text') return n.value
  return 'children' in n ? (n.children as Node[]).map(textOf).join('') : ''
}
const getAttr = (el: Jsx, name: string) => el.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === name)?.value
function setAttr(el: Jsx, name: string, value: string | undefined) {
  el.attributes = el.attributes.filter((a) => !(a.type === 'mdxJsxAttribute' && a.name === name))
  if (value !== undefined) el.attributes.push({ type: 'mdxJsxAttribute', name, value })
}

export default function rehypeBibPages(options: BibPagesOptions) {
  const { width, height, textBase, line, typeRatio } = options
  const space = line / 2
  // 文献リストに使える高さ: 上下の余白(各 1 行)、題の帯(本文の 1.25 行分。実測)、箱の上下の余白と前後の間隔(計 3 × --space)を除く。
  // 余白と間隔は本文の行を単位にした固定の長さなので、文献リストを小さく組んでも変わらない
  const available = height - 2 * line - 1.25 * line - 3 * space

  /** 文字の大きさ(scale は本文に対する比)ごとの、1 行の字数と 1 枚に入る行数 */
  const metrics = (scale: number) => {
    const size = textBase * scale
    // 1 行の幅: スライドの左右の余白(各 1 行)、箱の左右の余白(各 --space)、番号の列(約 2 字)を除く
    const lineWidth = width - 2 * line - 2 * space - 2 * size
    const lineEm = lineWidth / size
    /**
     * 文字列の行数の見積もり。ブラウザと同じく語の切れ目(空白)で折り返し、1 行に入らない長い語(URL など)は
     * 行の幅で折る(base.css の overflow-wrap)。字幅は和文 1em、欧文 0.5em(New Computer Modern の平均は約 0.46em。
     * 欧文の幅の広い書体にも余裕を持たせる)。speech デッキの文献 46 件で、実際の行数を下回らないことを確かめた
     */
    const linesOf = (s: string) => {
      const emOf = (w: string) => [...w].reduce((sum, ch) => sum + (ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.5), 0)
      let lines = 1
      let cur = 0
      for (const word of s.trim().split(/\s+/)) {
        const em = emOf(word)
        const add = (cur > 0 ? 0.5 : 0) + em
        if (cur > 0 && cur + add > lineEm) {
          lines++
          cur = em
        } else cur += add
        while (cur > lineEm) {
          lines++
          cur -= lineEm
        }
      }
      return lines
    }
    return { linesOf, linesPerSlide: Math.floor(available / (line * scale)) }
  }

  return (tree: Root) => {
    visitSlides(tree.children as Node[], (slide, siblings) => {
      const path = pathTo(slide, (n) => hasClass(n, 'csl-bib-body'))
      if (!path) return
      const body = path.at(-1) as Element
      const entries = body.children.filter((c) => hasClass(c, 'csl-entry'))
      // 原稿で <small> の中に置いた文献リストは 1 段小さい文字で組まれる(base.css の small)
      const scale = path.some(isSmall) ? 1 / typeRatio : 1
      const { linesOf, linesPerSlide } = metrics(scale)
      // 題と文献リストの他に書いたもの(説明の文など。本文の大きさ)の高さを、1 枚目から引く
      const others = slide.children.filter((c) => c.type === 'element' && c.tagName !== 'h2' && c !== path[1])
      const otherHeight = others.reduce((sum, c) => sum + (metrics(1).linesOf(textOf(c as Node)) + 1) * line, 0)
      const firstBudget = Math.floor((available - otherHeight) / (line * scale))

      const pages: Element[][] = [[]]
      let used = 0
      for (const entry of entries) {
        const lines = linesOf(textOf(entry))
        const budget = pages.length === 1 ? firstBudget : linesPerSlide
        if (pages[pages.length - 1].length > 0 && used + lines > budget) {
          pages.push([])
          used = 0
        }
        pages[pages.length - 1].push(entry)
        used += lines
      }
      if (pages.length === 1) return

      body.children = pages[0]
      const title = slide.children.find((c) => c.type === 'element' && c.tagName === 'h2') as Element | undefined
      const continued = pages.slice(1).map((page) => {
        const copy: Jsx = { ...slide, attributes: slide.attributes.map((a) => ({ ...a })), children: [] }
        // ラベル(id)は最初の 1 枚だけのもの。段は無い。遷移は節の中の続きと同じ(元が続きのスライドならその遷移)
        setAttr(copy, 'id', undefined)
        setAttr(copy, 'steps', '1')
        // 続きのスライドの印(題と節番号は元のスライドと同じ。新しい節ではない)
        setAttr(copy, 'data-continuation', '')
        if (getAttr(slide, 'v') === '0') setAttr(copy, 'transition', undefined)
        if (title) copy.children.push({ ...title, children: [...title.children, { type: 'text', value: CONTINUATION }] })
        // 文献リストを包むもの(<small> など)ごと写す
        copy.children.push(rebuild(path.slice(1), page) as Jsx)
        return copy
      })
      siblings.insert(continued)
    })
  }
}

/** 道(スライドの子から文献リストまで)を写し、文献リストの項目だけ入れ替える。写した文献リストの id は外す(1 つだけにする) */
function rebuild(path: Node[], page: Element[]): Node {
  const [head, ...rest] = path
  if (rest.length === 0) {
    const body = head as Element
    return { ...body, properties: { ...body.properties, id: undefined }, children: page }
  }
  return { ...(head as Element), children: [rebuild(rest, page)] } as Node
}

/**
 * デッキの各スライドを訪ねる。スライドは文書の直下の <Slide>(横の 1 枚)か、<Stack>(縦の続き)の中の <Slide>。
 * insert は訪ねているスライドの後ろに続きのスライドを入れ、縦の位置(v)を振り直す
 * (横の 1 枚だったスライドは <Stack> に包んで縦の続きにする)
 */
function visitSlides(top: Node[], visit: (slide: Jsx, siblings: { insert: (slides: Jsx[]) => void }) => void) {
  for (let i = 0; i < top.length; i++) {
    const node = top[i]
    if (isJsx(node, 'Slide')) {
      visit(node, {
        insert: (slides) => {
          const all = [node, ...slides]
          all.forEach((s, v) => setAttr(s, 'v', String(v)))
          top[i] = { type: 'mdxJsxFlowElement', name: 'Stack', attributes: [], children: all }
        },
      })
    } else if (isJsx(node, 'Stack')) {
      const stack = node.children as Node[]
      for (let j = 0; j < stack.length; j++) {
        const slide = stack[j]
        if (!isJsx(slide, 'Slide')) continue
        visit(slide, {
          insert: (slides) => {
            stack.splice(j + 1, 0, ...slides)
            let v = 0
            for (const s of stack) if (isJsx(s, 'Slide')) setAttr(s, 'v', String(v++))
            j += slides.length
          },
        })
      }
    }
  }
}
