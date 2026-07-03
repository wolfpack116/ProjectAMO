import { AlertTriangle, Check } from 'lucide-react'
import { NOTAM_CATEGORIES } from '../notam/lib/notamViewModel.js'

// Go/No-go 배너: 최악 카테고리(3레벨) + 공항 + 이유(운고/시정) + 역할별 범주 체인.
// §2.2 정상=차분(무채/연녹), 위험(IFR/LIFR)만 솔리드 채색.
const CAT_COLOR = { VFR: 'var(--cat-vfr)', IFR: 'var(--cat-ifr)', LIFR: 'var(--cat-lifr)' }
const ROLE_LABEL = { departure: '출발', arrival: '도착', alternate: '교체' }
const DRIVER_LABEL = { ceiling: '운고', visibility: '시정', both: '운고·시정' }
const NOTAM_CAT_LABEL = Object.fromEntries(NOTAM_CATEGORIES.map((c) => [c.id, c.label]))

export default function BriefingBanner({ banner, routeConflicts = [] }) {
  const worst = banner?.worst
  const hasConflict = routeConflicts.length > 0
  if (!worst && !hasConflict) return null
  const good = worst?.category === 'VFR'
  const catColor = CAT_COLOR[worst?.category] || 'var(--text-3)'

  const reason = good
    ? '전 구간 시정·운고 여유'
    : worst ? `${ROLE_LABEL[worst.role]}공항 ${DRIVER_LABEL[worst.driver] || '기상'} 기준 ${worst.category}` : ''

  return (
    <>
      {worst && (
        <div className="bv-banner" data-bvid="banner" data-good={good ? 'true' : 'false'} style={{ borderColor: catColor }}>
          <div className="bv-banner-cat" style={good ? undefined : { background: catColor }}>
            <span className="bv-banner-cat-role">{good ? '전 구간' : `${ROLE_LABEL[worst.role]}공항 ${worst.icao}`}</span>
            <span className="bv-banner-cat-val">{worst.category}</span>
          </div>
          <div className="bv-banner-body">
            <div className="bv-banner-reason" style={{ color: catColor }}>
              {good ? <Check size={16} /> : <AlertTriangle size={16} />} {reason}
            </div>
            <div className="bv-banner-chain">
              {banner.airports.map((a) => (
                <span key={a.role} className="bv-banner-chain-item">
                  <span className="bv-banner-chain-role">{ROLE_LABEL[a.role]}</span>
                  <b>{a.icao}</b>
                  <b style={{ color: CAT_COLOR[a.category] || 'var(--text-3)' }}>{a.category}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {hasConflict && (
        // 사실 고지 — 명령 아님. 최종 go/no-go는 파일럿.
        <div className="bv-banner bv-banner-notam" data-good="false" style={{ borderColor: 'var(--level-red)' }}>
          <div className="bv-banner-cat" style={{ background: 'var(--level-red)' }}>
            <span className="bv-banner-cat-role">경로 저촉</span>
            <span className="bv-banner-cat-val">{routeConflicts.length}</span>
          </div>
          <div className="bv-banner-body">
            <div className="bv-banner-reason" style={{ color: 'var(--level-red)' }}>
              <AlertTriangle size={16} /> 발효 중 공역 제한이 경로에 걸립니다 — 확인 필요
            </div>
            <div className="bv-banner-chain">
              {routeConflicts.map((n) => (
                <span key={n.id} className="bv-banner-chain-item">
                  <span className="bv-banner-chain-role">{NOTAM_CAT_LABEL[n.category] || n.category}</span>
                  <b>{n.id}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
