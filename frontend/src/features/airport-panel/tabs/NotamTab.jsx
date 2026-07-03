import { useMemo, useState } from 'react'
import { Ban, Crosshair, AlertTriangle, ShieldHalf, RadioTower, Radio, MoreHorizontal, ChevronDown, Globe } from 'lucide-react'
import { NOTAM_CATEGORIES, TIME_STATE, deriveTimeState, formatAltitude, formatValidPeriod, sortActiveFirst } from '../../notam/lib/notamViewModel.js'
import '../../notam/NotamPanel.css'

const CAT_ICON = {
  prohibited: Ban, firing: Crosshair, danger: AlertTriangle, restricted: ShieldHalf,
  obstacle: RadioTower, facility: Radio, other: MoreHorizontal,
}
const catLabelOf = (id) => (NOTAM_CATEGORIES.find((c) => c.id === id) || { label: '기타' }).label

function CatIcon({ id, size = 15 }) {
  const Icon = CAT_ICON[id] || MoreHorizontal
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />
}

function TimeBadge({ state }) {
  const ts = TIME_STATE[state] || TIME_STATE.upcoming
  return <span className={`notam-ts ts-${ts.key}`}><span className="notam-ts-glyph" aria-hidden="true">{ts.glyph}</span>{ts.label}</span>
}

function NotamCard({ item, nowMs }) {
  const [open, setOpen] = useState(false)
  const state = deriveTimeState(item.valid_from, item.valid_to, nowMs)
  const alt = formatAltitude(item.altitude)
  return (
    <div className="notam-tab-card" onClick={() => setOpen((o) => !o)}>
      <div className="notam-tab-card-head">
        <CatIcon id={item.category} />
        <span className="notam-tab-cat">{catLabelOf(item.category)}</span>
        <TimeBadge state={state} />
      </div>
      <div className="notam-tab-meta"><span>{item.id}</span>{alt && <><span>·</span><span>{alt}</span></>}</div>
      <div className="notam-tab-valid"><span className="notam-tab-valid-lbl">유효</span>{formatValidPeriod(item.valid_from, item.valid_to)}</div>
      <div className="notam-tab-sum">{item.summary}</div>
      <div className="notam-tab-more">원문 보기 <ChevronDown size={13} className={open ? 'notam-chev is-open' : 'notam-chev'} aria-hidden="true" /></div>
      {open && <pre className="notam-raw">{item.rawText || item.summary}</pre>}
    </div>
  )
}

function NotamTab({ notam, icao, nowMs = Date.now() }) {
  const items = useMemo(() => Array.isArray(notam?.items) ? notam.items : [], [notam])
  const airportItems = useMemo(
    () => sortActiveFirst(items.filter((it) => it.scope !== 'fir' && it.location === icao), nowMs),
    [items, icao, nowMs],
  )
  const firItems = useMemo(
    () => sortActiveFirst(items.filter((it) => it.scope === 'fir'), nowMs),
    [items, nowMs],
  )

  if (airportItems.length === 0 && firItems.length === 0) {
    return <div className="ap-empty">유효한 NOTAM이 없습니다.</div>
  }

  return (
    <div className="notam-tab">
      {airportItems.map((it) => <NotamCard key={it.id} item={it} nowMs={nowMs} />)}

      {firItems.length > 0 && (
        <div className="notam-tab-fir">
          <div className="notam-tab-fir-title"><Globe size={13} aria-hidden="true" />전역 공지(인천FIR) · {firItems.length}건</div>
          {firItems.map((it) => (
            <div key={`fir-${it.id}`} className="notam-tab-fir-row">
              <CatIcon id={it.category} size={14} />
              <span className="notam-tab-fir-sum">{it.summary}</span>
              <TimeBadge state={deriveTimeState(it.valid_from, it.valid_to, nowMs)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotamTab
