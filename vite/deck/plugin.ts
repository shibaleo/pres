/**
 * スライド原稿を読み込む Vite プラグイン。
 *
 *  - src/slides/**\/*.mdx を表示順(compareSlidePaths)に並べ、各ファイルを `---` でスライドに分割する。
 *    分割した 1 枚ごとに仮想の .mdx モジュール(`<元ファイル>.s<n>.mdx`)を作り、
 *    scan.ts で Beamer 風記法を MDX に変換してから、ここで MDX をコンパイルする。
 *  - 仮想モジュール
 *      virtual:deck-slides       全スライドの一覧(表示順)
 *      virtual:refs              定理・式の通し番号と \label → 番号の対応
 *      virtual:bibliography      引用の通し番号と整形済み文献
 *      virtual:deck-diagnostics  警告の一覧(開発時に画面へ出す)
 *    番号はデッキ全体を見ないと決まらないので、スライドを編集したら全体を読み直す(full reload)。
 *
 * エラーの扱い(不完全な原稿から成果物を作らない):
 *  - 記法エラー(環境の閉じ忘れ、数式の誤り、MDX の構文エラーなど)
 *      → そのスライドのモジュールを失敗させる。dev はエラー画面、build は失敗。
 *  - 警告(参照先の無い \ref、未登録の文献、\label の重複)
 *      → dev は画面の一覧に出す。build は失敗させる(DECK_ALLOW_WARNINGS=1 で許可)。
 *  どちらも元の原稿のファイル名・行番号で報告する。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { compile } from '@mdx-js/mdx'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { compareSlidePaths } from '../../src/deck/order'
import { splitSlides, transformChunk, type ChunkInfo } from './scan'
import { formatBibliography, type BibEntries } from './bibliography'

const V_SLIDES = 'virtual:deck-slides'
const V_REFS = 'virtual:refs'
const V_BIB = 'virtual:bibliography'
const V_DIAG = 'virtual:deck-diagnostics'
const VIRTUALS = [V_SLIDES, V_REFS, V_BIB, V_DIAG]
/** 分割後の 1 枚を表す id: `<元ファイル>.s<番号>.mdx` */
const CHUNK_RE = /^(.*\.mdx)\.s(\d+)\.mdx$/

type Chunk = {
  id: string
  /** 元ファイルの絶対パス */
  file: string
  rel: string
  index: number
  count: number
  info: ChunkInfo
}

/** デッキ全体の警告(1 枚の中では判断できないもの) */
export type DeckWarning = { file: string; line?: number; message: string }

type Model = {
  chunks: Chunk[]
  refs: { items: Record<string, number>; labels: Record<string, { n: number; kind: 'thm' | 'eq' }> }
  bib: { order: string[]; entries: BibEntries }
  warnings: DeckWarning[]
}

function listSlideFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listSlideFiles(p))
    else if (name.endsWith('.mdx')) out.push(p)
  }
  return out
}

/** エラー画面用の抜粋(前後 2 行、該当行に >) */
function codeFrame(file: string, line: number): string {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const from = Math.max(1, line - 2)
  const to = Math.min(lines.length, line + 2)
  const out: string[] = []
  for (let n = from; n <= to; n++) {
    out.push(`${n === line ? '>' : ' '} ${String(n).padStart(4)} | ${lines[n - 1]}`)
  }
  // Vite のエラー画面は先頭の空白を詰めるので、ゼロ幅空白で 1 行目の字下げを保つ
  return '​' + out.join('\n')
}

