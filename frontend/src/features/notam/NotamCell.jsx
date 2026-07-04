import { Ban, Crosshair, AlertTriangle, ShieldHalf, RadioTower, Radio, MoreHorizontal, ChevronDown } from 'lucide-react'
import { TIME_STATE } from './lib/notamViewModel.js'
import './NotamCell.css'

// 밀도형 NOTAM 셀 — 공항탭·브리핑 공용(동일 룩). 2줄: ① ●점 + 아이콘 + 요약 + 고도 + 펼침, ② 카테고리·번호.
// 펼치면(네이티브 details, 키보드 접근) 유효기간 + 원문. 시간상태 색=●◐○(색맹 대비 형태).
const CAT_ICON = {
  prohibited: Ban, firing: Crosshair, danger: AlertTriangle, restricted: ShieldHalf,
  obstacle: RadioTower, facility: Radio, other: MoreHorizontal,
}

export default function NotamCell({ category, timeState, summary, metaText, altitude, rawText, validText, conflict = false }) {
  const t = TIME_STATE[timeState] || TIME_STATE.upcoming
  const Icon = CAT_ICON[category] || MoreHorizontal
  const isBand = altitude && altitude !== '전고도' // 실제 밴드만 진하게, "전고도"는 흐리게
  return (
    <details className="notam-cell" data-conflict={conflict ? 'true' : undefined}>
      <summary className="notam-cell-summary">
        <span className={`notam-cell-dot ts-${t.key}`} aria-hidden="true">{t.glyph}</span>
        <Icon size={15} strokeWidth={2} className="notam-cell-ic" aria-hidden="true" />
        <span className="notam-cell-body">
          <span className="notam-cell-title">{conflict ? <b className="notam-cell-conf">저촉 · </b> : null}{summary}</span>
          <span className="notam-cell-meta">{metaText}</span>
        </span>
        <span className={`notam-cell-alt${isBand ? ' is-band' : ''}`}>{altitude || '—'}</span>
        <ChevronDown size={14} className="notam-cell-chev" aria-hidden="true" />
      </summary>
      <div className="notam-cell-expand">
        {validText ? <div className="notam-cell-valid"><span className="notam-cell-valid-lbl">유효</span>{validText}</div> : null}
        {rawText ? <pre className="notam-cell-raw">{rawText}</pre> : null}
      </div>
    </details>
  )
}
