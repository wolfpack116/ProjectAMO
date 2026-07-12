# 제안서 — 통합 검색 + 공유 레이어 액션 레지스트리

> 상태: **제안(Proposal-First)** · 작성 2026-06-30 · 미구현
> 근거: 메인페이지 UX 감사(2026-06-30). 증거: `artifacts/responsive-screenshots/main-page-audit/2026-06-30_main/`

## 1. 현황
- 확장 사이드바에 비기능 검색창이 있었고, 감사 후 **임시 숨김**([Sidebar.jsx](../../../frontend/src/app/layout/Sidebar.jsx) 주석). 본 제안 승인 시 부활.

## 2. 사용자 니즈 (헌법 §6)
- "지금 어떤 공항인가?" → 공항을 ICAO/한글명으로 즉시 찾아 상태 열기.
- "레이더 켜고 싶은데 어디 있더라?" → **기능 이름으로 검색 → 해당 패널 열고 레이어 ON** (H6 Recognition over Recall).

## 3. 결과 타입 — 2종 (fix 제외 확정)

| 타입 | 예 | 동작 |
|------|-----|------|
| `airport` | RKSI / 인천 | 공항 패널 열기 + 지도 이동 |
| `action` | 레이더, 단색, 브리핑 | 패널 열기(+레이어 ON) 또는 베이스맵 전환 |

- **입력:** 확장 사이드바 검색창 부활. placeholder = `공항·기능 검색`.
- **열기 단축키:** **Cmd/Ctrl+K**.
- **결과 UI:** 타입 라벨/아이콘 + 부분일치(substring), 키보드 ↑↓/Enter/Esc.

---

## 4. 공유 레이어 액션 레지스트리 (핵심 아키텍처)

검색은 레이어 토글의 **첫 번째 소비자일 뿐**이다. 동일한 "레이어 X를 정식 이름으로 켜고/끈다" 원시동작을 브리핑·경로입력 화면도 쓸 것이므로(§6), 카탈로그는 검색 UI에 종속되지 않는 **화면 무관 공유 레지스트리**로 만든다.

```js
// layerActions.js — 단일 출처, 화면 무관.
// 소비자: 검색(지금) → 브리핑 컨텍스트 토글 / 경로입력 토글(나중, §6)
export const LAYER_ACTIONS = derive(MET_LAYER_DEFS, AVIATION_WFS_LAYERS) // {id, label, panelId, aliases}
export function toggleLayer(id, on) { /* 패널이 쓰는 그 setter 그대로 재사용 */ }
export function switchBasemap(id) { /* 베이스맵 스위처가 쓰는 그 setter 그대로 */ }
```

### 구현 제약 (드리프트 차단 — 못박음)
1. **단일 출처:** `label`/`id`는 레이어 정의(`weatherOverlayLayers.js`·`aviationWfsLayers.js`)에서 **import**. 절대 복제하지 않는다. → 레이어 이름을 바꿔도 검색/모든 소비자가 자동 동기화("이름 바꿨더니 검색 안 됨"이 구조적으로 불가능).
2. **setter 재사용:** `run()`/`toggleLayer()`는 패널·베이스맵이 이미 쓰는 동일 상태 setter를 호출. 검색 전용 상태 경로를 새로 만들지 않는다(상태 갈라짐 방지).
3. **커버리지 테스트(CI 강제):** 토글 가능한 모든 레이어 id가 레지스트리에 있는지 검사. 새 레이어 추가/ id 변경 시 등록을 깜빡하면 **빌드가 깨져 알려준다.**
   ```js
   test('every toggleable layer is registered', () => {
     for (const def of [...MET_LAYER_DEFS, ...AVIATION_WFS_LAYERS])
       expect(LAYER_ACTIONS.has(def.id)).toBe(true)
   })
   ```
4. **발견성 주석:** 레이어 정의 파일 머리에 1줄 — `// 이 레이어들은 layerActions.js 레지스트리에 연동됨. id 추가/삭제 시 커버리지 테스트가 동기화를 강제.`

### 카탈로그 (확정 — 전부 포함)

> 아래 `aliases`만 레지스트리 고유 메타데이터(한/영/구어). `label`은 정의에서 import되므로 표의 label은 참고용.

#### A. 패널/창 열기 (폴백 — 정확한 레이어가 기억 안 날 때)
| label | aliases | 동작 |
|-------|---------|------|
| 항공정보 패널 | 항공, aviation | openPanel('aviation') |
| 기상정보 패널 | 기상, 날씨, met | openPanel('met') |
| 비행 전 브리핑 | 브리핑, route | openPanel('route-check') |
| 상황판 | 모니터링, monitoring | navigate('/monitoring') |
| 설정 | settings | openPanel('settings') |

