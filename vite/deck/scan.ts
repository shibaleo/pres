/**
 * スライド原稿(MDX + Beamer 風記法)を、MDX がパースできる形に変換する純粋関数群。
 *
 * MDX では `{…}` が JS 式、`<…` が JSX として解釈されるため、`\cite{key}` や `<2->` は
 * MDX が読む前にソース文字列のまま置き換える必要がある。ここではその変換と、
 * デッキ全体の番号付け(定理・式・文献)に必要な情報の抽出、記法エラーの検出を行う。
 *
 * 変換しない範囲(保護範囲): フェンスコード、バッククォート(インラインコード・テンプレート文字列)、
 * 数式($…$, $$…$$, \begin{equation|align|gather}…)。数式は KaTeX で構文を検査する。
 *
 * 行番号: 変換は行数を変えないように行う(増える行は lineMap で元の行に対応づける)。
 * エラーメッセージや MDX のコンパイルエラーを、元の原稿の行番号で報告するため。
 */
import katex from 'katex'

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
/** 別行立て数式の環境。* なしは行ごとに番号が付く */
const MATH_ENVS = ['equation', 'align', 'gather']

/** 番号付きの項目(定理または式の 1 行)。id はチャンク内で一意 */
export type NumberedItem = { id: string; kind: 'thm' | 'eq'; label?: string; line: number }

/** 記法の問題。line は元の原稿の行番号(1 始まり) */
export type Diagnostic = { level: 'error' | 'warning'; message: string; line: number }

/** 1 枚分の原稿。lines[i] = i 行目(0 始まり)の、元ファイルでの行番号(1 始まり) */
export type SlideSource = { source: string; lines: number[] }

export type ChunkInfo = {
  /** MDX に渡すソース */
  code: string
  /** code の各行(0 始まり)に対応する元ファイルの行番号(1 始まり) */
  lineMap: number[]
  /** 出現順の引用 key(重複あり) */
  cites: { key: string; line: number }[]
  /** 出現順の番号付き項目 */
  items: NumberedItem[]
  /** \ref / \eqref で参照された key */
  refs: { key: string; line: number }[]
  diagnostics: Diagnostic[]
}

// ---------- 保護範囲 ----------

const PROTECT_RE = new RegExp(
  [
    '```[\\s\\S]*?```', // フェンスコード
    '`[^`]*`', // インラインコード / テンプレート文字列
    `\\\\begin\\{(?:${MATH_ENVS.join('|')})\\*?\\}[\\s\\S]*?\\\\end\\{(?:${MATH_ENVS.join('|')})\\*?\\}`, // 数式環境
    '\\$\\$[\\s\\S]*?\\$\\$', // ディスプレイ数式
    '(?<!\\\\)\\$[^$\\n]+?\\$', // インライン数式
  ].join('|'),
  'g',
)
/**
 * 保護範囲の置き換え記号。中身の改行と同じ数だけ「 + 改行」を後ろに付けて、行数を保つ。
 * (行単位の処理で行番号がずれないように)
 */
const PH = (i: number, newlines: number) => `${i}` + '\n'.repeat(newlines)
const PH_RE = /(\d+)((?:\n)*)/g

type Segment = { text: string; line: number }

/** 保護範囲を記号に置き換える。line は保護範囲の開始行(0 始まり) */
function protect(src: string): { text: string; segs: Segment[] } {
  const segs: Segment[] = []
  let line = 0
  let last = 0
  const text = src.replace(PROTECT_RE, (m, offset: number) => {
    line += countLines(src.slice(last, offset))
    last = offset
    segs.push({ text: m, line })
    return PH(segs.length - 1, countLines(m))
  })
  return { text, segs }
}
const restore = (text: string, segs: Segment[]) => text.replace(PH_RE, (_m, i) => segs[Number(i)].text)
const countLines = (s: string) => s.split('\n').length - 1

// ---------- チャンク分割 ----------

/**
 * 1 ファイルを `---` だけの行でスライドに分割する(コード内の --- は無視)。
 * import 文はファイル全体で共有するので、全チャンクの先頭に複製する(元の位置は空行にする)。
 * 区切りが無ければ 1 枚。空のチャンク(先頭の --- など)は捨てる。
 */
