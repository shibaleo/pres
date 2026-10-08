/**
 * スライド原稿(MDX + Beamer 風記法)を、MDX がパースできる形に変換する純粋関数群。
 *
 * MDX では `{…}` が JS 式、`<…` が JSX として解釈されるため、`\cite{key}` や `<2->` は
 * MDX が読む前にソース文字列のまま置き換える必要がある。ここではその変換と、
 * デッキ全体の番号付け(定理・式・文献)に必要な情報の抽出を行う。
 *
 * 変換しない範囲(保護範囲): フェンスコード、バッククォート(インラインコード・テンプレート文字列)、
 * 数式($…$, $$…$$, \begin{equation}…)。数式の中の \begin{CD} などはそのまま KaTeX に渡る。
 */

// ---------- 定義 ----------

/** 定理型の環境(1 本の通し番号を共有する) */
export const THEOREM_ENVS: Record<string, string> = {
  theorem: 'Theorem',
  lemma: 'Lemma',
  proposition: 'Proposition',
  corollary: 'Corollary',
  definition: 'Definition',
}
const ENV_TAGS: Record<string, string> = { ...THEOREM_ENVS, proof: 'Proof' }
const THEOREM_TAGS = Object.values(THEOREM_ENVS)

/** 番号付きの項目(定理または式)。id はチャンク内で一意 */
export type NumberedItem = { id: string; kind: 'thm' | 'eq'; label?: string }

export type ChunkInfo = {
  /** MDX に渡すソース */
  code: string
  /** 出現順の引用 key(重複あり) */
  cites: string[]
  /** 出現順の番号付き項目 */
  items: NumberedItem[]
  /** \ref / \eqref で参照された key */
  refs: string[]
  /** 位置の分からない \label など、利用者に知らせたい問題 */
  warnings: string[]
}

// ---------- 保護範囲 ----------

const PROTECT_RE = new RegExp(
  [
    '```[\\s\\S]*?```', // フェンスコード
    '`[^`]*`', // インラインコード / テンプレート文字列
    '\\\\begin\\{(?:equation|align)\\*?\\}[\\s\\S]*?\\\\end\\{(?:equation|align)\\*?\\}', // 数式環境
    '\\$\\$[\\s\\S]*?\\$\\$', // ディスプレイ数式
    '(?<!\\\\)\\$[^$\\n]+?\\$', // インライン数式
  ].join('|'),
  'g',
)
const PH = (i: number) => `${i}`
const PH_RE = /(\d+)/g

/** 保護範囲を記号に置き換える。戻すときは restore を使う */
function protect(src: string): { text: string; segs: string[] } {
  const segs: string[] = []
  const text = src.replace(PROTECT_RE, (m) => {
    segs.push(m)
    return PH(segs.length - 1)
  })
  return { text, segs }
}

// ---------- チャンク分割 ----------

/**
 * 1 ファイルを `---` だけの行でスライドに分割する(コード内の --- は無視)。
 * import 文はファイル全体で共有するので、全チャンクの先頭に複製する。
 * 区切りが無ければ 1 枚。空のチャンク(先頭の --- など)は捨てる。
 */
export function splitSlides(src: string): string[] {
  const { text, segs } = protect(src.replace(/\r\n/g, '\n'))
  const restore = (s: string) => s.replace(PH_RE, (_m, i) => segs[Number(i)])

  const imports: string[] = []
  const body = text.replace(/^import\s[^\n]*\n?/gm, (m) => {
    imports.push(m.trimEnd())
    return ''
  })
  return body
    .split(/^---[ \t]*$/m)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .map((c) => restore([...imports, '', c].join('\n').trim() + '\n'))
}

// ---------- 段階表示(overlay)の指定 ----------

/**
 * Beamer の overlay 指定 `<2->` `<2>` `<2-3>` `<-3>` `<+->` `<+>`。
 * from 未満と to より後は非表示。`+` は「次のステップ」。
 */
const SPEC_RE = /^(\+|\d+)?(-)?(\d+)?$/

type Spec = { from: number; to?: number }

class Steps {
  cur = 1
  max = 1
  parse(spec: string): Spec | null {
    const m = spec.match(SPEC_RE)
    if (!m || (!m[1] && !m[3])) return null
    const from = m[1] === '+' ? this.cur++ : m[1] ? Number(m[1]) : 1
    const to = m[3] ? Number(m[3]) : m[2] ? undefined : from
    this.max = Math.max(this.max, from, to ?? 0)
    return { from, to }
  }
  pause(): number {
    this.cur += 1
    this.max = Math.max(this.max, this.cur)
    return this.cur
  }
}

/** Overlay の開始タグ。to は最後に max と比べて要否を決めるので仮の記号にしておく */
function overlayOpen({ from, to }: Spec, extra = ''): string {
  return `<Overlay from={${from}}${to !== undefined ? ` to={${to}}` : ''}${extra}>`
}
function finalizeOverlays(code: string, max: number): string {
  // to が最後のステップ以降なら「消える」ステップは存在しないので指定を外す
  return code.replace(/ to=\{(\d+)\}/g, (_m, n) => (Number(n) < max ? ` to={${n}}` : ''))
}

