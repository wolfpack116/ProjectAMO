import { useMemo } from 'react'
import { NOTAM_CATEGORIES, deriveTimeState, formatAltitude, formatValidPeriod, notamSummary, sortActiveFirst } from '../../notam/lib/notamViewModel.js'
import NotamCell from '../../notam/NotamCell.jsx'

const catLabelOf = (id) => (NOTAM_CATEGORIES.find((c) => c.id === id) || { label: '기타' }).label

function NotamTab({ notam, icao, nowMs = Date.now() }) {
  const items = useMemo(() => (Array.isArray(notam?.items) ? notam.items : []), [notam])
  const airportItems = useMemo(
    () => sortActiveFirst(items.filter((it) => it.scope !== 'fir' && it.location === icao), nowMs),
    [items, icao, nowMs],
  )
  if (airportItems.length === 0) {
    return <div className="ap-empty">유효한 NOTAM이 없습니다.</div>
  }

  return (
    <div className="notam-cellgrid">
      {airportItems.map((it) => (
        <NotamCell
          key={it.id}
          category={it.category}
          timeState={deriveTimeState(it.valid_from, it.valid_to, nowMs)}
          summary={notamSummary(it) || it.summary || it.id}
          metaText={`${catLabelOf(it.category)} · ${it.id}`}
          altitude={formatAltitude(it.altitude)}
          rawText={it.rawText || it.summary}
          validText={formatValidPeriod(it.valid_from, it.valid_to)}
        />
      ))}
    </div>
  )
}

export default NotamTab
