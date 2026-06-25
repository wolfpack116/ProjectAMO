import { useState } from 'react'
import './AirportPickerField.css'

// from→to airport row: shows the current selection (Korean name + ICAO) and
// expands an inline chip picker (airports + an optional FIR entry below a
// divider). Presentational — options are passed in so this stays in shared/ui.
// Props:
//   label, value, onChange(value)
//   options: [{ value: 'RKSI', ko: '인천' }]
//   firOption?: { value, label }
//   disabledValue?: value to disable (e.g. the airport picked on the other side)
export default function AirportPickerField({ label, value, options, firOption, onChange, disabledValue }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const isFir = firOption && value === firOption.value

  function pick(next) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="apf">
      <button type="button" className="apf-row" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
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
        <div className="apf-picker">
          <div className="apf-grid">
            {options.map((o) => (
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
          {firOption && (
            <>
              <span className="apf-divider" aria-hidden="true" />
              <button
                type="button"
                className={`apf-chip apf-chip--fir${isFir ? ' is-active' : ''}`}
                onClick={() => pick(firOption.value)}
              >
                <span className="apf-chip-ko">{firOption.label}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
