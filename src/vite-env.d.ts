/// <reference types="vite/client" />

/** vite/citations.ts が生成する。order = デッキ全体の初出順の key */
declare module 'virtual:bibliography' {
  export const order: string[]
  export const entries: Record<string, { html: string; text: string }>
}

declare module 'reveal.js/plugin/notes/notes.esm.js' {
  const RevealNotes: () => unknown
  export default RevealNotes
}
