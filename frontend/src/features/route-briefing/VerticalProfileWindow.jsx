import { useState } from 'react'
import VerticalProfileChart from './VerticalProfileChart.jsx'

export default function VerticalProfileWindow({ profile, crossSection, isOpen, onClose }) {
  const [layers, setLayers] = useState({ temp: true, wind: true, icing: false, moisture: false })
  if (!profile || !isOpen) return null

  const toggle = (key) => setLayers((prev) => {
    const next = { ...prev, [key]: !prev[key] }
    if (key === 'icing' && next.icing) next.moisture = false
    if (key === 'moisture' && next.moisture) next.icing = false
    return next
  })

  return (
    <div className="vertical-profile-window-backdrop" role="presentation">
      <section className="vertical-profile-window" role="dialog" aria-modal="true" aria-label={'연직단면도'}>
        <div className="vertical-profile-window-header">
          <div>
            <div className="vertical-profile-window-eyebrow">Vertical Profile</div>
            <div className="vertical-profile-window-title">{'연직단면도'}</div>
          </div>
          <button type="button" className="vertical-profile-window-close" onClick={onClose}>{'닫기'}</button>
        </div>
        <div className="cross-section-toggles" role="group" aria-label="레이어">
          {[['temp', 'TEMP'], ['moisture', 'Moisture'], ['icing', 'Icing'], ['wind', 'Wind']].map(([k, label]) => (
            <button key={k} type="button" className={`cs-toggle${layers[k] ? ' is-on' : ''}`} aria-pressed={layers[k]} onClick={() => toggle(k)}>{label}</button>
          ))}
        </div>
        <VerticalProfileChart profile={profile} crossSection={crossSection} layers={layers} />
      </section>
    </div>
  )
}
