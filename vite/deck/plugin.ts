/**
 * スライド原稿を読み込む Vite プラグイン。
 *
 *  - src/slides/**\/*.mdx を表示順(compareSlidePaths)に並べ、各ファイルを `---` でスライドに分割する。
 *    分割した 1 枚ごとに仮想の .mdx モジュール(`<元ファイル>.s<n>.mdx`)を作り、
 *    scan.ts の transformChunk で Beamer 風記法を MDX に変換してから MDX プラグインに渡す。
 *  - 仮想モジュール
 *      virtual:deck-slides   全スライドの一覧(表示順)
 *      virtual:refs          定理・式の通し番号と \label → 番号の対応
 *      virtual:bibliography  引用の通し番号と整形済み文献
 *    番号はデッキ全体を見ないと決まらないので、スライドを編集したら全体を読み直す(full reload)。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { compareSlidePaths } from '../../src/deck/order'
import { splitSlides, transformChunk, type ChunkInfo } from './scan'
import { formatBibliography } from './bibliography'

const V_SLIDES = 'virtual:deck-slides'
const V_REFS = 'virtual:refs'
const V_BIB = 'virtual:bibliography'
const VIRTUALS = [V_SLIDES, V_REFS, V_BIB]
/** 分割後の 1 枚を表す id: `<元ファイル>.s<番号>.mdx` */
const CHUNK_RE = /^(.*\.mdx)\.s(\d+)\.mdx$/

type Chunk = { id: string; rel: string; index: number; count: number; info: ChunkInfo }

function listSlideFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listSlideFiles(p))
    else if (name.endsWith('.mdx')) out.push(p)
  }
  return out
}

export function deck({ slidesDir, bib }: { slidesDir: string; bib: string }): Plugin {
  const slidesPath = resolve(slidesDir)
  const bibPath = resolve(bib)
  let root = process.cwd()
  let cache: Chunk[] | null = null

  /** 全スライドを読み、分割・変換した結果(表示順)。編集されるまでキャッシュする */
  function analyze(): Chunk[] {
    if (cache) return cache
    const files = listSlideFiles(slidesPath)
      .map((f) => ({ f, rel: relative(slidesPath, f).split(sep).join('/') }))
      .sort((a, b) => compareSlidePaths(a.rel, b.rel))
    cache = files.flatMap(({ f, rel }) => {
      const parts = splitSlides(readFileSync(f, 'utf8'))
      return parts.map((src, index) => ({
        id: `${normalizePath(f)}.s${index}.mdx`,
        rel,
        index,
        count: parts.length,
        info: transformChunk(src, `${rel}#${index}`),
      }))
    })
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

  return {
    name: 'deck-slides',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    resolveId(id) {
      if (VIRTUALS.includes(id)) return '\0' + id
      return toChunkId(id)
    },
    load(id) {
      const chunkId = toChunkId(id)
      if (chunkId) {
        const chunk = analyze().find((c) => c.id === chunkId)
        if (!chunk) return null
        this.addWatchFile(chunkId.match(CHUNK_RE)![1])
        return { code: chunk.info.code, map: null }
      }

      if (id === '\0' + V_SLIDES) {
        const chunks = analyze()
        for (const c of chunks) for (const w of c.info.warnings) this.warn(`${c.rel}#${c.index + 1}: ${w}`)
        const imports = chunks.map((c, i) => `import * as s${i} from ${JSON.stringify(c.id)}`)
        const list = chunks.map((c, i) => {
          const path = c.count > 1 ? `${c.rel}#${c.index + 1}` : c.rel
          return `{ path: ${JSON.stringify(path)}, mod: s${i} }`
        })
        return `${imports.join('\n')}\nexport default [\n${list.join(',\n')}\n]\n`
      }

      if (id === '\0' + V_REFS) {
        // 定理(Theorem/Lemma/…/Definition)と式は別々の通し番号
        const items: Record<string, number> = {}
        const labels: Record<string, { n: number; kind: 'thm' | 'eq' }> = {}
        const count = { thm: 0, eq: 0 }
        for (const c of analyze()) {
          for (const item of c.info.items) {
            const n = ++count[item.kind]
            items[item.id] = n
            if (!item.label) continue
            if (labels[item.label]) this.warn(`\\label{${item.label}} が重複しています(${c.rel})`)
            labels[item.label] = { n, kind: item.kind }
          }
        }
        for (const c of analyze()) {
          for (const k of c.info.refs) if (!labels[k]) this.warn(`\\ref{${k}} の参照先がありません(${c.rel})`)
        }
        return `export const items = ${JSON.stringify(items)}\nexport const labels = ${JSON.stringify(labels)}\n`
      }

      if (id === '\0' + V_BIB) {
        this.addWatchFile(bibPath)
        const cited = [...new Set(analyze().flatMap((c) => c.info.cites))]
        const { order, entries } = formatBibliography(bibPath, cited, (m) => this.warn(m))
        return `export const order = ${JSON.stringify(order)}\nexport const entries = ${JSON.stringify(entries)}\n`
      }
      return null
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
