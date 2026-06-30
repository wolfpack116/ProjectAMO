import { Settings, Bell, Monitor, HelpCircle, ChevronRight, Search } from 'lucide-react'

// "더보기" task: full-screen list of secondary destinations.
// NOTAM은 본 기능 도입 전까지 숨김(데스크톱 사이드바와 일관).
// 모바일은 사이드바가 숨으므로 검색 진입점을 여기에 둔다(헌법 §6).
export default function MobileMoreMenu({ onSearch, onSettings, onUpdates, hasUpdate }) {
  const items = [
    { id: 'search', label: '검색', icon: Search, onClick: onSearch },
    { id: 'updates', label: '업데이트', icon: Bell, onClick: onUpdates, dot: hasUpdate },
    { id: 'settings', label: '설정', icon: Settings, onClick: onSettings },
    { id: 'monitoring', label: '상황판', icon: Monitor, onClick: () => window.location.assign('/monitoring') },
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
