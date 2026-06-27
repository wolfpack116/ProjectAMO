import { useState } from 'react'
import { listProfiles, saveProfile, deleteProfile, setLastUsed } from './lib/aircraftProfiles.js'
import { formatAltitude, stepAltitude, vfrCruiseHint } from './lib/altitude.js'

export default function AircraftProfileField({ tasKt, altitudeFt, magCourseDeg, onChange }) {
  const [profiles, setProfiles] = useState(() => listProfiles())
  const [open, setOpen] = useState(false)

  const apply = (tas, alt) => { onChange({ tasKt: tas, altitudeFt: alt }); setLastUsed({ tasKt: tas, altitudeFt: alt }) }
  const pick = (p) => { apply(p.tasKt, p.altitudeFt); setOpen(false) }
  const onSave = () => {
    const name = window.prompt('항공기 이름')
    if (!name) return
    setProfiles(saveProfile({ name, tasKt, altitudeFt }))
  }
  const onDelete = (name) => setProfiles(deleteProfile(name))

  return (
    <div className="acp">
      <div className="acp-head">
        <button type="button" className="acp-select" onClick={() => setOpen((o) => !o)}>
          <span className="acp-label">내 항공기</span>
          <span className="acp-value">{tasKt}kt · {formatAltitude(altitudeFt)} ▾</span>
        </button>
        <button type="button" className="acp-save" onClick={onSave}>저장</button>
      </div>
      {open && (
        <div className="acp-list">
          {profiles.length === 0 && <div className="acp-empty">저장된 항공기 없음</div>}
          {profiles.map((p) => (
            <div key={p.name} className="acp-item">
              <button type="button" className="acp-item-pick" onClick={() => pick(p)}>{p.name} <span>{p.tasKt}kt · {formatAltitude(p.altitudeFt)}</span></button>
              <button type="button" className="acp-item-del" onClick={() => onDelete(p.name)} aria-label="삭제">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="acp-perf">
        <label className="acp-field">
          <span>순항속도 (TAS)</span>
          <input type="number" min="1" step="1" value={tasKt} onChange={(e) => apply(Number(e.target.value), altitudeFt)} />
          <em>kt</em>
        </label>
        <label className="acp-field">
          <span>순항고도</span>
          <div className="acp-alt">
            <input type="number" min="0" step="500" value={altitudeFt} onChange={(e) => apply(tasKt, Number(e.target.value))} />
            <span className="acp-alt-fmt">{formatAltitude(altitudeFt)}</span>
            <span className="acp-step">
              <button type="button" onClick={() => apply(tasKt, stepAltitude(altitudeFt, 1))} aria-label="고도 올림">▲</button>
              <button type="button" onClick={() => apply(tasKt, stepAltitude(altitudeFt, -1))} aria-label="고도 내림">▼</button>
            </span>
          </div>
        </label>
      </div>
      {magCourseDeg != null && <div className="acp-hint">{vfrCruiseHint(magCourseDeg)}</div>}
    </div>
  )
}