#### B. 기상 레이어 — openPanel('met') + toggleLayer(id, true)
| id | label | aliases |
|----|-------|---------|
| radar | 레이더 | radar, 강수, 에코 |
| satellite | **위성영상** | 위성영상, satellite, 적외, IR |
| lightning | 낙뢰 | 번개, lightning |
| wind | 바람 | wind, 풍속 |
| temp | 기온 | 온도, temp |
| cloud | 습기 | 수분, moisture, 구름 |
| icing | 착빙 | icing |
| turbulence | 난류 | turbulence |
| sigmet | SIGMET | 시그멧 |
| airmet | AIRMET | 에어멧 |
| sigwx | SIGWX | 시그윅스, 악기상 |
| adsb | ADS-B | 항공기, 실시간항공기, adsb |
| flightCategory | 비행기상구역 | 비행구역, 카테고리 |

#### C. 항공 레이어 — openPanel('aviation') + toggleLayer(id, true)
| id | label | aliases |
|----|-------|---------|
| fir | 비행정보구역(FIR) | fir |
| sector | 섹터 | sector |
| waypoint | 웨이포인트 | 픽스, fix, waypoint |
| navaid | 항행안전시설 | navaid, vor |
| airport | 공항 | airport |
| ctr | 관제권(CTR) | ctr |
| tma | 접근관제구역(TMA) | tma |
| restricted | 제한구역 | restricted |
| prohibited | 금지구역 | prohibited |
| danger | 위험구역 | danger |
| ats-route | ATS 항로 | ats, 항로 |
| rnav-route | RNAV 항로 | rnav |

#### D. 베이스맵 변경 — switchBasemap(id)
| id | label | aliases |
|----|-------|---------|
| standard | 기본 | standard |
| dark | 단색 | 회색, monochrome |
| satellite | **위성 지도** | 위성지도, 위성배경 |

## 5. ⚠️ "위성" 동음 충돌
"위성"이 **위성영상(기상 레이어, B)** 과 **위성 지도(베이스맵, D)** 둘을 가리킴. 결과 라벨로 구분: `위성영상 (기상)` vs `위성 지도 (베이스맵)`. "위성" 입력 시 둘 다 노출하고 타입 아이콘으로 구별.

---

## 6. 미래 소비자 (계획만 — 이번 구현 비범위)

레지스트리는 아래 소비자들이 **같은 `toggleLayer(id)` 를 재사용**하도록 받아주는 모양으로만 둔다. UI·로직은 각 기능 차례에 구현.

- **브리핑 컨텍스트 토글** — 비행경로상 위험기상(예: 뇌우 SIGMET)이 있을 때만 브리핑 창에 "관련 레이어 보기" 버튼 노출 → 누르면 해당 레이어(레이더/낙뢰/SIGMET) ON.
  - **자동켜기 아님, 버튼.** 브리핑 여는 순간 레이어가 멋대로 켜지면 놀람·예측불가 → 사용자가 누르는 버튼으로 통제권 유지(헌법 §5 "상태 먼저, 컨트롤 나중"). 자동켜기는 후속 옵션으로만.
  - **위험현상 → 레이어 매핑(뇌우 = radar+lightning+sigmet 등)은 브리핑 기능 소유의 별도 맵.** 코어 레지스트리에 넣지 않는다(레지스트리는 안정적 layer id만 제공). 섞으면 그게 과설계.
- **경로입력 토글** — 경로 입력 창에서 웨이포인트/항로(ats-route·rnav-route) 레이어를 켜고 끄는 버튼. 동일 `toggleLayer(id)` 호출.

## 7. 단계
- **MVP(이번):** 통합 검색(airport + action 전체 A/B/C/D) + Cmd/Ctrl+K + 공유 레지스트리(§4) + 커버리지 테스트.
- **비범위:** 브리핑/경로 토글 UI, 위험현상→레이어 매핑, 자동켜기, 퍼지매칭, 최근/즐겨찾기, fix 좌표 검색.

## 8. 기대 효과
- 보이는 컨트롤이 실제로 작동 → 신뢰 회복.
- 기능 도달이 "패널 구조 회상" → "이름 검색"으로 전환, 판독·조작 시간 단축.
- **공유 레지스트리**로 검색·브리핑·경로입력이 이름/setter를 단 한 번만 정의 → 중복·드리프트 0, 후속 기능 구현 비용 급감.
- 기존 패널/레이어/베이스맵 setter 재사용으로 백엔드 변경 0, 신규 상태 0.
