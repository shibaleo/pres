import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// reveal.js core + theme + KaTeX, all bundled locally (no CDN).
// theme.css は最後に読み込む(reveal white テーマを上書きするため)。
import 'reveal.js/dist/reveal.css'
import 'reveal.js/dist/theme/white.css'
import 'katex/dist/katex.min.css'
import './index.css'
import './theme.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
