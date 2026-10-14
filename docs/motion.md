# 内容・見た目・動きを分ける（方向と調査。着手の時期は未定）

このリポジトリに reveal.js から期待しているのは、画面遷移の美しさ（動き）だけである。
内容の組版（MDX + LaTeX の記法）と見た目（CSS）はほぼできているので、**動きとスライドの並べ方だけを、
フレームワーク（React・Vue）ではなく JS のライブラリの単位で差し替えられる**ようにしたい。
reveal.js のほかに impress.js のようなズーム型、Sozi 風の見せ方も選べるとなおよい。

## 層の分け方

| 層 | 担当 | 出力・入力 | 今の状態 |
|---|---|---|---|
| 内容 | MDX + LaTeX の記法 → 自前の変換（ビルド時） | ライブラリに依らない文書（スライドの並び・各スライドの段の数と各要素の現れる段・題・番号） | ほぼ完成。出力が reveal の形（`<Slide>`・`.fragment`）になっている点だけ直す |
| 見た目 | CSS（トークン・土台・プリセット・デッキの `style.css`） | 内容の層の class だけを対象にする | ほぼ完成。`.reveal` で始まる規則と `--r-*` の変数を外す |
| 進行 | 自前の小さな制御 | 今のスライドと段・キー操作・URL・段の表示の切り替え・図への段の配信 | 新しく作る（今は reveal が持っている） |
| 動き | アダプター（reveal.js / impress.js / …） | 「このスライドへ移って」を受け、遷移と配置だけを担う | reveal だけに直に結び付いている |
| 出力 | 自前の印刷のアダプター | PDF（ステップごと / handout） | 今は reveal の `?print-pdf` に頼っている |

要は**段階表示を動きの層から外し、進行の層（自前）に置く**こと。動きのライブラリに求めるのは「スライド単位で美しく移ること」だけになり、
reveal の fragment・impress の substep のようなライブラリごとの段階表示の違いを吸収しなくてよくなる。
キー操作は進行の層が受け、スライドの中に段が残っていれば段を進め、無ければ動きの層に次のスライドを頼む。

アダプターの約束はたとえば次の程度で足りる。

```ts
mount(container, deck)   // 内容の層が作ったスライドの DOM を受け取り、ライブラリの形に包む
goTo(slide)              // そのスライドへ遷移する(遷移の見た目はライブラリ次第)
onNavigate(cb)           // ライブラリ側の操作(一覧からの選択など)でスライドが変わったら知らせる
capabilities             // 拡大縮小・一覧モード・発表者ビューを自前で持つか
```

デッキがどの動きを使うか、その設定（impress の座標など）は原稿でも `style.css` でもなく、動きの設定のファイル
（たとえば `decks/<名前>/motion.js`）に置く。内容の層を汚さず、使うかどうかもデッキごとに選べる。

### 今の作りから変わること

- 段階表示: `Overlay.tsx` と見えない fragment（`OverlaySteps`）から、進行の層の「各要素の現れる段」（`data-` 属性と CSS）へ
- `App.tsx`: 内容の層と動きの層を組み合わせる場所にする。reveal の設定は reveal のアダプターへ
- `base.css`: `.reveal` で始まる規則と `--r-*` を外し、reveal のアダプターの CSS へ
- PDF とページ番号の書き直し: 自前の印刷のアダプターへ。handout は「段を最後まで進めた 1 ページ」として自然に作れる
- メニュー・`overflow.ts`: reveal の `getSlides` / `getIndices` ではなく進行の層の API に頼る
- e2e: reveal の DOM（`.reveal.ready`・`section.present`・`.pdf-page`）ではなく、進行の層の状態（今のスライドと段）を見る
- 発表者ビュー: reveal 以外では自前で作ることになる
- 図が段階表示に加わる仕組み（Spectacle の `useSteps` に当たる。README の「次にやること」）は進行の層の上に載る

### 進め方

1. 進行の層と印刷のアダプターを作り、reveal のアダプターで今と同じ動きを再現する（見た目と動きが変わらないことを、今の e2e と撮影で確かめる）
2. impress.js のアダプターを足す（試しに 1 デッキ）
3. 借り物で足りない見せ方が出てきたら、自前の動き（View Transitions API、Sozi 風のズームなら `@panzoom/panzoom`）を検討する

### 決めること

- 発表者ビューは reveal 以外でも要るか（要るなら 1 の段階で自前で作る）
- 縦のスライド（`--`）は reveal の 2 次元の並びの考え方。内容の層では「節の中の続き」の意味にし、動きの層がそれぞれの形
  （reveal は縦、impress は近くにまとめて置くなど）で表す、という扱いでよいか

## 調査（2026 年 10 月）

版と日付は npm のレジストリ（`npm view <パッケージ> time`）で確かめた。「開発中」は 2025 年以降に新しい版が出ているもの。

### スライド全体を動かすもの（移動・配置・遷移）

