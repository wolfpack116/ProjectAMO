import VerticalProfileChart from './VerticalProfileChart.jsx'
import { useCrossSectionLayers, CrossSectionToggles } from './crossSectionLayers.jsx'

export default function VerticalProfileWindow({ profile, crossSection, isOpen, onClose, advisories = [] }) {
  const [layers, toggle] = useCrossSectionLayers()
  if (!profile || !isOpen) return null

  return (
    <div className="vertical-profile-window-backdrop" role="presentation">
      <section className="vertical-profile-window" role="dialog" aria-modal="false" aria-label={'연직단면도'}>
        <div className="vertical-profile-window-header">
          <div>
            <div className="vertical-profile-window-eyebrow">Vertical Profile</div>
            <div className="vertical-profile-window-title">{'연직단면도'}</div>
          </div>
          <button type="button" className="vertical-profile-window-close" onClick={onClose}>{'닫기'}</button>
        </div>
        <CrossSectionToggles layers={layers} onToggle={toggle} />
        <VerticalProfileChart profile={profile} crossSection={crossSection} layers={layers} advisories={advisories} />
      </section>
    </div>
  )
}
