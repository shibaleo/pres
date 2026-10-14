/**
 * ほかのデッキを、スライドの中に iframe で埋め込む。中のデッキは自分のモード(そのデッキの motion.ts)の本物のまま動き、
 * 枠の中を押すとキー・スワイプ・ドラッグがそのデッキに渡る(枠の外を押すと、外のデッキの操作に戻る)。
 *
 * 参照先は ../<デッキ>/index.html。開発サーバー(/<デッキ>/index.html も配信する)と、フォルダごとのビルド
 * (dist/<デッキ>/index.html が並ぶ)のどちらでも同じ相対パスで開ける。埋め込むデッキもビルドしておく
 * (npm run build:single は全デッキ)。単一 HTML の中には入らないので、配るときは dist を丸ごと配る。
 *
 * loading="lazy": 外のデッキは表示中のスライドの近くしか描かないので、枠はそのスライドに来たときに読み込む。
 */
export default function LiveDeck({ deck, title, width = 560, height = 420 }: { deck: string; title: string; width?: number; height?: number }) {
  return <iframe className="live-deck" src={`../${deck}/index.html`} title={title} width={width} height={height} loading="lazy" />
}
