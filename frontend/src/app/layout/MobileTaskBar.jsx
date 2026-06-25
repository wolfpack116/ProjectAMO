import { Map as MapIcon, FileText, MoreHorizontal } from 'lucide-react'
import './MobileTaskBar.css'

const TASKS = [
  { id: 'map', label: '지도', icon: MapIcon },
  { id: 'route', label: '브리핑', icon: FileText },
  { id: 'more', label: '더보기', icon: MoreHorizontal },
]

// Bottom task switcher for mobile — the shared backbone replacing the icon rail.
export default function MobileTaskBar({ activeTask, onSelect, hasUpdate }) {
  return (
    <nav className="mobile-task-bar" aria-label="주요 작업">
      {TASKS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`mobile-task-btn${activeTask === id ? ' is-active' : ''}`}
          onClick={() => onSelect(id)}
          aria-current={activeTask === id ? 'page' : undefined}
        >
          <span className="mobile-task-icon">
            <Icon size={22} strokeWidth={2.1} />
            {id === 'more' && hasUpdate && <span className="mobile-task-dot" />}
          </span>
          <span className="mobile-task-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
