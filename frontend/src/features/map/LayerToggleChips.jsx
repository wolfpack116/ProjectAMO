import './LayerToggleChips.css'

// 지도 레이어 토글칩 묶음 — 브리핑(MET)·VFR 입력(항공)이 공유.
// items: [{ key, label, on, onToggle }]. 상태(on)를 보여주고 누르면 토글.
export default function LayerToggleChips({ items, ariaLabel = '레이어' }) {
  if (!items?.length) return null
  return (
    <div className="layer-toggle-chips" role="group" aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`ltc-chip${it.on ? ' is-on' : ''}`}
          aria-pressed={it.on}
          onClick={it.onToggle}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
