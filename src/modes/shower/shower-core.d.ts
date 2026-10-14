// @shower/core は型を持たない。ShowerApp.tsx が使う分だけ
declare module '@shower/core/lib/shower.js' {
  export default class Shower extends EventTarget {
    constructor(options?: Record<string, unknown>)
    start(): void
    readonly slides: { element: HTMLElement }[]
    readonly activeSlide: { element: HTMLElement } | undefined
    readonly isFullMode: boolean
  }
}