export function deck({ slidesDir, bib }: { slidesDir: string; bib: string }): Plugin {
  const slidesPath = resolve(slidesDir)
  const bibPath = resolve(bib)
  const relToRoot = (f: string) => relative(process.cwd(), f).split(sep).join('/')
  let root = process.cwd()
  let isBuild = false
  let dev = false
  let cache: Model | null = null

  /** 全スライドを読み、分割・変換し、デッキ全体の番号と警告を求める。編集されるまでキャッシュする */
  function model(): Model {
    if (cache) return cache
    const files = listSlideFiles(slidesPath)
      .map((f) => ({ f, rel: relative(slidesPath, f).split(sep).join('/') }))
      .sort((a, b) => compareSlidePaths(a.rel, b.rel))
    const chunks: Chunk[] = files.flatMap(({ f, rel }) => {
      const parts = splitSlides(readFileSync(f, 'utf8'))
      return parts.map((slide, index) => ({
        id: `${normalizePath(f)}.s${index}.mdx`,
        file: f,
        rel,
        index,
        count: parts.length,
        info: transformChunk(slide, `${rel}#${index}`),
      }))
    })

    const warnings: DeckWarning[] = []
    // 定理(Theorem/Lemma/…/Definition)と式は別々の通し番号
    const items: Model['refs']['items'] = {}
    const labels: Model['refs']['labels'] = {}
    const count = { thm: 0, eq: 0 }
    for (const c of chunks) {
      for (const item of c.info.items) {
        const n = ++count[item.kind]
        items[item.id] = n
        if (!item.label) continue
        if (labels[item.label]) warnings.push({ file: relToRoot(c.file), line: item.line, message: `\\label{${item.label}} が重複しています` })
        labels[item.label] = { n, kind: item.kind }
      }
    }
    for (const c of chunks) {
      for (const r of c.info.refs) {
        if (!labels[r.key]) warnings.push({ file: relToRoot(c.file), line: r.line, message: `\\ref{${r.key}} の参照先がありません` })
      }
    }
    const firstCite = new Map<string, { file: string; line: number }>()
    for (const c of chunks) for (const x of c.info.cites) if (!firstCite.has(x.key)) firstCite.set(x.key, { file: relToRoot(c.file), line: x.line })
    const bibData = formatBibliography(bibPath, [...firstCite.keys()], (key) => {
      const at = firstCite.get(key)!
      warnings.push({ ...at, message: `文献 "${key}" が ${relToRoot(bibPath)} に見つかりません` })
    })

    cache = { chunks, refs: { items, labels }, bib: bibData, warnings }
    return cache
  }

  /** dev サーバーは URL 形式(/src/…, /@fs/C:/…)で問い合わせてくるので絶対パスに直す */
  function toChunkId(id: string): string | null {
    let p = id.split('?')[0]
    if (!CHUNK_RE.test(p)) return null
    if (p.startsWith('/@fs/')) p = p.slice(5)
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1)
    if (p.startsWith('/') && !existsSync(p.match(CHUNK_RE)![1])) p = join(root, p)
    return normalizePath(p)
  }

  const formatWarnings = (ws: DeckWarning[]) => ws.map((w) => `  ${w.file}${w.line ? `:${w.line}` : ''}  ${w.message}`).join('\n')

  return {
    name: 'deck-slides',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      isBuild = config.command === 'build'
      dev = config.mode === 'development'
    },
    resolveId(id) {
      if (VIRTUALS.includes(id)) return '\0' + id
      return toChunkId(id)
    },
    async load(id) {
      const chunkId = toChunkId(id)
      if (chunkId) {
        const chunk = model().chunks.find((c) => c.id === chunkId)
        if (!chunk) return null
        this.addWatchFile(chunk.file)
        const where = `${relToRoot(chunk.file)}${chunk.count > 1 ? `(${chunk.index + 1} 枚目)` : ''}`

        // 記法エラーがあれば成果物を作らない(最初のエラーを画面に、残りは一覧で)
        const errors = chunk.info.diagnostics.filter((d) => d.level === 'error')
        if (errors.length) {
          const first = errors[0]
          this.error({
            message: `${where}: ${first.message}${errors.length > 1 ? `\n他 ${errors.length - 1} 件:\n${errors.slice(1).map((d) => `  ${d.line} 行目: ${d.message}`).join('\n')}` : ''}`,
            id: chunk.file,
            loc: { file: chunk.file, line: first.line, column: 1 },
            frame: codeFrame(chunk.file, first.line),
          })
        }

        try {
          const compiled = await compile(chunk.info.code, {
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
            development: dev,
          })
          return { code: String(compiled.value), map: null }
        } catch (e) {
          // MDX の構文エラー: 変換後の行番号を元の原稿の行番号に直して報告する
          // (位置は VFileMessage の line / place、無ければメッセージ末尾の "(行:列-…)" から取る)
          type Point = { line?: number; column?: number }
          const err = e as { reason?: string; message: string; line?: number; column?: number; place?: Point & { start?: Point } }
          const pos = err.line ? err : err.place?.start ?? err.place
          const fromMsg = err.message.match(/\((\d+):(\d+)(?:-\d+:\d+)?\)\s*$/)
          const outLine = pos?.line ?? (fromMsg ? Number(fromMsg[1]) : undefined)
          const line = outLine ? chunk.info.lineMap[outLine - 1] ?? 1 : 1
          const reason = (err.reason ?? err.message).replace(/\s*\(\d+:\d+(?:-\d+:\d+)?\)\s*$/, '')
          this.error({
            message: `${where}: MDX の構文エラー: ${reason}`,
            id: chunk.file,
            loc: { file: chunk.file, line, column: pos?.column ?? (fromMsg ? Number(fromMsg[2]) : 1) },
            frame: codeFrame(chunk.file, line),
          })
        }
      }

      if (id === '\0' + V_SLIDES) {
        const { chunks } = model()
        const imports = chunks.map((c, i) => `import * as s${i} from ${JSON.stringify(c.id)}`)
        const list = chunks.map((c, i) => {
          const path = c.count > 1 ? `${c.rel}#${c.index + 1}` : c.rel
          return `{ path: ${JSON.stringify(path)}, mod: s${i} }`
        })
        return `${imports.join('\n')}\nexport default [\n${list.join(',\n')}\n]\n`
      }
      if (id === '\0' + V_REFS) {
        const { items, labels } = model().refs
        return `export const items = ${JSON.stringify(items)}\nexport const labels = ${JSON.stringify(labels)}\n`
      }
      if (id === '\0' + V_BIB) {
        this.addWatchFile(bibPath)
        const { order, entries } = model().bib
        return `export const order = ${JSON.stringify(order)}\nexport const entries = ${JSON.stringify(entries)}\n`
      }
      if (id === '\0' + V_DIAG) {
        const { warnings } = model()
        if (warnings.length) this.warn(`原稿の警告 ${warnings.length} 件:\n${formatWarnings(warnings)}`)
        return `export default ${JSON.stringify(warnings)}\n`
      }
      return null
    },
    buildEnd(err) {
      // ビルドでは警告も失敗扱い(不完全な原稿のまま配布しない)
      if (!isBuild || err) return
      const { warnings } = model()
      if (warnings.length && process.env.DECK_ALLOW_WARNINGS !== '1') {
        this.error(
          `原稿に警告が ${warnings.length} 件あるためビルドを中止しました(DECK_ALLOW_WARNINGS=1 で許可):\n${formatWarnings(warnings)}`,
        )
      }
    },
    configureServer(server) {
      const isSource = (file: string) => {
        const f = resolve(file)
        return f === bibPath || (f.startsWith(slidesPath) && f.endsWith('.mdx'))
      }
      const reload = () => {
        cache = null
        server.moduleGraph.invalidateAll()
        server.ws.send({ type: 'full-reload' })
      }
      // 追加・削除はモジュールグラフに無いので watcher で拾う
      server.watcher.on('add', (f) => isSource(f) && reload())
      server.watcher.on('unlink', (f) => isSource(f) && reload())
      server.watcher.on('change', (f) => isSource(f) && reload())
    },
    handleHotUpdate({ file }) {
      const f = resolve(file)
      // 番号はデッキ全体で決まるので、部分 HMR はせず configureServer の full reload に任せる
      if (f === bibPath || (f.startsWith(slidesPath) && f.endsWith('.mdx'))) return []
    },
  }
}
