function WeatherLayerTimestampBar({ entries = [] }) {
  const validEntries = entries.filter((e) => e.issueLabel && e.issueLabel !== '-')
  if (validEntries.length === 0) return null

  return (
    <div className="layer-timestamp-bar" aria-label="레이어 발표·유효 시간">
      {validEntries.map((entry) => (
        <div key={entry.key} className="layer-timestamp-entry">
          <span className="layer-timestamp-name">{entry.label}</span>
          <span className="layer-timestamp-time">발표 {entry.issueLabel}</span>
          {entry.validLabel && entry.validLabel !== '-' && (
            <span className="layer-timestamp-time">유효 {entry.validLabel}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default WeatherLayerTimestampBar
