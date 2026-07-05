import { useState, useRef, useEffect, useMemo } from 'react'
import './AirportPickerField.css'

// 출발/도착 공항 피커: 현재 선택(한글명+ICAO)을 보여주고, 열면 버튼 바로 아래에 드롭다운이 뜬다.
// 드롭다운은 2단 드릴다운 — 좌 "지역(국가) 목록"을 고르면 우측에 그 지역의 공항만 표시.
// Props:
//   label, value, onChange(value)
//   options: [{ value, ko, region }]
//   firOption?: { value, label }  — 지역 목록 맨 아래 특수 항목(FIR 진입/이탈)
//   disabledValue?: value to disable (반대편에서 고른 공항)
//   align?: 'left' | 'right'  — 드롭다운 정렬(도착 피커는 'right'로 패널 밖으로 안 나가게)
const REGION_ORDER = ['대한민국', '일본', '중국', '대만·홍콩·마카오·몽골', '베트남', '필리핀', '태국', '동남아']

function regionRank(region) {
  const i = REGION_ORDER.indexOf(region)
  return i === -1 ? REGION_ORDER.length : i
}

export default function AirportPickerField({ label, value, options, firOption, onChange, disabledValue, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const [activeRegion, setActiveRegion] = useState(null)
  const rootRef = useRef(null)

  const selected = options.find((o) => o.value === value)
  const isFir = firOption && value === firOption.value

  const byRegion = useMemo(() => {
    const map = new Map()
    for (const o of options) {
      const r = o.region || '기타'
      if (!map.has(r)) map.set(r, [])
      map.get(r).push(o)
    }
    return new Map([...map.entries()].sort((a, b) => regionRank(a[0]) - regionRank(b[0])))
  }, [options])
  const regions = [...byRegion.keys()]

  function openPicker() {
    const initial = selected?.region && byRegion.has(selected.region) ? selected.region : regions[0] ?? null
    setActiveRegion(initial)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    function onDocPointer(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(next) {
    onChange(next)
    setOpen(false)
  }

  const activeAirports = activeRegion ? (byRegion.get(activeRegion) ?? []) : []

  return (
    <div className={`apf${align === 'right' ? ' apf-align-right' : ''}`} ref={rootRef}>
      <button type="button" className="apf-row" onClick={() => (open ? setOpen(false) : openPicker())} aria-expanded={open}>
        <span className="apf-label">{label}</span>
        <span className="apf-value">
          {selected
            ? (<>{selected.ko} <span className="apf-icao">{selected.value}</span></>)
            : isFir
              ? firOption.label
              : <span className="apf-placeholder">선택</span>}
          <span className={`apf-caret${open ? ' is-open' : ''}`} aria-hidden="true">▾</span>
        </span>
      </button>

      {open && (
        <div className="apf-pop">
          <div className="apf-regions">
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                className={`apf-region${activeRegion === r ? ' is-active' : ''}`}
                onClick={() => setActiveRegion(r)}
              >
                {r}
              </button>
            ))}
            {firOption && (
              <button
                type="button"
                className={`apf-region apf-region--fir${isFir ? ' is-active' : ''}`}
                onClick={() => pick(firOption.value)}
              >
                {firOption.label}
              </button>
            )}
          </div>
          <div className="apf-airports">
            {activeAirports.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`apf-chip${value === o.value ? ' is-active' : ''}`}
                disabled={disabledValue != null && disabledValue === o.value}
                onClick={() => pick(o.value)}
              >
                <span className="apf-chip-ko">{o.ko}</span>
                <span className="apf-chip-icao">{o.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
