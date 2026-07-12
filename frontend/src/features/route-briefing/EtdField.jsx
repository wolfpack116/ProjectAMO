import { buildEtdIso, etdFields } from './lib/briefingTime.js'

const RELATIVE = [['지금', 0], ['+30분', 30], ['+1시간', 60], ['+2시간', 120]]

function nowPlusIso(minutes) {
  const d = new Date(Date.now() + minutes * 60000)
  d.setUTCSeconds(0, 0)
  return d.toISOString().replace('.000Z', 'Z')
}

export default function EtdField({ etd, tz, variant, onChange }) {
  const f = etdFields(etd, tz)
  const setPart = (patch) => onChange(buildEtdIso({ ...f, ...patch }, tz))
  const timeValue = `${String(f.hour).padStart(2, '0')}:${String(f.minute).padStart(2, '0')}`
  const onTime = (e) => {
    const [h, mi] = e.target.value.split(':').map(Number)
    if (Number.isFinite(h) && Number.isFinite(mi)) setPart({ hour: h, minute: mi })
  }
  const chips = (
    <div className="etd-chips">
      {RELATIVE.map(([label, mins]) => (
        <button key={label} type="button" className="etd-chip" onClick={() => onChange(nowPlusIso(mins))}>{label}</button>
      ))}
    </div>
  )

  if (variant === 'mobile') {
    const today = etdFields(nowPlusIso(0), tz)
    const isTomorrow = f.day !== today.day
    return (
      <div className="etd-field etd-field--mobile">
        <div className="etd-day-chips">
          <button type="button" className={`etd-chip${!isTomorrow ? ' is-active' : ''}`} onClick={() => setPart({ month: today.month, day: today.day })}>오늘</button>
          <button type="button" className={`etd-chip${isTomorrow ? ' is-active' : ''}`} onClick={() => { const t = etdFields(nowPlusIso(24 * 60), tz); setPart({ month: t.month, day: t.day }) }}>내일</button>
        </div>
        <input className="etd-time-wheel" type="time" value={timeValue} onChange={onTime} aria-label="출발 시각" />
        {chips}
      </div>
    )
  }

  return (
    <div className="etd-field etd-field--desktop">
      <div className="etd-row">
        <select value={f.month} onChange={(e) => setPart({ month: Number(e.target.value) })} aria-label="출발 월">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>
        <select value={f.day} onChange={(e) => setPart({ day: Number(e.target.value) })} aria-label="출발 일">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}일</option>)}
        </select>
        <input className="etd-time-typed" type="time" value={timeValue} onChange={onTime} aria-label="출발 시각" />
      </div>
      {chips}
    </div>
  )
}
