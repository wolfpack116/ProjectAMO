import { Settings, Bell, Monitor, TriangleAlert, HelpCircle, ChevronRight } from 'lucide-react'

// "더보기" task: full-screen list of secondary destinations.
export default function MobileMoreMenu({ onSettings, onUpdates, hasUpdate }) {
  const items = [
    { id: 'updates', label: '업데이트', icon: Bell, onClick: onUpdates, dot: hasUpdate },
    { id: 'settings', label: '설정', icon: Settings, onClick: onSettings },
    { id: 'monitoring', label: '상황판', icon: Monitor, onClick: () => window.location.assign('/monitoring') },
    { id: 'notam', label: 'NOTAM', icon: TriangleAlert, disabled: true },
    { id: 'help', label: '도움말', icon: HelpCircle, disabled: true },
  ]
  return (
    <div className="mobile-more">
      <h2 className="mobile-more-title">더보기</h2>
      <ul className="mobile-more-list">
        {items.map(({ id, label, icon: Icon, onClick, dot, disabled }) => (
          <li key={id}>
            <button
              type="button"
              className="mobile-more-item"
              onClick={onClick}
              disabled={disabled}
            >
              <span className="mobile-more-item-icon">
                <Icon size={20} strokeWidth={2} />
                {dot && <span className="mobile-more-dot" />}
              </span>
              <span className="mobile-more-item-label">{label}</span>
              {!disabled && <ChevronRight size={18} className="mobile-more-chevron" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
