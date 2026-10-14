# モード: スライドを動かすライブラリごとの作り（方向・試作・調査）

このリポジトリに reveal.js から期待しているのは、画面遷移の美しさ（動き）だけである。
内容の組版（MDX + LaTeX の記法）と見た目（CSS）はほぼできているので、**動きのライブラリを選べる**ようにしたい。
reveal.js のほかに impress.js のようなズーム型、Sozi 風の見せ方も選べるとなおよい。

## 構成: ライブラリごとのモード

ライブラリは完成品として**そのまま**使い、ライブラリごとに「モード」を作る。

- **内容の層は中立に保つ**。原稿の変換（vite/remark-beamer）が出すのは部品の名前だけ:
  `Slide`（並び `h`・`v` を持つ）・`Stack`（縦の続き）・`Overlay`（`from`・`to`・`only`）・`OverlaySteps`（段の数）・`Notes` など
- **モード = その部品の、ライブラリ向けの実体 + 外枠**。段階表示・キー操作・発表者ビュー・PDF は、
  ライブラリが持っていればそれを使う。足りないものはそのモードの中だけで補い、モードをまたぐ共通の層は作らない
- **見た目は土台（theme/）が持ち、どのモードでも同じ**。本文の範囲は `.deck`（各モードが本文を包む要素に付ける）、
  スライド 1 枚は `.slide`。要素の既定の見た目（見出しの大きさ・余白など）も土台に持つ（以前は reveal の white テーマに頼っていた）
- 共通の書き方（モードが受け取るもの）は、モードを増やしながら固める

見送った案: 段階表示・キー操作・URL・PDF・発表者ビューを自前の「進行の層」に移し、ライブラリには
「スライドへ移ること」だけを頼む作り。reveal が持っている完成品の機能（fragment・発表者ビュー・一覧モード・
PDF・操作ボタン・タッチ操作）を作り直すことになり、壊れやすいので採らなかった。

### 今のモード

| モード | 場所 | 状態 |
|---|---|---|
| reveal（既定） | `src/App.tsx`・`src/deck/mdx-components.tsx` | 完成。一覧・ページ番号・はみ出しの検査・PDF・発表者ビュー（reveal のノートのプラグイン） |
| impress（試作） | `src/modes/impress/` | 開くには URL に `?mode=impress`（選び方は仮）。下の「impress モード」 |

### impress モード（試作）

- スライドは impress の step。最小サイズ（933×700）の固定の大きさで、横の並び（h）は右へ、縦の続き（v）は下へ置く。
  最後に全体を見渡す step（`#overview`）を足す
- 段階表示: impress 1.1.0 の substep は要素を文書順に 1 つずつ見せるだけで、段の番号の指定も「消える」も無い。
  そこで段の数だけ空の substep（`OverlaySteps`）を置いて段を進める印にし、今の段（見えている印の数 + 1）から
  各 `Overlay` の表示を決める。`\only`・`<2-3>` も Beamer どおりに出る
- 図の動き（表示中のスライドだけで回す）は `impress:stepenter` で知る
- まだ無いもの: `<Fragment>` を段に数えること（今は常に表示）、一覧・ページ番号・はみ出しの検査・開発時の警告の表示、
  PDF 出力（reveal モードで作る）、発表者ビュー（impress の impressConsole は CSS を URL で読むので単一 HTML では使えない）、
  原稿の中のリンク `#/4`（impress の hash は step の id）、原稿を直したときの描き直し（impress は初期化のときの step しか知らない）

### 次にやること

1. reveal モードを `src/modes/reveal/` にまとめる（今の `App.tsx`・`mdx-components.tsx`・reveal に固有の CSS）
2. デッキがモードを選べるようにする（`decks/<名前>/` の設定のファイル。impress の座標の決め方もそこに）
3. impress モードの足りないもの（上）を埋める
4. 3 つ目のモード（Shower など）。共通の書き方をそこで見直す

### 決めたこと

- 発表者ビューは各ライブラリのものを使う（reveal はノートのプラグイン、impress は impressConsole）
- 縦のスライド（`--`）は内容の層では「節の中の続き」。表し方はモードが決める（reveal は縦、impress は下に置く）
- 段階表示は `\pause` などの Beamer の書き方でも `<Fragment>` でも書ける

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
