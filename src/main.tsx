import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// reveal.js core + theme, all bundled locally (no CDN).
// theme/index.css は最後に読み込む(reveal white テーマを上書きするため)。
import 'reveal.js/dist/reveal.css'
import 'reveal.js/dist/theme/white.css'
import './theme/index.css'

// デッキ全体にかけるプリセット(src/custom.css の --deck-preset。空白区切りで複数可)を
// <html data-preset> に移す。プリセットは [data-preset~="名前"] の範囲にかかる(theme/presets/)
const preset = getComputedStyle(document.documentElement).getPropertyValue('--deck-preset').trim()
if (preset) document.documentElement.dataset.preset = preset

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