export function splitSlides(src: string): SlideSource[] {
  const { text, segs } = protect(src.replace(/\r\n/g, '\n'))
  const lines = text.split('\n')
  const imports: { text: string; line: number }[] = []
  lines.forEach((l, i) => {
    if (/^import\s/.test(l)) {
      imports.push({ text: l, line: i + 1 })
      lines[i] = ''
    }
  })
  const out: SlideSource[] = []
  let start = 0
  const flush = (end: number) => {
    const body = lines.slice(start, end)
    if (body.join('').trim() === '') return
    const head = imports.length ? [...imports.map((x) => x.text), ''] : []
    const map = imports.length ? [...imports.map((x) => x.line), imports[imports.length - 1].line] : []
    for (let i = start; i < end; i++) map.push(i + 1)
    out.push({ source: restore([...head, ...body].join('\n'), segs), lines: map })
  }
  lines.forEach((l, i) => {
    if (/^---[ \t]*$/.test(l)) {
      flush(i)
      start = i + 1
    }
  })
  flush(lines.length)
  return out
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

// ---------- 数式 ----------

/** 数式環境の 1 行。sep は行末の区切り(`\\` や `\\[4pt]`。最後の行は空) */
export type MathRow = { tex: string; sep: string; label?: string; numbered: boolean }

/**
 * align などの本文を、いちばん外側の `\\` で行に分ける。
 * 中括弧・\begin…\end の内側の `\\`(cases, \substack など)では分けない。% 以降はコメント。
 */
export function splitRows(body: string): { tex: string; sep: string }[] {
  const rows: { tex: string; sep: string }[] = []
  let depth = 0
  let start = 0
  let i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '%') {
      const nl = body.indexOf('\n', i)
      i = nl < 0 ? body.length : nl
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '\\') {
      if (body.startsWith('\\begin{', i)) depth++
      else if (body.startsWith('\\end{', i)) depth--
      else if (body[i + 1] === '\\' && depth === 0) {
        let j = i + 2
        const opt = body.slice(j).match(/^\s*\[[^\]]*\]/)
        if (opt) j += opt[0].length
        rows.push({ tex: body.slice(start, i), sep: body.slice(i, j) })
        start = i = j
        continue
      }
      i += 2 // \{ \} \% \\ などのエスケープを 1 文字として飛ばす
      continue
    }
    i++
  }
  rows.push({ tex: body.slice(start), sep: '' })
  return rows
}

/** 1 行から \label / \nonumber / \notag を取り出す。\tag があれば自動番号は付けない */
function parseRow(row: { tex: string; sep: string }, autoNumber: boolean): MathRow {
  const label = row.tex.match(/\\label\{([^}]+)\}/)?.[1].trim()
  const suppressed = /\\(nonumber|notag)\b/.test(row.tex)
  const explicitTag = /\\tag\*?\{/.test(row.tex)
  const tex = row.tex.replace(/\\label\{[^}]+\}/g, '').replace(/\\(nonumber|notag)\b/g, '')
  return { tex, sep: row.sep, label, numbered: autoNumber && !suppressed && !explicitTag && tex.trim() !== '' }
}

/** KaTeX で数式を検査する。誤りがあればメッセージを返す */
function checkTex(tex: string, displayMode: boolean): string | null {
  try {
    katex.renderToString(tex, { displayMode, throwOnError: true })
    return null
  } catch (e) {
    return e instanceof Error ? e.message.replace(/^KaTeX parse error: /, '') : String(e)
  }
}

