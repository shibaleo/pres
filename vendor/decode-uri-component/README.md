# decode-uri-component(CommonJS への繋ぎ)

Spectacle 10 は URL の `?slideIndex=` などを query-string 7 で読み書きする。query-string 7 は CommonJS で、
`require('decode-uri-component')` の結果をそのまま関数として呼ぶ。

decode-uri-component は 0.4.2 以下に脆弱性があり（GHSA-vcc3-ghjq-m6fr。壊れた % の並びで指数的に時間がかかる）、
直った 0.5.0 は ESM だけになった。query-string 8 以降は 0.5 系を使えるが、default の出口しか無く、
Spectacle の名前付きの `import { parse, stringify } from 'query-string'` が通らない。

そこで、query-string 7 の decode-uri-component だけを、このパッケージに置き換える（package.json の `overrides`）。
中身は本物の 0.5 系を `require` して default の関数を渡すだけで、デコードの処理は 0.5 系そのもの。

Spectacle が query-string 8 以降に移るか、query-string 7 が 0.5 系を使うようになったら、このフォルダと `overrides` の項目を消す。
