import { formatKstMinute } from './lib/weatherTimeline.js'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'

function AdsbTimestamp({ isVisible, updatedAt, compact = false }) {
  const { tz } = useTimeZone()
  const updatedMs = Date.parse(updatedAt || '')
  if (!isVisible || !Number.isFinite(updatedMs)) return null

  return (
    <div className={`adsb-timestamp${compact ? ' adsb-timestamp--compact' : ''}`} aria-label="ADS-B reference time">
      ADS-B {formatKstMinute(updatedMs, tz)}
    </div>
  )
}

export default AdsbTimestamp
