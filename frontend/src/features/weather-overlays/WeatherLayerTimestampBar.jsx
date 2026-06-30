import { Fragment } from 'react'
import { Clock } from 'lucide-react'

// ICAO requires the issue/valid time of met data to be clearly shown. This panel unifies every active
// forecast layer's 발표(issue)/유효(valid) time in one place (bottom-left, above the timeline).
// Observed layers (radar/satellite/lightning) are covered by the timeline + legends, so they are not listed here.
function stripTz(label, tz) {
  return String(label || '').replace(new RegExp(`\\s+${tz}$`), '').replace(/\s+(KST|UTC)$/, '')
}

function WeatherLayerTimestampBar({ entries = [], tz = 'KST' }) {
  const validEntries = entries.filter((e) => e.issueLabel && e.issueLabel !== '-')
  if (validEntries.length === 0) return null

  return (
    <div className="layer-timestamp-bar" aria-label="기상자료 발표·유효 시각">
      <div className="layer-timestamp-header">
        <Clock size={13} aria-hidden="true" />
        <span>기상자료 시각 · {tz}</span>
      </div>
      <div className="layer-timestamp-grid">
        {validEntries.map((entry) => {
          const hasValid = entry.validLabel && entry.validLabel !== '-'
          return (
            <Fragment key={entry.key}>
              <span className="layer-timestamp-name">{entry.label}</span>
              <span className="layer-timestamp-cell">
                <span className="layer-timestamp-label">발표</span>{stripTz(entry.issueLabel, tz)}
              </span>
              <span className="layer-timestamp-cell">
                {hasValid && (<><span className="layer-timestamp-label">유효</span>{stripTz(entry.validLabel, tz)}</>)}
              </span>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default WeatherLayerTimestampBar
