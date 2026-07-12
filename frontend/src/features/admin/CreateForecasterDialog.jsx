import { useState } from 'react'
import { X } from 'lucide-react'
import { createForecaster } from './adminApi.js'

// 예보관 담당공항 후보(백엔드 FORECASTER_AIRPORTS와 동일한 7개).
const AIRPORTS = [
  { icao: 'RKSI', name: '인천' }, { icao: 'RKSS', name: '김포' }, { icao: 'RKPC', name: '제주' },
  { icao: 'RKJB', name: '무안' }, { icao: 'RKNY', name: '양양' }, { icao: 'RKJY', name: '여수' },
  { icao: 'RKPU', name: '울산' },
]

const ERROR_KO = {
  username_taken: '이미 사용 중인 아이디입니다.',
  invalid_username: '아이디는 3~32자 영문·숫자·_ 여야 합니다.',
  invalid_password: '비밀번호는 8자 이상이어야 합니다.',
}

export default function CreateForecasterDialog({ onClose, onCreated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [airports, setAirports] = useState([])
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function toggleAirport(icao) {
    setAirports((prev) => (prev.includes(icao) ? prev.filter((a) => a !== icao) : [...prev, icao]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createForecaster({ username, password, displayName: displayName || username, airports })
      onCreated?.()
      onClose()
    } catch (err) {
      setError(ERROR_KO[err.body?.error] || '생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-dialog-overlay" onClick={onClose}>
      <div className="admin-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="예보관 추가">
        <button className="admin-dialog-close" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        <form className="admin-dialog-form" onSubmit={handleSubmit}>
          <div className="admin-dialog-title">예보관 추가</div>

          <label className="admin-field">
            <span>아이디</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="영문·숫자·_ 3~32자" />
          </label>
          <label className="admin-field">
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" autoComplete="new-password" />
          </label>
          <label className="admin-field">
            <span>표시 이름</span>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="예: 인천 예보관" />
          </label>

          <div className="admin-field">
            <span>담당 공항</span>
            <div className="admin-airport-grid">
              {AIRPORTS.map((a) => (
                <button
                  key={a.icao} type="button"
                  className={`admin-airport-chip${airports.includes(a.icao) ? ' is-on' : ''}`}
                  onClick={() => toggleAirport(a.icao)}
                >
                  {a.name}<small>{a.icao}</small>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="admin-dialog-error" role="alert">{error}</div>}

          <button className="admin-dialog-submit" type="submit" disabled={submitting || !username || !password}>
            {submitting ? '생성 중…' : '예보관 생성'}
          </button>
        </form>
      </div>
    </div>
  )
}
