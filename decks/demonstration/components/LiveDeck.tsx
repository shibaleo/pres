import { MODE_NAMES } from '@/modes/names'

/**
 * ほかのデッキを、スライドの中に iframe で埋め込む。中のデッキは自分のモード(そのデッキの motion.ts)の本物のまま動き、
 * 枠の中を押すとキー・スワイプ・ドラッグがそのデッキに渡る(枠の外を押すと、外のデッキの操作に戻る)。
 *
 * 参照先は、デッキの並ぶ所から <デッキ>/index.html。開発サーバー(/<デッキ>/index.html も配信する)と、フォルダごとのビルド
 * (dist/<デッキ>/index.html が並ぶ)のどちらでも同じ相対パスで開ける。このページ自身がモードのフォルダ
 * (開発サーバーの /<デッキ>/<モード>/、--mode でビルドした dist/<デッキ>/<モード>/)にあるときは、1 段多く上がる。
 * 埋め込むデッキもビルドしておく(npm run build:single は全デッキ)。単一 HTML の中には入らないので、配るときは dist を丸ごと配る。
 *
 * view="scroll" は reveal のスクロールビュー(reveal 自身の URL の約束 ?view=scroll)で開く。reveal モードのデッキだけに効く。
 * loading="lazy": 外のデッキは表示中のスライドの近くしか描かないので、枠はそのスライドに来たときに読み込む。
 */
export default function LiveDeck({
  deck,
  title,
  view,
  width = 560,
  height = 420,
}: {
  deck: string
  title: string
  view?: 'scroll'
  width?: number
  height?: number
}) {
  const folder = location.pathname.split('/').slice(0, -1).at(-1) ?? ''
  const up = (MODE_NAMES as readonly string[]).includes(folder) ? '../../' : '../'
  const src = `${up}${deck}/index.html${view ? `?view=${view}` : ''}`
  return <iframe className="live-deck" src={src} title={title} width={width} height={height} loading="lazy" />
}