| ライブラリ | 最新（npm） | 状況 | 合うか |
|---|---|---|---|
| reveal.js | 6.0.2（2026-09） | 開発中 | ◎ 今の基準。遷移が美しく、発表者ビュー・一覧モードもある |
| Shower（`@shower/core`） | 3.6.0（2026-07） | 開発中 | ○ 「エンジンとテーマを分ける」作りで考え方が近い。PDF に印刷できる。遷移の演出はほとんど無い |
| Flowtime.js | 2.0.0（2025-02） | 更新は少ない | △ 格子状の移動と遷移。作者は 1 人 |
| impress.js | 1.1.0（2020-04。GitHub には 2.0 の表記） | 更新は少ない | ○ HTML のスライドを 3D の空間に置き、カメラが移る。座標の指定が要る |
| WebSlides（2019）・big（2019）・Bespoke（2015）・jmpress（2014）・inspire.js（2015）・remark（2017）・deck.js（jQuery） | — | 止まっている | × |
| Marpit | 3.2.3（2026-09） | 開発中 | × Markdown から HTML を作る道具（内容と見た目の層に当たる。このリポジトリでは自前で持っている） |

### ズームで移る見せ方（Prezi・Sozi 風）

| ライブラリ | 最新 | 合うか |
|---|---|---|
| impress.js | 上のとおり | ○ この型でいちばん実績がある |
| Zumly | 0.97.0（2026-09） | △ 新しく開発中だが 1.0 前。スライドよりアプリの画面の移動を狙った作り |
| Sozi | npm に無い | × SVG の絵の上に視点を置く専用のエディタ（Inkscape の拡張から始まった）。HTML のスライドを動かす部品ではない |
| dizzy.js | npm に無い | × 止まっている |
| `@panzoom/panzoom`（4.6.2、2026-04）・d3-zoom（3.0.0、2021-06） | — | ○ ズームと移動の部品。Sozi 風の動きを自前で作るときに使える |

### 切り替えの演出だけを担うもの（自前の進行の層と組み合わせる）

| 候補 | 状況 | 合うか |
|---|---|---|
| **View Transitions API**（ブラウザの標準） | 同じページの中の切り替えは Chrome 111 以降・Safari 18・Firefox 144 以降（Chrome の 2025 年の記事による） | ◎ 依存が無く、遷移の演出を CSS で書ける（見た目と動きを分ける考えにいちばん素直に合う） |
| Swiper | 14.3.0（2026-09）、開発中 | ○ cube・coverflow・flip・cards などの演出。本来はカルーセル（スワイプで送る）の部品 |
| Motion（14.2.0、2026-10）・anime.js（4.5.0、2026-06） | 開発中、MIT | ○ 自前で遷移を作るときのアニメーションの部品 |
| GSAP | 3.15.0、開発中 | △ 無料だが MIT ではない独自のライセンス |
| fullPage.js | 4.0.41 | × GPL-3.0（商用には別のライセンスが要る） |
| Swup・Barba | 開発中 / 2024 | × 複数ページのサイトの画面遷移向け |

### 勧める組み合わせ

方針: **動きは基本的に借り物（出来上がったライブラリ）を使う**。自前で持つのは、どのライブラリでも要る進行の層と出力の層だけにする。

1. **reveal.js**: 1 つ目のアダプター。今の動きをそのまま再現する
2. **impress.js**: ズームの型を試すとき（更新は少ないが実績がある）。座標の決め方（格子・螺旋・手で指定）を動きの設定のファイルに持つ
3. **Shower**: 考え方は近いが遷移の演出が少ないので、優先は低い
4. 自前の動き（View Transitions API。CSS で書けない動きには Motion）は、借り物で足りない見せ方が出てきたときの選択肢として残す。
   遷移の演出をデッキの CSS に置ける・依存が無いという利点はあるが、動きの層を自前で持つことになる。
   Sozi 風に面の上を移る動きも、impress.js で足りなければ `@panzoom/panzoom` で同じく自前で

除外: 止まっているもの、ライセンスに注意が要るもの（fullPage.js の GPL、GSAP）、性格の違うもの
（Sozi はエディタ、Marpit は内容の層、Swup・Barba は複数ページのサイト向け）。

### 出典

- [reveal.js Alternatives（AlternativeTo）](https://www.alternativeto.net/software/reveal-js/)
- [Shower（GitHub）](https://github.com/shower/shower)
- [impress.js（GitHub）](https://github.com/impress/impress.js)
- [Sozi（GitHub）](https://github.com/sozi-projects/Sozi)・[An overview of Sozi（FOSDEM 2014）](https://archive.fosdem.org/2014/schedule/event/sozi/)
- [Zooming UIs in 2026: Prezi, impress.js, and why I built something different](https://clone2-hacker-news-nuxt.nuxt.dev/item/47665194)
- [dizzy.js（Open Hub）](https://openhub.net/p/dizzyjs)
- [What's new in view transitions (2025 update)（Chrome for Developers）](https://developer.chrome.com/blog/view-transitions-in-2025)
- [CSS View Transitions: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/css-view-transitions-complete-guide)
