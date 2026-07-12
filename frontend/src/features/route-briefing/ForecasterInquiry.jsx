import { useState } from 'react'
import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, Dropdown, Option, Button } from '../../shared/ui/fluent.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { saveRoute } from './lib/routeStore.js'
import { FORECASTER_CONTACTS } from './lib/forecasterContacts.js'
import './ForecasterInquiry.css'

// #6 조종사 → 예보관 문의. 브리핑 패널 맨끝. 안내문 + [전화번호 보기] → 전화목록 + [담당 예보관에게 보내기].
// 보내기: 현재 경로 자동 저장(서버) 후 POST /api/me/requests. 로그인 필요.
export default function ForecasterInquiry({ snapshot, disabled }) {
  const { user } = useAuth()
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [target, setTarget] = useState(FORECASTER_CONTACTS[0].icao)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const targetLabel = (() => {
    const c = FORECASTER_CONTACTS.find((x) => x.icao === target)
    return c ? `${c.ko}(${c.icao})` : target
  })()

  async function send() {
    setSending(true)
    setError(null)
    try {
      const rf = snapshot.routeForm || {}
      const name = `${rf.departureAirport || '?'} → ${rf.arrivalAirport || '?'}`
      const entry = await saveRoute(name, snapshot) // 로그인 시 서버 저장 → 정수 id
      if (!entry || typeof entry.id !== 'number') { setError('로그인이 필요합니다.'); return }
      const res = await fetch('/api/me/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route_id: entry.id, target_airport: target, message: message.trim() || undefined }),
      })
      if (res.ok) { setDone(true); setDlgOpen(false); setPhoneOpen(false); return }
      const e = await res.json().catch(() => ({}))
      setError(e.error === 'route_not_found' ? '경로 저장에 실패했습니다.' : '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rb-inquiry">
      <p className="rb-inquiry-notice">더 자세한 예보에 관한 문의는 해당 기상대로 주시기 바랍니다.</p>

      {!phoneOpen ? (
        <Button appearance="secondary" size="small" onClick={() => setPhoneOpen(true)}>전화번호 보기</Button>
      ) : (
        <div className="rb-inquiry-open">
          <ul className="rb-phone-list">
            {FORECASTER_CONTACTS.map((c) => (
              <li key={c.icao}>
                <span className="rb-phone-ap">{c.ko}<span className="rb-phone-icao"> {c.icao}</span></span>
                <a className="rb-phone-num" href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}>{c.phone}</a>
              </li>
            ))}
          </ul>
          {done ? (
            <p className="rb-inquiry-done">✓ 문의를 보냈습니다.</p>
          ) : (
            <Button appearance="primary" size="small" disabled={disabled} onClick={() => { setError(null); setDlgOpen(true) }}>
              담당 예보관에게 보내기
            </Button>
          )}
          {disabled && <p className="rb-inquiry-hint">경로/브리핑을 먼저 만들어 주세요.</p>}
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={(_, d) => setDlgOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>담당 예보관에게 보내기</DialogTitle>
            <DialogContent>
              <div className="rb-inquiry-form">
                {!user && <p className="rb-inquiry-err">로그인이 필요합니다. 먼저 로그인해 주세요.</p>}
                <label className="rb-inquiry-field">
                  <span>공항 선택</span>
                  <Dropdown value={targetLabel} selectedOptions={[target]} onOptionSelect={(_, d) => setTarget(d.optionValue)}>
                    {FORECASTER_CONTACTS.map((c) => <Option key={c.icao} value={c.icao}>{c.ko}({c.icao})</Option>)}
                  </Dropdown>
                </label>
                <label className="rb-inquiry-field">
                  <span>메시지 (선택)</span>
                  <textarea className="rb-inquiry-msg" rows={3} maxLength={500} value={message}
                    onChange={(e) => setMessage(e.target.value)} placeholder="예: 이 경로 저시정 영향 확인 부탁드립니다." />
                </label>
                {error && <p className="rb-inquiry-err">{error}</p>}
                <div className="rb-inquiry-actions">
                  <Button appearance="secondary" onClick={() => setDlgOpen(false)}>취소</Button>
                  <Button appearance="primary" disabled={!user || sending} onClick={send}>{sending ? '보내는 중…' : '이 브리핑 보내기'}</Button>
                </div>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
