'use strict'
// 本物の decode-uri-component 0.5 系(ESM だけ)を require し、default の関数を CommonJS の形で渡す。
// require(ESM) はモジュールの名前空間(default を持つ)を返す(Node 22 以降と、ビルドの rolldown)
const mod = require('decode-uri-component-esm')
module.exports = mod.default ?? mod
