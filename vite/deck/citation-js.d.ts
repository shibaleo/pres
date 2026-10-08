// @citation-js/* は型定義を同梱していないので、使う範囲だけ宣言する
declare module '@citation-js/core' {
  export class Cite {
    constructor(data: unknown)
    data: Array<{ id: string } & Record<string, unknown>>
    format(style: 'bibliography', options: Record<string, unknown>): string
  }
}
declare module '@citation-js/plugin-bibtex'
declare module '@citation-js/plugin-csl'
