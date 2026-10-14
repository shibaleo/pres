/**
 * デッキの一覧と場所。デッキは decks/<名前>/ の 1 フォルダで、中身は
 *   deck.mdx        原稿の主ファイル(必須。\input で取り込むファイルはこのフォルダからの相対パス)
 *   style.css       このデッキの見た目の特化(必須。プリセットの読み込み・トークンの上書き)
 *   references.bib  文献(\cite を使うときだけ)
 *   motion.ts       動きの設定(モード・スライドごとの遷移。無ければ reveal で既定の遷移。src/modes/motion.ts)
 * と、原稿が import する画像や部品(img/・components/)。文書の部品(src/components)・土台の見た目(src/theme)・
 * 記法の処理(vite/)はすべてのデッキで共有する。decks/components/ はいくつかのデッキで共有する部品の置き場所なので、
 * デッキの名前には使えない(RESERVED_NAMES)。
 *
 * 開発サーバーは 1 つで全デッキを配信し(URL の /<名前>/ でデッキを選ぶ)、ビルドはデッキごとに行う
 * (scripts/deck.mjs がデッキの名前を引数で受け取り、vite.config.ts の deckConfig に渡す)。
 * vite.config.ts と Node のスクリプト(scripts/)の両方から使うので、型は JSDoc で付けた JS にする。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DECKS_DIR = join(ROOT, 'decks')

/** デッキの名前に使える文字(フォルダ名・URL・出力先にそのまま使うため) */
export const DECK_NAME = /^[a-z0-9][a-z0-9-]*$/

/** デッキの名前に使えない名前(decks/ の下の、デッキではないフォルダ) */
export const RESERVED_NAMES = ['components']

/** デッキの名前の一覧(decks/ の下で deck.mdx を持つフォルダ。名前順) */
export function listDecks() {
  if (!existsSync(DECKS_DIR)) return []
  return readdirSync(DECKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(DECKS_DIR, d.name, 'deck.mdx')))
    .map((d) => d.name)
    .sort()
}

/**
 * @typedef {{ name: string; dir: string; main: string; style: string; bibliography: string | undefined; motion: string | undefined; outDir: string }} Deck
 */

/**
 * デッキの場所。無いデッキや名前の誤りはエラーにする(補って別のデッキを開かない)
 * @param {string} name
 * @returns {Deck}
 */
export function resolveDeck(name) {
  if (!DECK_NAME.test(name)) throw new Error(`デッキの名前 "${name}" は英小文字・数字・ハイフンだけで書いてください`)
  const dir = join(DECKS_DIR, name)
  if (!existsSync(join(dir, 'deck.mdx'))) {
    throw new Error(`デッキ "${name}" がありません(decks/${name}/deck.mdx)。あるデッキ: ${listDecks().join(', ') || 'なし'}`)
  }
  if (!existsSync(join(dir, 'style.css'))) throw new Error(`decks/${name}/style.css がありません`)
  return {
    name,
    dir,
    main: join(dir, 'deck.mdx'),
    style: join(dir, 'style.css'),
    bibliography: bibliographyOf(dir),
    motion: motionOf(dir),
    outDir: join(ROOT, 'dist', name),
  }
}

/**
 * デッキのフォルダの文献ファイル。無ければ undefined(\cite を使うとエラーになる)
 * @param {string} dir
 */
function bibliographyOf(dir) {
  const bib = join(dir, 'references.bib')
  return existsSync(bib) ? bib : undefined
}

/**
 * デッキのフォルダの動きの設定。無ければ undefined(reveal で既定の遷移)
 * @param {string} dir
 */
function motionOf(dir) {
  const motion = join(dir, 'motion.ts')
  return existsSync(motion) ? motion : undefined
}

/**
 * 原稿のファイル(主ファイル)が属するデッキのフォルダ。decks/ の外なら undefined
 * (MDX の変換は主ファイルごとに行うので、変換中のファイルからデッキの文献を選ぶのに使う)
 * @param {string} file
 */
export function deckDirOf(file) {
  const rel = relative(DECKS_DIR, file)
  if (rel.startsWith('..') || rel === '') return undefined
  return join(DECKS_DIR, rel.split(sep)[0])
}

/**
 * 原稿のファイルが属するデッキの文献ファイル
 * @param {string} file
 */
export function bibliographyFor(file) {
  const dir = deckDirOf(file)
  return dir ? bibliographyOf(dir) : undefined
}

/**
 * デッキの題(原稿の最初の「# 題」の行。HTML の <title> に使う)。無ければデッキの名前
 * @param {Deck} deck
 */
export function deckTitle(deck) {
  const m = readFileSync(deck.main, 'utf8').match(/^# +(.+?)\s*$/m)
  return m ? m[1] : deck.name
}

/**
 * 原稿のファイルが属するデッキの動きの設定
 * @param {string} file
 */
export function motionFor(file) {
  const dir = deckDirOf(file)
  return dir ? motionOf(dir) : undefined
}
