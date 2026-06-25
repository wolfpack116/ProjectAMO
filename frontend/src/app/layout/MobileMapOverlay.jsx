import { Layers, Cloud } from 'lucide-react'

// Mobile 지도 task: status-first strip + on-map layer entry points
// (the sidebar that normally opens these is hidden on mobile).
export default function MobileMapOverlay({ activePanel, onToggle, warningCount }) {
  const hasWarn = warningCount > 0
  return (
    <>
      <div className={`mobile-status-strip${hasWarn ? ' is-alert' : ' is-ok'}`}>
        {hasWarn ? `⚠ 공항경보 ${warningCount}곳 발효 중` : '✓ 활성 공항경보 없음'}
      </div>
      <div className="mobile-map-layer-btns">
        <button
          type="button"
          className={`mobile-map-layer-btn${activePanel === 'aviation' ? ' is-active' : ''}`}
          onClick={() => onToggle('aviation')}
          aria-label="항공정보 레이어"
        >
          <Layers size={20} strokeWidth={2} />
          <span>항공</span>
        </button>
        <button
          type="button"
          className={`mobile-map-layer-btn${activePanel === 'met' ? ' is-active' : ''}`}
          onClick={() => onToggle('met')}
          aria-label="기상정보 레이어"
        >
          <Cloud size={20} strokeWidth={2} />
          <span>기상</span>
        </button>
      </div>
    </>
  )
}
