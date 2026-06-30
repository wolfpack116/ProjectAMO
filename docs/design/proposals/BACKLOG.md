# 백로그 — 미룬 작업 / 계획된 기능

> 한곳에 모은 "나중에 할 것" 목록. 구현되면 해당 줄을 지운다.
> 상세는 각 제안서 링크 참조. 새 기능을 미룰 때마다 여기 한 줄 추가.

## 검색 / 레이어 액션
- [x] **브리핑 컨텍스트 레이어 토글** — 구현됨(2026-06-30): 위험 있으면 브리핑 상단 "지도에 관련 레이어 보기" 버튼 → 지도 모드 전환 + **레이어 토글칩 펼침**(우측, 일괄 ON 아님 — 사용자가 보며 토글). 공유 `LayerToggleChips`(features/map), 기존 `toggleMet` 재사용. (레지스트리도 `features/map/layerActions.js`로 이동)
- [x] **위험현상 → 레이어 매핑(룰북)** — 구현됨: `route-briefing/lib/hazardLayers.js`의 명시적 `RULEBOOK` 테이블. v1: 착빙→icing, 난류→turbulence, 뇌우류(TS·EMBD_TS 등)→radar+lightning+sigmet, 태풍(TC)→radar+sigmet. **나머지(CB/GR·MTW·VA·LLWS·IFR 등)는 룰북에 한 줄씩 추가**. METAR/TAF/경보는 레이어 아님(브리핑 본문·바에 표시). 반환 id는 MET_LAYERS와 테스트로 동기화.
- [x] **경로입력 레이어 토글** — 구현됨(2026-06-30): VFR 경로 빌더 상단에 "지도 레이어" 토글칩 `[웨이포인트][항행안전시설][항공로]`(항공로=ats-route+rnav-route 묶음). 공유 `LayerToggleChips`(features/map) + 기존 `toggleAviation` 재사용.
- [ ] **검색: 자동 레이어 켜기 옵션** — 컨텍스트에서 버튼 대신 자동 ON(후속 옵션). · §6
- [ ] **검색: 퍼지 매칭 / 최근·즐겨찾기 / fix 좌표 검색** — MVP 비범위. · search-feature.md §7

## 메인페이지 (UX 감사 2026-06-30 잔여)
- [x] **상시 위험 요약 칩** — "띠" 대신 축소형으로 구현: SIGMET/AIRMET 뱃지를 레이어 토글과 무관하게 활성 시 상시 표시(게이팅 제거) + 공항경보 칩 추가, 클릭 시 레이어 ON + 리스트. 칩·리스트 헌법 맞춤 재디자인. (카테고리 분포·"다음 변화"는 과해서 제외) · [status-summary-strip.md](status-summary-strip.md)
- [x] **첫 로드 업데이트 모달 처리 결정** — 테스트 기간 의도된 동작으로 **그대로 유지** 결정(2026-06-30). 새 릴리스마다 모달 자동 오픈. 정식 운영 전환 시 완화(사이드바 점만) 재검토 가능. (감사 finding #8)