// ---------- 中括弧付きコマンド ----------

/** text 中の pos が `{` を指すとき、対応する `}` の位置を返す */
function matchBrace(text: string, pos: number): number {
  let depth = 0
  for (let i = pos; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return i
  }
  return -1
}

/** `\only<spec>{…}` 型のコマンドを、中身を再帰的に変換しながら置き換える */
function replaceOverlayCommands(text: string, steps: Steps, warn: (m: string) => void): string {
  const re = /\\(only|uncover|visible|onslide)<([^>]*)>\{/g
  let out = ''
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const open = m.index + m[0].length - 1
    const close = matchBrace(text, open)
    if (close < 0) {
      warn(`\\${m[1]} の } が閉じていません`)
      break
    }
    const spec = steps.parse(m[2])
    const inner = replaceOverlayCommands(text.slice(open + 1, close), steps, warn)
    out += text.slice(last, m.index)
    if (!spec) {
      warn(`\\${m[1]}<${m[2]}> の指定を解釈できません`)
      out += inner
    } else {
      const only = m[1] === 'only' ? ' only' : ''
      // 行全体がこのコマンドだけなら段落として(div)、文中なら span で包む
      const lineStart = /(^|\n)[ \t]*$/.test(text.slice(0, m.index))
      const lineEnd = /^[ \t]*(\n|$)/.test(text.slice(close + 1))
      const as = lineStart && lineEnd ? '' : ' as="span"'
      out += `${overlayOpen(spec, `${as}${only}`)}${inner}</Overlay>`
    }
    last = close + 1
    re.lastIndex = close + 1
  }
  return out + text.slice(last)
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

// ---------- 本体 ----------

/** 1 枚分のソースを変換する。key はチャンクの識別子(番号付き項目の id の接頭辞) */
export function transformChunk(src: string, key: string): ChunkInfo {
  const warnings: string[] = []
  const warn = (m: string) => warnings.push(m)
  const { text, segs } = protect(src.replace(/\r\n/g, '\n'))
  const steps = new Steps()

  // (1) 行単位: 環境の開始/終了、\pause、箇条書きの overlay
  type Frame = { tag?: string; overlay: boolean; pauses: number; jsx?: boolean }
  const stack: Frame[] = [{ overlay: false, pauses: 0 }]
  const closePauses = (f: Frame) => '\n\n</Overlay>\n'.repeat(f.pauses)
  const lines: string[] = []
  for (const line of text.split('\n')) {
    const begin = line.match(/^\s*\\begin\{(\w+)\}(?:<([^>]*)>)?(?:\[([^\]]*)\])?\s*(\\label\{[^}]+\})?\s*$/)
    if (begin && ENV_TAGS[begin[1]]) {
      const tag = ENV_TAGS[begin[1]]
      const spec = begin[2] !== undefined ? steps.parse(begin[2]) : null
      if (begin[2] !== undefined && !spec) warn(`\\begin{${begin[1]}}<${begin[2]}> の指定を解釈できません`)
      const attr = begin[3] ? (tag === 'Proof' ? ` heading="${escapeAttr(begin[3])}"` : ` title="${escapeAttr(begin[3])}"`) : ''
      lines.push(`\n${spec ? overlayOpen(spec) + '\n\n' : ''}<${tag}${attr}>\n`)
      if (begin[4]) lines.push(begin[4])
      stack.push({ tag, overlay: !!spec, pauses: 0 })
      continue
    }
    const end = line.match(/^\s*\\end\{(\w+)\}\s*$/)
    if (end && ENV_TAGS[end[1]]) {
      const top = stack[stack.length - 1]
      if (stack.length === 1 || top.tag !== ENV_TAGS[end[1]]) {
        warn(`\\end{${end[1]}} に対応する \\begin がありません`)
        continue
      }
      stack.pop()
      lines.push(`${closePauses(top)}\n</${top.tag}>${top.overlay ? '\n\n</Overlay>' : ''}\n`)
      continue
    }
    // 行単独の JSX タグ(<Col> … </Col> など)もブロックとして扱い、
    // その中の \pause は閉じタグの手前で閉じる(タグをまたいで入れ子が壊れないように)
    const jsxOpen = line.match(/^\s*<([A-Za-z][\w.]*)\b[^>]*[^/]>\s*$|^\s*<([A-Za-z][\w.]*)>\s*$/)
    if (jsxOpen) {
      stack.push({ tag: jsxOpen[1] ?? jsxOpen[2], overlay: false, pauses: 0, jsx: true })
      lines.push(line)
      continue
    }
    const jsxClose = line.match(/^\s*<\/([A-Za-z][\w.]*)>\s*$/)
    if (jsxClose) {
      const top = stack[stack.length - 1]
      if (stack.length > 1 && top.jsx && top.tag === jsxClose[1]) {
        stack.pop()
        lines.push(`${closePauses(top)}${line}`)
        continue
      }
    }
    if (/^\s*\\pause\s*$/.test(line)) {
      stack[stack.length - 1].pauses++
      lines.push(`\n${overlayOpen({ from: steps.pause() })}\n`)
      continue
    }
    const item = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)<([^>]*)>\s+(.*)$/)
    if (item) {
      const spec = steps.parse(item[2])
      if (spec) {
        lines.push(`${item[1]}${overlayOpen(spec, ' as="span" li')}${item[3]}</Overlay>`)
        continue
      }
    }
    lines.push(line)
  }
  while (stack.length > 1) {
    const f = stack.pop()!
    // JSX の閉じタグは同じ行に他の内容と書かれることもあるので、警告も補完もしない
    if (!f.jsx) {
      warn(`<${f.tag}> の \\end がありません`)
      lines.push(`${closePauses(f)}\n</${f.tag}>\n`)
    } else lines.push(closePauses(f))
  }
  let body = lines.join('\n') + closePauses(stack[0])

  // (2) 文中のコマンド
  body = replaceOverlayCommands(body, steps, warn)
  const cites: string[] = []
  body = body.replace(/\\cite(?:\[([^\]]*)\])?\{([^}]+)\}/g, (_all, note: string | undefined, keys: string) => {
    const list = keys.split(',').map((s) => s.trim()).filter(Boolean)
    cites.push(...list)
    const attrs = [`keys="${escapeAttr(list.join(';'))}"`]
    // LaTeX の ~ (改行しない空白) は NBSP に
    if (note) attrs.push(`note="${escapeAttr(note.replace(/~/g, ' '))}"`)
    return `<Cite ${attrs.join(' ')} />`
  })
  const refs: string[] = []
  body = body.replace(/\\(eq)?ref\{([^}]+)\}/g, (_all, eq: string | undefined, k: string) => {
    refs.push(k.trim())
    return `<Ref k="${escapeAttr(k.trim())}"${eq ? ' eq' : ''} />`
  })

  // (3) 番号付け: 定理タグ・\label・数式を出現順に走査する
  const items: NumberedItem[] = []
  const open: NumberedItem[] = []
  let t = 0
  let e = 0
  const tagAlt = THEOREM_TAGS.join('|')
  const scan = new RegExp(`<(${tagAlt})\\b([^>]*)>|</(${tagAlt})>|\\\\label\\{([^}]+)\\}|(\\d+)`, 'g')
  body = body.replace(scan, (all, openTag, attrs: string, closeTag, label, ph) => {
    if (openTag) {
      const item: NumberedItem = { id: `${key}:t${t++}`, kind: 'thm' }
      const idAttr = attrs.match(/\sid="([^"]+)"/)
      if (idAttr) item.label = idAttr[1]
      items.push(item)
      open.push(item)
      return `<${openTag} refId="${item.id}"${attrs}>`
    }
    if (closeTag) {
      open.pop()
      return all
    }
    if (label) {
      const target = open[open.length - 1]
      if (target) target.label = label.trim()
      else warn(`\\label{${label}} が定理・式の外にあります`)
      return ''
    }
    // 保護範囲: 番号付きの数式なら <Equation> に、番号なしの数式環境は $$ に
    const seg = segs[Number(ph)]
    const env = seg.match(/^\\begin\{(equation|align)(\*?)\}([\s\S]*?)\\end\{\1\*?\}$/)
    const display = seg.match(/^\$\$([\s\S]*)\$\$$/)
    const labelInSeg = seg.match(/\\label\{([^}]+)\}/)
    const numbered = (env && env[2] === '' && env[1] === 'equation') || (display && labelInSeg)
    if (env && !numbered) {
      // align / align* / equation* は番号なしの別行立て数式として KaTeX に渡す
      const name = env[1] === 'align' ? 'align*' : 'equation*'
      if (env[1] === 'align' && env[2] === '') warn('番号付きの align は未対応のため番号なしで表示します(equation を使ってください)')
      return `$$\n\\begin{${name}}${env[3].replace(/\\label\{[^}]+\}/g, '')}\\end{${name}}\n$$`
    }
    if (!numbered) return seg
    const tex = (env ? env[3] : display![1]).replace(/\\label\{[^}]+\}/g, '').trim()
    const item: NumberedItem = { id: `${key}:e${e++}`, kind: 'eq' }
    if (labelInSeg) item.label = labelInSeg[1].trim()
    items.push(item)
    return `\n\n<Equation refId="${item.id}" tex={${JSON.stringify(tex)}} />\n\n`
  })

  // (4) 保護範囲を戻し、段階表示のステップ数を確定する
  body = body.replace(PH_RE, (_m, i) => segs[Number(i)])
  body = finalizeOverlays(body, steps.max)
  if (steps.max >= 2) body += `\n\n<OverlaySteps max={${steps.max}} />\n`
  return { code: body, cites, items, refs, warnings }
}
