// #13 경로 예보변화 diff 엔진 — 순수 함수. 스케줄러가 채운 최소 스냅샷 둘을 비교해 candidate alert만 낸다.
// 임계값 근거: reference §3(내 미니마 선 크로싱)·§3.0(v1 7종). composer/DB 비의존 → 손쉬운 유닛 테스트.
// dwell 2h·rate-limit·그룹핑은 상태·시간이 필요 → 스케줄러(상태 계층) 담당. 여기선 prev→curr 전이만 본다.
//
// 스냅샷 계약(스케줄러 buildSnapshot이 생산):
//   dep:  { icao, ceilingFt, visibilityM, ts } | null      // 출발, ETD 시각
//   dest: { icao, ceilingFt, visibilityM, alternateRequired } | null  // 목적지, ETA 시각
//   altn: { icao, ceilingFt, visibilityM } | null
//   hazards: [{ key, isSigmet, convective, label }]         // 경로∩시간∩고도(고도필터 통과분만)
//   enroute: { icing, turb }                                // '약'|'중'|'심'|null (enroute-model 등급)

const VFR_PRESET = { ceilingFt: 1000, visibilityM: 5000 } // 미설정 기본(§3.2, 가장 보수적)
const IFR_PRESET = { ceilingFt: 500, visibilityM: 1600 }  // 접근최저치 근처 = CRITICAL 경계
const RANK = { 약: 1, 중: 2, 심: 3 }

// 실효 미니마: 사용자값 우선, 미설정 시 VFR 프리셋. #8 공항 published max는 미구현 → 사용자값만(reference §5).
export function effectiveMinima(userMinima) {
  return {
    ceilingFt: Number.isFinite(userMinima?.ceilingFt) ? userMinima.ceilingFt : VFR_PRESET.ceilingFt,
    visibilityM: Number.isFinite(userMinima?.visibilityM) ? userMinima.visibilityM : VFR_PRESET.visibilityM,
  }
}

const below = (v, line) => Number.isFinite(v) && v < line

// 선 크로싱: curr가 선 아래 & prev는 아니었다(신규 하락)만 발화. 회복·지속은 무발화(스팸 억제).
function minimaCrossings(prevA, currA, minima, target) {
  if (!currA) return []
  const out = []
  if (below(currA.ceilingFt, minima.ceilingFt) && !below(prevA?.ceilingFt, minima.ceilingFt)) {
    out.push({
      type: 'CEIL', target, severity: below(currA.ceilingFt, IFR_PRESET.ceilingFt) ? 'CRITICAL' : 'HIGH',
      from: prevA?.ceilingFt ?? null, to: currA.ceilingFt, dedupKey: `CEIL:${target}`,
    })
  }
  if (below(currA.visibilityM, minima.visibilityM) && !below(prevA?.visibilityM, minima.visibilityM)) {
    out.push({
      type: 'VIS', target, severity: below(currA.visibilityM, IFR_PRESET.visibilityM) ? 'CRITICAL' : 'HIGH',
      from: prevA?.visibilityM ?? null, to: currA.visibilityM, dedupKey: `VIS:${target}`,
    })
  }
  return out
}

// prev·curr = 같은 계획·같은 대상시각의 두 스냅샷. plan.minima = { ceilingFt, visibilityM } | null.
export function detectChanges(prev, curr, plan) {
  const minima = effectiveMinima(plan?.minima)
  const changes = []

  // 1·6 목적지+출발+교체 운고/시정 미니마 크로싱(ETA/ETD 시각은 스냅샷에 이미 반영).
  changes.push(...minimaCrossings(prev?.dest, curr?.dest, minima, curr?.dest?.icao ?? 'DEST'))
  changes.push(...minimaCrossings(prev?.dep, curr?.dep, minima, curr?.dep?.icao ?? 'DEP'))
  changes.push(...minimaCrossings(prev?.altn, curr?.altn, minima, curr?.altn?.icao ?? 'ALTN'))

  // 2 교체공항 새로 "필요" 플립(1-2-3).
  if (curr?.dest?.alternateRequired === true && prev?.dest?.alternateRequired !== true) {
    const t = curr.dest.icao ?? 'DEST'
    changes.push({ type: 'ALTERNATE_FLIP', target: t, severity: 'HIGH', from: 'not-required', to: 'required', dedupKey: `ALTERNATE_FLIP:${t}` })
  }

  // 3 신규 경로 위험(SIGMET/AIRMET) — prev에 없던 key만. SIGMET=HIGH, AIRMET=MEDIUM.
  const prevKeys = new Set((prev?.hazards ?? []).map((h) => h.key))
  for (const h of (curr?.hazards ?? [])) {
    if (prevKeys.has(h.key)) continue
    changes.push({ type: 'ENROUTE_HAZARD', target: h.label ?? h.key, severity: h.isSigmet ? 'HIGH' : 'MEDIUM', from: null, to: h.label ?? h.key, sourceId: h.key, dedupKey: `ENROUTE_HAZARD:${h.key}` })
  }

  // 4·5 엔루트 착빙/난류 severe(심)로 상승.
  for (const kind of ['icing', 'turb']) {
    const before = RANK[prev?.enroute?.[kind]] ?? 0
    const after = RANK[curr?.enroute?.[kind]] ?? 0
    if (after >= RANK['심'] && after > before) {
      changes.push({ type: 'ENROUTE_ICE_TURB', target: kind, severity: 'HIGH', from: prev?.enroute?.[kind] ?? null, to: curr.enroute[kind], dedupKey: `ENROUTE_ICE_TURB:${kind}` })
    }
  }

  // 7 출발공항 TS 신규.
  if (curr?.dep?.ts === true && prev?.dep?.ts !== true) {
    const t = curr.dep.icao ?? 'DEP'
    changes.push({ type: 'WX', target: t, severity: 'HIGH', from: null, to: 'TS', dedupKey: `WX:TS:${t}` })
  }

  return changes
}

export default { detectChanges, effectiveMinima }
