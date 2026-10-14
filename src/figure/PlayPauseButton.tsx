/**
 * 図の動きを再生・一時停止するボタン。再生中は一時停止の印、停止中は再生の印を出す。
 * 図(.figure-block)の右上に小さく置き、普段は薄く表示する(見た目は theme/base.css の .figure-button)。
 */
export default function PlayPauseButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  const label = playing ? '一時停止' : '再生'
  return (
    <button type="button" className="figure-button" onClick={onToggle} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {playing ? (
          <path className="figure-icon-fill" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
        ) : (
          <path className="figure-icon-fill" d="M8 5v14l11-7z" />
        )}
      </svg>
    </button>
  )
}
