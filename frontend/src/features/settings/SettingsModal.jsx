import { useState } from 'react'
import { X } from 'lucide-react'
import {
  DEFAULT_AIRPORT_MINIMA_RULES,
  normalizeAirportMinimaSettings,
} from '../monitoring/legacy/utils/helpers'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'
import './SettingsModal.css'

const AIRPORT_ORDER = ['RKSI', 'RKSS', 'RKPC', 'RKPK', 'RKTU', 'RKTN', 'RKTH', 'RKJB', 'RKJJ', 'RKJK', 'RKJY', 'RKNW', 'RKPS', 'RKPU', 'RKNY']
const NO_DH_AIRPORTS = new Set(['RKSI', 'RKSS'])

function loadMinima() {
  try {
    const raw = localStorage.getItem('airport_minima_settings')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function SettingsModal({ onClose }) {
  const { setTz } = useTimeZone()
  const [activeTab, setActiveTab] = useState('general')

  const [timeZone, setTimeZone] = useState(() => localStorage.getItem('time_zone') || 'KST')
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'ko')

  const [minima, setMinima] = useState(() =>
    normalizeAirportMinimaSettings(loadMinima())
  )

  function updateMinima(icao, key, value) {
    setMinima((prev) => ({
      ...prev,
      [icao]: {
        ...prev[icao],
        [key]: value === '' ? null : Number(value),
      },
    }))
  }

  function saveToStorage() {
    localStorage.setItem('time_zone', timeZone)
    localStorage.setItem('language', language)
    localStorage.setItem('airport_minima_settings', JSON.stringify(minima))
    setTz(timeZone)
  }

  function handleApply() {
    saveToStorage()
  }

  function handleSave() {
    saveToStorage()
    onClose()
  }

  function handleReset() {
    setTimeZone('KST')
    setLanguage('ko')
    setMinima(normalizeAirportMinimaSettings(DEFAULT_AIRPORT_MINIMA_RULES))
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>설정</h2>
          <button className="settings-close-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="settings-layout">
          <div className="settings-tabs">
            <button
              className={`settings-tab-btn${activeTab === 'general' ? ' active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              일반
            </button>
            <button
              className={`settings-tab-btn${activeTab === 'minima' ? ' active' : ''}`}
              onClick={() => setActiveTab('minima')}
            >
              공항 미니마
            </button>
          </div>

          <div className="settings-body">
            {activeTab === 'general' && (
              <fieldset className="settings-section">
                <legend>표시 설정</legend>
                <label className="settings-row">
                  <span>시간대</span>
                  <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                    <option value="UTC">UTC</option>
                    <option value="KST">KST (UTC+9)</option>
                  </select>
                </label>
                <label className="settings-row">
                  <span>언어</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </fieldset>
            )}

            {activeTab === 'minima' && (
              <fieldset className="settings-section">
                <legend>공항별 LIFR 기준값</legend>
                <div className="minima-grid">
                  {AIRPORT_ORDER.map((icao) => {
                    const rule = minima[icao] || { visibilityM: null, ceilingFt: null }
                    const noDh = NO_DH_AIRPORTS.has(icao)
                    return (
                      <div key={icao} className="minima-card">
                        <div className="minima-card-head">{icao}</div>
                        <label className="minima-card-row">
                          <span>시정(m)</span>
                          <input
                            type="number"
                            min={50}
                            max={5000}
                            step={25}
                            value={rule.visibilityM ?? ''}
                            onChange={(e) => updateMinima(icao, 'visibilityM', e.target.value)}
                          />
                        </label>
                        <label className="minima-card-row">
                          <span>운고(ft)</span>
                          <input
                            type="number"
                            min={50}
                            max={1000}
                            step={10}
                            value={rule.ceilingFt ?? ''}
                            onChange={(e) => updateMinima(icao, 'ceilingFt', e.target.value)}
                            placeholder={noDh ? 'NO DH' : ''}
                          />
                        </label>
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-btn-reset" onClick={handleReset}>초기화</button>
          <button className="settings-btn-apply" onClick={handleApply}>적용</button>
          <button className="settings-btn-save" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  )
}
