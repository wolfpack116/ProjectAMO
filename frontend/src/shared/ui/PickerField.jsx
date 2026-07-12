import { useState } from 'react'
import './PickerField.css'

// Generic dependent tap-field → inline option list (replaces native <select> on
// mobile). Presentational only: the parent owns option building, reset-on-parent
// -change, and any auto-select policy. Handles the 0/1/N states visually.
// Props:
//   label, value, onChange(value)
//   options: [{ value, label }]
//   disabled?, emptyNote?, placeholder?
export default function PickerField({
  label,
  value,
  options = [],
  onChange,
  disabled = false,
  emptyNote,
  placeholder = '선택',
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const isEmpty = options.length === 0
  const effectiveDisabled = disabled || isEmpty

  function pick(next) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className={`pkf${effectiveDisabled ? ' is-disabled' : ''}`}>
      <button
        type="button"
        className="pkf-row"
        disabled={effectiveDisabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="pkf-label">{label}</span>
        <span className="pkf-value">
          {selected
            ? selected.label
            : <span className="pkf-placeholder">{isEmpty && emptyNote ? emptyNote : placeholder}</span>}
          {!effectiveDisabled && <span className={`pkf-caret${open ? ' is-open' : ''}`} aria-hidden="true">▾</span>}
        </span>
      </button>

      {open && !effectiveDisabled && (
        <div className="pkf-list" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              className={`pkf-option${value === o.value ? ' is-active' : ''}`}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
