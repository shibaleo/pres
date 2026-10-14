/**
 * 図を初期状態に戻すボタン。図(.figure-block)の右上に小さく置き、普段は薄く表示する
 * (見た目は theme/base.css の .figure-button。印刷・PDF には出さない)。
 */
export default function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="figure-button" onClick={onClick} aria-label="図を元に戻す" title="元に戻す">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />
      </svg>
    </button>
  )
}