/** <Equation> が描く TeX(実際の番号は実行時。検査用には仮の番号を入れる) */
export function equationTex(env: string, rows: { tex: string; sep: string; tag?: string }[]): string {
  const body = rows.map((r) => r.tex + (r.tag !== undefined ? `\\tag{${r.tag}}` : '') + r.sep).join('')
  return env === 'equation' ? body : `\\begin{${env}*}${body}\\end{${env}*}`
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

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

// ---------- 本体 ----------

/**
 * 1 枚分のソースを変換する。key はチャンクの識別子(番号付き項目の id の接頭辞)。
 * 文字列を渡したときは、行番号をそのまま 1 始まりで数える(テスト用)。
 */
export function transformChunk(slide: SlideSource | string, key: string): ChunkInfo {
  const { source, lines: srcLines } =
    typeof slide === 'string' ? { source: slide, lines: slide.split('\n').map((_, i) => i + 1) } : slide
  const diagnostics: Diagnostic[] = []
  const origLine = (chunkLine: number) => srcLines[Math.min(chunkLine, srcLines.length - 1)] ?? 1
  const error = (message: string, chunkLine: number) => diagnostics.push({ level: 'error', message, line: origLine(chunkLine) })

  const { text, segs } = protect(source.replace(/\r\n/g, '\n'))
  const steps = new Steps()

  // (1) 行単位: 環境の開始/終了、\pause、箇条書きの overlay、行単独の JSX ブロック
  type Frame = { tag?: string; overlay: boolean; pauses: number; jsx?: boolean; line: number }
  const stack: Frame[] = [{ overlay: false, pauses: 0, line: 0 }]
  const out: { text: string; src: number }[] = []
  /** 複数行の文字列を、すべて入力 i 行目由来として出力する */
  const emit = (s: string, i: number) => s.split('\n').forEach((t) => out.push({ text: t, src: i }))
  const closePauses = (f: Frame) => '\n\n</Overlay>\n'.repeat(f.pauses)

  const inLines = text.split('\n')
  inLines.forEach((line, i) => {
    const begin = line.match(/^\s*\\begin\{(\w+)\}(?:<([^>]*)>)?(?:\[([^\]]*)\])?\s*(\\label\{[^}]+\})?\s*$/)
    if (begin && ENV_TAGS[begin[1]]) {
      const tag = ENV_TAGS[begin[1]]
      const spec = begin[2] !== undefined ? steps.parse(begin[2]) : null
      if (begin[2] !== undefined && !spec) error(`\\begin{${begin[1]}}<${begin[2]}> の overlay 指定を解釈できません`, i)
      const attr = begin[3] ? (tag === 'Proof' ? ` heading="${escapeAttr(begin[3])}"` : ` title="${escapeAttr(begin[3])}"`) : ''
      emit(`\n${spec ? overlayOpen(spec) + '\n\n' : ''}<${tag}${attr}>\n${begin[4] ?? ''}`, i)
      stack.push({ tag, overlay: !!spec, pauses: 0, line: i })
      return
    }
    const end = line.match(/^\s*\\end\{(\w+)\}\s*$/)
    if (end && ENV_TAGS[end[1]]) {
      const top = stack[stack.length - 1]
      if (stack.length === 1 || top.tag !== ENV_TAGS[end[1]]) {
        const open = top.tag && !top.jsx ? `(開いているのは ${top.tag}: ${origLine(top.line)} 行目)` : ''
        error(`\\end{${end[1]}} に対応する \\begin{${end[1]}} がありません${open}`, i)
        emit('', i)
        return
      }
      stack.pop()
      emit(`${closePauses(top)}\n</${top.tag}>${top.overlay ? '\n\n</Overlay>' : ''}\n`, i)
      return
    }
    // 行単独の JSX タグ(<Col> … </Col> など)もブロックとして扱い、
    // その中の \pause は閉じタグの手前で閉じる(タグをまたいで入れ子が壊れないように)
    const jsxOpen = line.match(/^\s*<([A-Za-z][\w.]*)\b[^>]*[^/]>\s*$|^\s*<([A-Za-z][\w.]*)>\s*$/)
    if (jsxOpen) {
      stack.push({ tag: jsxOpen[1] ?? jsxOpen[2], overlay: false, pauses: 0, jsx: true, line: i })
      emit(line, i)
      return
    }
    const jsxClose = line.match(/^\s*<\/([A-Za-z][\w.]*)>\s*$/)
    if (jsxClose) {
      const top = stack[stack.length - 1]
      if (stack.length > 1 && top.jsx && top.tag === jsxClose[1]) {
        stack.pop()
        emit(`${closePauses(top)}${line}`, i)
        return
      }
    }
    if (/^\s*\\pause\s*$/.test(line)) {
      stack[stack.length - 1].pauses++
      emit(`\n${overlayOpen({ from: steps.pause() })}\n`, i)
      return
    }
    const item = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)<([^>]*)>\s+(.*)$/)
    if (item && /^[\d+-]+$/.test(item[2])) {
      const spec = steps.parse(item[2])
      if (!spec) error(`箇条書きの overlay 指定 <${item[2]}> を解釈できません`, i)
      else {
        emit(`${item[1]}${overlayOpen(spec, ' as="span" li')}${item[3]}</Overlay>`, i)
        return
      }
    }
    emit(line, i)
  })
  const last = inLines.length - 1
  while (stack.length > 1) {
    const f = stack.pop()!
    // JSX の閉じタグは同じ行に他の内容と書かれることもあるので、補完しない
    if (f.jsx) emit(closePauses(f), last)
    else {
      error(`\\begin{${Object.keys(ENV_TAGS).find((k) => ENV_TAGS[k] === f.tag)}} に対応する \\end がありません`, f.line)
      emit(`${closePauses(f)}\n</${f.tag}>\n`, last)
    }
  }
  emit(closePauses(stack[0]), last)

  let body = out.map((o) => o.text).join('\n')
  const lineMap = out.map((o) => o.src)
  /** body 中の位置 → 入力(チャンク)の行 */
  const chunkLineAt = (offset: number) => lineMap[countLines(body.slice(0, offset))] ?? last

  // (2) 文中のコマンド(行数は変えない)
  const replaceOverlayCommands = (s: string, base: number): string => {
    const re = /\\(only|uncover|visible|onslide)<([^>]*)>\{/g
    let res = ''
    let prev = 0
    for (let m = re.exec(s); m; m = re.exec(s)) {
      const open = m.index + m[0].length - 1
      const close = matchBrace(s, open)
      if (close < 0) {
        error(`\\${m[1]}<${m[2]}>{ の } が閉じていません`, chunkLineAt(base + m.index))
        break
      }
      const spec = steps.parse(m[2])
      const inner = replaceOverlayCommands(s.slice(open + 1, close), base + open + 1)
      res += s.slice(prev, m.index)
      if (!spec) {
        error(`\\${m[1]}<${m[2]}> の overlay 指定を解釈できません`, chunkLineAt(base + m.index))
        res += inner
      } else {
        const only = m[1] === 'only' ? ' only' : ''
        // 行全体がこのコマンドだけなら段落として(div)、文中なら span で包む
        const lineStart = /(^|\n)[ \t]*$/.test(s.slice(0, m.index))
        const lineEnd = /^[ \t]*(\n|$)/.test(s.slice(close + 1))
        const as = lineStart && lineEnd ? '' : ' as="span"'
        res += `${overlayOpen(spec, `${as}${only}`)}${inner}</Overlay>`
      }
      prev = close + 1
      re.lastIndex = close + 1
    }
    return res + s.slice(prev)
  }
  body = replaceOverlayCommands(body, 0)

  const cites: ChunkInfo['cites'] = []
  body = body.replace(/\\cite(?:\[([^\]]*)\])?\{([^}]+)\}/g, (_all, note: string | undefined, keys: string, offset: number) => {
    const list = keys.split(',').map((s) => s.trim()).filter(Boolean)
    const line = origLine(chunkLineAt(offset))
    cites.push(...list.map((k) => ({ key: k, line })))
    const attrs = [`keys="${escapeAttr(list.join(';'))}"`]
    // LaTeX の ~ (改行しない空白) は NBSP に
    if (note) attrs.push(`note="${escapeAttr(note.replace(/~/g, ' '))}"`)
    return `<Cite ${attrs.join(' ')} />`
  })
  const refs: ChunkInfo['refs'] = []
  body = body.replace(/\\(eq)?ref\{([^}]+)\}/g, (_all, eq: string | undefined, k: string, offset: number) => {
    refs.push({ key: k.trim(), line: origLine(chunkLineAt(offset)) })
    return `<Ref k="${escapeAttr(k.trim())}"${eq ? ' eq' : ''} />`
  })

  // (3) 番号付け: 定理タグ・\label・数式を出現順に走査する(行数は変えない)
  const items: NumberedItem[] = []
  const open: NumberedItem[] = []
  let t = 0
  let e = 0
  const tagAlt = THEOREM_TAGS.join('|')
  const scan = new RegExp(
    `<(${tagAlt})\\b([^>]*)>|</(${tagAlt})>|\\\\label\\{([^}]+)\\}|(\\d+)((?:\\n)*)`,
    'g',
  )
  body = body.replace(scan, (all, openTag, attrs: string, closeTag, label, ph, pad: string, offset: number) => {
    const here = chunkLineAt(offset)
    if (openTag) {
      const item: NumberedItem = { id: `${key}:t${t++}`, kind: 'thm', line: origLine(here) }
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
      else error(`\\label{${label}} が定理環境・数式の外にあります`, here)
      return ''
    }
    return convertMath(segs[Number(ph)], pad)
  })

  /** 保護範囲 1 つを処理する。数式は検査し、別行立ての数式は <Equation> にする(行数は保つ) */
  function convertMath(seg: Segment, pad: string): string {
    const s = seg.text
    if (s.startsWith('`')) return s + '' // コード: そのまま
    const inline = s.match(/^\$([^$][\s\S]*)\$$/)
    if (inline && !s.startsWith('$$')) {
      const err = checkTex(inline[1], false)
      if (err) error(`数式の誤り: ${err}  ${s}`, seg.line)
      return s
    }
    const env = s.match(/^\\begin\{(\w+)(\*?)\}([\s\S]*?)\\end\{\1\*?\}$/)
    const display = s.match(/^\$\$([\s\S]*)\$\$$/)
    let name: string
    let rows: MathRow[]
    if (env) {
      name = env[1]
      const auto = env[2] === ''
      rows = (name === 'equation' ? [{ tex: env[3], sep: '' }] : splitRows(env[3])).map((r) => parseRow(r, auto))
    } else if (display && /\\label\{/.test(display[1])) {
      name = 'equation'
      rows = [parseRow({ tex: display[1], sep: '' }, true)]
    } else {
      // 番号なしの $$…$$ は remark-math に任せる(検査だけする)
      const err = checkTex(display ? display[1] : s, true)
      if (err) error(`数式の誤り: ${err}`, seg.line)
      return s
    }
    const err = checkTex(equationTex(name, rows.map((r) => ({ ...r, tag: r.numbered ? '0' : undefined }))), true)
    if (err) error(`数式の誤り: ${err}`, seg.line)

    const jsonRows = rows.map((r) => {
      const row: { tex: string; sep: string; refId?: string } = { tex: r.tex, sep: r.sep }
      if (r.numbered) {
        const item: NumberedItem = { id: `${key}:e${e++}`, kind: 'eq', label: r.label, line: origLine(seg.line) }
        items.push(item)
        row.refId = item.id
      } else if (r.label) error(`\\label{${r.label}} の行には番号がありません(\\nonumber / \\tag / * 付き環境)`, seg.line)
      return row
    })
    const tag = `<Equation env="${name}" rows={${JSON.stringify(jsonRows)}} />`
    // 1 行目を空行にして段落と切り離し、残りの行数は空行で埋める
    const n = pad.length / 2
    return n === 0 ? tag : `\n${tag}` + '\n'.repeat(n - 1)
  }

  // (4) 保護範囲を戻し、段階表示のステップ数を確定する
  body = restore(body, segs)
  body = finalizeOverlays(body, steps.max)
  if (steps.max >= 2) {
    body += `\n\n<OverlaySteps max={${steps.max}} />`
    lineMap.push(last, last)
  }
  return {
    code: body + '\n',
    lineMap: [...lineMap.map(origLine), origLine(last)],
    cites,
    items,
    refs,
    diagnostics,
  }
}
