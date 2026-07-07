# 경로 예보변화 알림(#13) — 구현 참조

> 상태: **구현 참조(reference)** — [운영 기능 확장 초안](2026-07-04-operational-features-draft.md) #13의 근거 문서. 스펙 작성 시 여기 수치·규칙을 그대로 가져다 쓴다.
> 근거: 2026-07-04 병렬 심층조사 4건(Leidos ACAS / ForeFlight·Garmin / SkyDemon·autorouter·Maverick Dispatch / ICAO Annex 3·NWS 임계값 표준).
> 대상 기능: 사용자가 **비행예정일+경로**를 저장 → 그날 전까지 경로·시각 예보가 **의미있게 변하면 푸시**. (모니터링 페이지의 공항 실시간 임계값 경보와 별개.)
> ⚠️ 환각 경계: 아래 "DOCUMENTED"는 출처 확인분, "추정"은 표시함. 벤더 내부(회랑 폭 등)는 공개 안 됨 → 우리 기본값으로 대체.
>
> **📌 2026-07-07 현재상태 반영(개정):** 이 문서는 2026-07-04 작성 후 로그인(#7)·해외 취항지·NOAA 연동이 배포되며 전제가 바뀌었다. 코드 대조로 갱신함.
> - **하드 전제 3종이 이미 구현됨** → 남은 신규는 §8·§9 참조(재브리핑 스케줄러 + diff 엔진 + Web Push + 알림 테이블).
>   - 로그인·역할(pilot/forecaster/admin) 배포됨(0.2.3).
>   - **서버측 계획 저장 = `routes` 테이블 이미 존재**(스키마 주석에 `etd -- #13 감시`). CRUD 완비([me/routes.js](../../../backend/src/me/routes.js)).
>   - **개인 미니마 = `presets` 테이블로 서버 미러링됨**([SettingsModal.jsx](../../../frontend/src/features/settings/SettingsModal.jsx) localStorage+서버 이중 저장) → 서버측 알림 평가 가능.
> - **감시 소스가 국내(KMA)+해외(NOAA) 2축으로 갈림** → §5B·§6 참조. 브리핑 조립은 국내+해외 병합이 이미 됨([briefing-composer.js](../../../backend/src/briefing/briefing-composer.js)); 해외 SIGMET은 `asia_firs` 필터에 한정.
> - 설계 두뇌(§3 트리거·§4 diff·§5 알림피로·§5B·§5C)는 제품 결정이라 **그대로 유효**.

---

## 1. 선례 한눈에 (핵심 파라미터 비교)

| 항목 | Leidos ACAS 🎯 | ForeFlight | Garmin Pilot | SkyDemon | Maverick Dispatch |
|---|---|---|---|---|---|
| 트리거 | 브리핑+비행계획 파일링 | 앱에서 파일링 | 활성 비행계획 | 경로 편집 | 다편 보드 |
| 감시 시작 | ETD−(0~360분, 기본120) | ETD−2h | 비행계획 생성 시 | 계획 시점 | T−24h |
| 감시 종료 | 프리플라이트=ETD / 인플라이트=CTA+2h | 착륙(추정) | — | 인플라이트까지 | 착륙+30분 |
| 고도필터 | **계획고도+4000ft 초과분 제외** | 미문서 | FPL고도 위 억제(500~5000ft 증분) | — | — |
| 경로 범위 | 파일된 경로(ATC경로 아님), 회랑폭 비공개 | 비행계획 | FPL+ETE+3h 창 | 협로/면적 선택, 48h | 경로+터미널 회랑 |
| 전달 | 이메일·SMS·위성(160자)·위치기기 | 푸시+이메일 | 인앱 하이라이트 | 인앱+음성 | 통합 대시보드 |
| 중복제거 | 미문서(재발행마다 추정) | "유의미 변화"만 | 인앱표시라 무관 | 실시간갱신 | **핵심: 통합+임계+랭킹** |
| "이상없음" 확인알림 | **ETD−60분** 옵션 | — | — | — | — |
| 비용 | 무료 | 구독 | 구독 | 구독 | 상용 |

**결론:** **ACAS가 우리 기능과 거의 동일**하고 파라미터가 가장 잘 문서화됨 → 라이프사이클·고도필터·확인알림은 ACAS를 뼈대로. **"의미있는 변화" 판정은 상용 앱 실용 기준(§3: "내 미니마 선" 크로싱 — 카테고리는 선을 고르는 프리셋일 뿐, ICAO/SPECI 단계 기준 아님)**, 알림피로 방지는 Maverick(§5)을 가져온다.

---

## 2. Leidos ACAS — 그대로 차용할 파라미터 (가장 근접 선례)

전부 DOCUMENTED (출처: 1800wxbrief FAQ, Lockheed 2012 발표, AOPA). 회랑폭·중복제거만 비공개.

| 파라미터 | 값 | 우리 적용 |
|---|---|---|
| **감시 시작** | ETD − N분, N ∈ [0, 360], 기본 **120** | **⚙️ 확정(2026-07-07): ETD − 2h 기본(ACAS·ForeFlight 조종사 관례), 조종사가 2~6h 선택.** 저장은 아무 때나(며칠 전 OK), 푸시는 감시창 진입 후. 6h를 고르면 KIM 착빙·KTG 엔루트 모델런을 한 개 더 잡음 |
| **감시 종료(프리플라이트)** | ETD 도달 시 중단 | **확정: ETD에서 종료.** 각 트리거는 데이터 지평(TAF 24~30h / SIGMET 4~6h)이 비행시각에 닿을 때 자동 발화 |
| **감시 종료(인플라이트)** | **CTA + 2h** 이후 시작되는 조건은 제외 | 인플라이트는 v2, v1은 ETD에서 종료 |
| **고도 필터** | 조건 고도 > **계획고도 + 4000ft** 이면 알림 억제(옵트인 체크박스) | **그대로 차용.** 우리는 `planned-altitude.js`·3D 매칭(`hazard-matcher.js`) 이미 있음 |
| **"이상없음" 확인알림** | ETD − **60분**에 "새 악조건 없음" 1회 통지(옵션) | 그대로 차용 — "지금까지 특이변화 없음, 예정대로 OK" 푸시 |
| **활성화 조건** | 브리핑 확인 + 비행계획 파일링 **둘 다** 후 시작 | 우리는 "경로 저장 + 알림 ON"으로 대체 |
| **경로 기준** | 파일된 경로(ATC 배정경로 아님) | 사용자가 입력/저장한 경로 |
| **에스컬레이션 UX** | 앱에서 해결 안 함 → "Flight Service에 전화해 약식 브리핑 받으라" | **핵심 차용**: 앱은 변화를 *알리고 브리핑으로 안내*만, 판단 대체 안 함 → 공식 KMA/브리핑 재확인 유도 |
| 감시 상품(기본) | TFR, SIGMET, ConvSIGMET, AIRMET, CWA, urgent PIREP, NOTAM, 공항/활주로폐쇄, UAS | 우리 보유분으로 매핑(§6) |

**회랑 폭(비공개) → 우리 기본값:** 업계 표준 참고로 **경로 중심 ±5NM**(정밀 아님) 또는 ForeFlight 계획 기본 8NM. 저고도 회전익은 더 좁게. (초안 #13 "±10~20nm"보다 좁혀도 됨 — 시작은 ±5NM 권장, 조정 가능.)

---

## 3. "의미있는 변화" 판정 — 실용 임계값 (상용 앱 기준, ICAO 아님) ★핵심

> ⚠️ **ICAO/SPECI 개정 기준은 알림에 쓰지 않는다.** 그건 예보관이 SPECI 발행·TAF 개정할 때 쓰는 기준(운고 500ft·시정 1SM·풍향 45° 단계마다)이라 너무 민감 → 악기상 시 시간당 수십 건 → 사용자가 알림을 꺼버린다. 상용 앱 조사 결과(ForeFlight·1800wxbrief·Minimums·EZWxBrief·Windy) **전부 (1) 비행 카테고리 변화 + (2) 사용자 개인 미니마**를 알림 단위로 씀. 우리도 그대로. 출처: ForeFlight blog(Flight Rules/Category), Minimums App, EZWxBrief, FAA/AOPA Personal Minimums, neuaviation MVFR 해설.

### 3.0 확정 v1 알림 목록 (2026-07-07) ★★
> 조종사 관점 스코핑 결과 — "내 go/no-go·연료·교체·출발시각을 바꾸는 변화"만. 현상별 알림을 늘리지 않고 **2메커니즘 + 교체플립**으로 수렴(안개·TS발 시정저하는 ①로 흡수).

| # | 알림 | 메커니즘 | 대상 | 판정 모듈 |
|---|---|---|---|---|
| 1 | **목적지 운고/시정** 미니마 아래(ETA 기준) | ① 선 크로싱 | 목적지(+교체) | `flight-category.js` + `presets` |
| 2 | **교체공항 새로 필요** 플립(1-2-3) | ③ 플립 | 목적지 | `taf-window.js` `alternateRequired()` |
| 3 | 경로·고도·시간 **신규 Convective SIGMET** | ② 이벤트 | 엔루트 | `hazard-section.js`(+고도필터) |
| 4 | 경로·고도·시간 **severe 착빙** | ② 이벤트 | 엔루트 | `hazard-section.js`/`enroute-model.js` |
| 5 | 경로·고도·시간 **severe 난류** | ② 이벤트 | 엔루트 | `hazard-section.js`/`enroute-model.js` |
| 6 | **출발공항 저시정(LVP)** — ETD 시각 | ① 선 크로싱 | 출발 | `flight-category.js` |
| 7 | **출발공항 TS** — ETD 시각 | ② 이벤트 | 출발 | METAR/TAF 현상 |

**의도적 제외(피로 방지, v1 아님):** 카테고리 변화 없는 routine 재발행 · AIRMET 레벨(착빙/산악불명료 외) · SIGMET 재발행 dedup · 경로 밖·고도밴드 밖. **바람·측풍·돌풍 미니마는 v2**(아래 §3.1의 바람 항목은 참고, v1 미포함).

**개인 미니마 스코프(확정):** v1 = **운고·시정, 사용자당 단일값**(공항별 아님 — IFR 자격·기체 제한치는 공항 따라 안 변함) + VFR/IFR 프리셋. **실효 미니마 = max(내 미니마, 그 공항 published 미니마[#8])** — 목적지 제한치가 더 높으면 높은 쪽 적용. 측풍·돌풍·pilot_type = **v2**. "SIGMET을 얼마나 심하면 알림"은 개인화 안 함 → **전역 규칙**(convective/severe=푸시, moderate=인앱). ⚠️ 배포된 `presets` 테이블은 공항별(`UNIQUE user_id,icao`)이라 단일값엔 과함 → §11 데이터 모델 참조. 상세 UX·모델은 **§11**.

### 3.1 유일 핵심 트리거 — "내 미니마 선"을 예보가 넘을 때 ★핵심
- 알림의 본질 = **예보가 "내가 못 가는 선"을 넘을 때.** 그 선은 조종사 유형·기량에 따라 다르므로 **사용자가 설정**한다. 우리는 이미 `SettingsModal`에 공항별 `ceilingFt`·`visibilityM`을 저장(`airport_minima_settings`) → 그대로 사용(#8과 동일). **(2026-07 갱신: 로그인 후 서버 `presets` 테이블로도 미러링됨 → 서버측 재브리핑에서 사용자 미니마를 읽어 판정 가능. 앱 꺼짐 상태 감시의 필수 조건이 충족됨.)**
- **카테고리(VFR/MVFR/IFR/LIFR)는 별도의 상시 알람이 아니라, 이 선을 쉽게 고르게 해주는 "프리셋 어휘"**일 뿐이다. (그래서 "VFR→IFR 알람", "IFR→LIFR 알람"은 각각 아래 프리셋의 *결과*.)
- **유형별 프리셋(선 자동 채움, 이후 사용자 조정 가능):**
  - **VFR 조종사** → 예보가 **IFR로 진입**할 때(운고 <1000ft 또는 시정 <3SM≈5000m). VFR은 IFR 되면 못 감.
  - **IFR 조종사** → 예보가 **LIFR/접근최저치 근처**로 갈 때(운고 <500ft 또는 시정 <1SM≈1600m). #8 접근최저치와 연계 가능.
  - **회전익/기타** → 저고도 국지 기준 등 사용자 직접.
- **악화 방향만** 알림(호전은 옵션). 미니마에서 얼마나 아래냐로 severity(선 근처=HIGH, 접근최저치 근처=CRITICAL).
- 바람도 같은 방식(사용자 값). 기본값: 지속풍 15kt, 측풍성분 10kt, 돌풍 스프레드 10kt. 측풍성분은 AMOS(정풍/측풍, `amosViewModel`) 재사용.
- 효과: 사람마다 **자기 선 하나**로만 울림 → 한 비행에 **0~2건**으로 수렴(ICAO 단계 크로싱이면 수십 건).

### 3.2 설정이 없을 때 — 기본 프리셋
- 사용자가 미니마를 안 정했으면 **VFR 프리셋(IFR 진입 시 알림)**을 기본 적용(가장 보수적). 로그인·유형 선택 시 프리셋 자동 채움.

### 3.3 3차 트리거 — 이벤트성 (임계값 아님, 발효/신규 자체가 트리거)
- 경로상 **신규 SIGMET/AIRMET**(착빙·산악불명료 우선)·**TFR상응·활주로폐쇄 NOTAM** 발효. `hazard-section.js` 3D 매칭 + 고도필터(§2). §3.4 dedup.
- 엔루트 **착빙·난류 moderate+ 상승**(`enroute-model.js`).

### 3.4 SIGMET/AIRMET 중복제거 키 (이벤트 dedup용)
- 유효: SIGMET 4h(열대저기압·화산재 6h), ConvSIGMET 2h, AIRMET 6h. 시퀀스 0001UTC 리셋.
- **같은 FIR + 같은 현상 + 유효기간 겹침** → 동일 갱신으로 보고 면적·강도·고도 안 바뀌면 **알림 안 함**. 면적/강도/고도 변경 = 알림. 새 유효기간/새 현상 = 신규.

### 3.5 플래핑 방지 (선 근처 진동)
- **미니마 선 크로싱**: 예보가 선 아래로 내려간 상태가 **≥2h 지속**해야 알림(경계에서 흔들려도 억제). 회복은 선+여유(운고 +200ft 등) & **1h 유지** 후에만.
- **바람**: 값 초과 상태 지속 시 알림, 회복은 초과 해소 & 1h.

### 3.6 (참고) ICAO/SPECI 상세 기준
예보관·QA 용도로만 별도 필요하면 `flight-category.js` 확장 시 참조 — **알림 경로엔 넣지 않는다.**

---

## 4. diff 엔진 규칙 (의사코드, 우리 데이터 매핑)

우리 판정 함수는 **이미 있는 것 재사용**: 카테고리=`flight-category.js`, 교체 1-2-3=`taf-window.js`, 경로∩시간∩고도 위험=`hazard-section.js`/`geo-time-match.js`, 엔루트 착빙·난류=`enroute-model.js`.

```
// prev = 직전 스냅샷, curr = 재브리핑 결과 (같은 계획·같은 대상시각 기준)
function detectChanges(prev, curr, plan):
  alerts = []
  for airport in [plan.dep, plan.dest, plan.altn]:
    // 핵심 트리거: "내 미니마 선" 크로싱 — 카테고리는 이 선을 고르는 프리셋일 뿐
    line = plan.minima[airport] || presetFor(plan.pilotType)  // {ceilingFt, visibilityM, windKt, xwindKt, gustSpreadKt}
    if crossedBelow(curr,airport,line) and heldFor(curr, 2h):   // 악화 방향, 회복은 +여유 & 1h (§3.5)
      sev = nearApproachMinima(curr,line) ? CRITICAL : HIGH
      alerts += {airport, type:'MINIMA', param:whichCrossed(curr,line), sev}
  // 교체 필요 플립 (1-2-3) — taf-window.js 재사용
  if alternateRequired(prev.dest) != alternateRequired(curr.dest):
    alerts += {type:'ALTERNATE_FLIP', sev:HIGH}
  // 3차(이벤트): 경로상 신규 SIGMET/AIRMET — hazard-section.js(route∩time∩alt) + 고도필터 + §3.4 dedup
  for h in curr.enrouteHazards:
    if not seenBefore(h.dedupKey) and passesAltitudeFilter(h, plan.altitude+4000):
      alerts += {type:'ENROUTE_HAZARD', hazard:h, sev: h.isSigmet?HIGH:MEDIUM}
  // 엔루트 착빙/난류 moderate+ 상승 — enroute-model.js 재사용
  if enrouteSeverityRose(prev,curr): alerts += {type:'ENROUTE_ICE_TURB', sev:HIGH}
  return dedupAndRateLimit(alerts)   // §5 플레이북
```

**고도필터**(ACAS 차용): `passesAltitudeFilter(cond, plan.altitude+4000ft)`.
**dedup 키**: 항목ID+시퀀스/발표시각. 같은 키·내용무변 재발행 = 억제.

---

## 5. 알림 피로 방지 플레이북 (Maverick Dispatch 근거)

**가장 중요.** 항공 예보는 계속 재발행(SIGMET 4h, AIRMET 6h, TAF 4회/일+개정) → 재발행마다 알리면 신뢰 붕괴. Breeze Airways 사례: 통합 대시보드로 22탭 제거 → 시스템전환 15%↓.

구현 순서(쉬운 것부터):
1. **행정적 재발행 억제** — 내용 동일 재발행은 알림 안 함(NWS Categorical Amendment Criteria식: 카테고리·임계 교차가 없으면 skip). METAR 직전 대비 <5% 변화 skip.
2. **항목ID+시퀀스 중복제거** — 같은 NOTAM/SIGMET 재발행은 카운터만, 재푸시 금지(면적·강도·고도 변경 시에만).
3. **조건종류별 rate limit** — 종류당 5~15분 1회.
4. **조건종류 차등 채널** — 즉시 푸시: 신규 SIGMET/TFR/활주로폐쇄/카테고리 하락·교체플립. 인앱만: 일상 METAR/TAF 재발행, AIRMET 중 난류(착빙·산악불명료만 푸시).
5. **개인 미니마 대비 필터** — 사용자 미니마(#7·#8, 이미 localStorage `airport_minima_settings`) 밑돌 때만 승격. VFR/IFR/상업 허용치 다름.
6. **라이프사이클 게이팅** — ETD 근접할수록 저severity 억제, 지난 비행 감시 중단.

목표 지표: **출발 전 실질 알림 <5건/비행.**

---

## 5B. 감시 로직 & 서버 부하 설계 (벤치마킹 반영)

> 4개 병렬 벤치마크(모니터링 시스템 Prometheus/Datadog/Nagios·CEP/Rete·소비자 알림 Robinhood/Hopper/NWS·역방향 인덱싱 자료구조)가 **한 방향으로 수렴**: 우리 규모(단일 서버·수백 활성 비행·5~15분 갱신)엔 **인덱스 + 이벤트 구동 + dirty-flag 재계산 + 표준 알림 파라미터**면 충분. Rete·CEP엔진·Materialize·R-tree·S2/H3는 전부 **과함(over-engineering)**.

### 자료구조 (최소 세트, 전부 인메모리 · 수백 KB)
- `flightIndex`: `flightId → {route, airports, etd, minima, cache, dirty, inputHash}` — O(1)
- `airportIndex`: `ICAO → Set<flightId>` — 공항 데이터(METAR/TAF) 변경 시 후보 O(1)
- `hazardGeoIndex`: `geohash(정밀 8~10) → Set<hazardId>` — SIGMET/NOTAM broad-phase (geohash 채택; R-tree는 5000+ 비행 전엔 과함)
- `etdIndex`: 정렬된 `[etd, flightId]` — 시간창 겹침 이진탐색 O(log n + k)
- 비행별 briefing 캐시 + `inputHash`(SHA-256 — **이미 store.js에 있음**)

### 평가 파이프라인 (event-driven, 2-phase — CEP "역방향 매칭"의 최소판)
```
on 상류데이터 변경(store.js 해시 게이트):        // 내용 그대로면 여기 안 옴 = 0 계산
  후보 = broad-phase(공항 or geohash+etd 인덱스)  // 전 비행 스캔 안 함, 쌈
  for f in 후보 where f.inWindow(now):
     if 공항데이터(METAR/TAF/AMOS): 값 직접 비교(A/C/D)   // composer 미호출, 초경량
     else(경로위험 SIGMET/NOTAM/KIM/KTG):
        if narrowPhase(f.route ∩ hazard ∩ etd): f.dirty=true
  // 재계산(diff)은 dirty 비행만, 무거운 엔루트 단면은 그 소스 주기(하루 몇 번)에만
```
> **⚠️ 2026-07 갱신 — 감시 소스 2축:** 상류 store가 국내(KMA)와 해외(NOAA)로 분리됐다. 변화 게이트는 **6개 store 타입을 모두 watch**해야 한다: `metar`/`taf`/`sigmet`(국내) + `metar_overseas`/`taf_overseas`/`sigmet_overseas`(해외, [overseas-weather-processor.js](../../../backend/src/processors/overseas-weather-processor.js)). 브리핑 조립은 두 소스를 이미 병합하므로(briefing-composer) diff 판정 로직은 소스 무관하게 동작하지만, **트리거·인덱스 단계에서 해외 feed 브랜치를 추가**해야 한다. 해외 SIGMET은 `asia_firs`로만 수집 → 그 밖 FIR을 지나는 경로는 SIGMET 감시 사각(한계 명시, v2에서 FIR 확장).
- **요소별 비용 분리**: 공항 지점(A·C·D)=문자·숫자 비교(거의 공짜) / 경로 기하(B)=broad→narrow 2단계. 그래서 D(뇌우·눈·안개 현상)는 부하 거의 안 늘림.
- **배치 절충(Hopper 교훈)**: 무거운 KIM/KTG 엔루트 재계산은 연속이 아니라 소스 갱신 시(하루 몇 회)만.

### 알림 파라미터 (Prometheus·Datadog·Alertmanager 차용, 그대로 이식)
| 개념 | 출처 | 우리 값 |
|---|---|---|
| **dwell** (조건 지속해야 발동, `for:`) | Prometheus | 미니마/카테고리 **2h 지속** (§3.5와 동일) |
| **회복 히스테리시스** (해제 기준 별도) | Datadog/Zabbix | 미니마+여유(운고 +100~150ft) 후 해제 — 경계 진동 방지 |
| **keep_firing_for** (갭에 즉시 해제 안 함) | Prometheus | 데이터 1~2분 갭에 알림 유지 |
| **dedup fingerprint** | Alertmanager | `(flightId, 조건종류, 항목ID/시퀀스)` 같으면 재발송 금지 |
| **group_wait** (묶어 보내기) | Alertmanager | ~30s: 한 비행 여러 변화 → 푸시 1건 |
| **repeat_interval** (미해소 리마인더) | Alertmanager | 6h 1회, 아니면 무발송 |
| **inhibition** (상위 알림이 하위 억제) | Alertmanager | "METAR 수신실패"·"공항폐쇄" 뜨면 그 공항 하위 기상알림 억제 |
| **quiet hours** | Alertmanager mute | 야간 억제(단 CRITICAL은 예외 검토) |
| **idempotency key** | Stripe/Twilio | 중복 푸시 방지 |

### 규모 sanity & 업그레이드 임계 (언제 무거운 구조로?)
- **지금(수백 비행)**: 위 구조로 CPU 무시 수준(재브리핑 10~50ms, dirty만). 단일 EC2 충분.
- **업그레이드 신호(그 전엔 만들지 말 것)**: 5,000+ 비행 → R-tree · 재브리핑 >100ms → delta query(IVM) · 다중 서버 → Redis dedup · 예측다차원 조건 폭증 → BE-tree. **현재 전부 불필요.**

### 이미 가진 재료 (새로 만들 게 적다)
SHA-256 변경감지·snapshot-meta(이벤트 트리거) · `geo-time-match`(narrow-phase) · `alert-state`(쿨다운/조용시간) · briefing 캐시. → **신규는 인덱스 3종 + dwell/히스테리시스/그룹핑 래퍼(~200줄) + Web Push**.

---

## 5C. 용량 산정 (실제 한국 규모, 2026-07-04 조사)

> 결론 선: **전국 조종사·디스패처가 다 써도 앱서버 1대로 충분.** 스케일은 병목이 아니고, 진짜 관리 포인트는 알림 품질(노이즈).

### 실제 대상 규모 (출처: MOLIT/data.go.kr, 2023~2024)
| 대상 | 수 |
|---|---|
| 항공사 현직 조종사 | **~5,300명** (대한항공 2,759 + 아시아나 1,447 + 제주 321 + LCC ~600–800) |
| 운항관리사(디스패처) 자격 | 1,883명 / **현직 ~541명** |
| **전문 핵심층** | **~6,000명** |
| 최대 잠재층(취미·학생·ATC 포함) | ~10,000–12,000명 |
- PPL/CPL 누적 자격자 정확 수치는 공개표 없음(추정). 현업 실시간 사용자 ~6천, 최대 1.2만으로 규모 결론 불변. 디스패처는 현직 500여 명뿐(작고 집중).

### 용량 재계산 (1인 5경로, 동시감시 = 감시창 안 경로만)
가정: 경로가 ~7일에 분산, 감시창 6h → 동시감시 ≈ 4%(피크 ×3 = 12%).

| 사용자 | 저장 경로 | 동시 감시(평균) | 동시 감시(피크) |
|---|---|---|---|
| 6,500 (전문 핵심) | 32,500 | ~1,300 | ~3,900 |
| 12,000 (전국 최대) | 60,000 | ~2,400 | ~7,200 |

- 최악 스파이크(광역 SIGMET, 활성 30% 재계산): 전국 최대치도 ~2,160건 × 20ms ≈ **43s/1코어 → 8코어 ~5s.** 메모리 ~120MB.

### 서버 권장
- **테스트(지금)**: 현재 개인 EC2 그대로.
- **전국 전체(~1.2만)**: 앱서버 **1대(4 vCPU/8GB) + Postgres + Redis + 푸시 워커.** 클러스터 불필요.
- 회사 서버 이전 시: 전국 다 받고도 자원 일부만 사용 → 성장 여유 5~10배(GA·학생·드론/UAM·해외 개방까지).

→ 이 시장 크기에선 §5B의 이벤트 구동·인덱스 구조도 **과분할 정도로 여유**. 스케일보다 **알림 품질(§3·§5)**에 집중.

---

## 6. 우리 데이터로의 매핑 (감시 상품)

> **2026-07 갱신:** 소스가 **국내(KMA)·해외(NOAA)** 2축. 해외분은 별도 store 타입에서 오지만 briefing-composer가 병합하므로 판정 함수는 동일. store 타입을 병기한다.

| ACAS 상품 | 국내(KMA) | 해외(NOAA) | 상태 |
|---|---|---|---|
| SIGMET/AIRMET | KMA IWXXM(5분), store `sigmet` | NOAA, store `sigmet_overseas`(**`asia_firs` 한정**), `source==='NOAA'` 태깅 | ✅ 있음(해외는 asia_firs 밖 사각) |
| TFR | — | — | 국내 상응(공역 NOTAM/경보)로 대체 검토 |
| NOTAM/활주로폐쇄 | KOCA 크롤, `notam-parser`(고도 파싱), 경로 NOTAM | (해외 NOTAM 미수집) | ✅ 국내만, 해외 v2 |
| urgent PIREP | — | — | 국내/해외 PIREP 수집 없음(별도 확보, v2) |
| CWA/severe watch | 공항경보(`AIRPORT_WARNINGS`), SIGWX | — | ✅ 국내 부분 |
| 카테고리(운고·시정) | METAR/TAF, store `metar`/`taf` | store `metar_overseas`/`taf_overseas` | ✅ 있음(양 소스 병합) |
| 엔루트 착빙·난류 | KIM 착빙·KTG, `enroute-model.js` | (해외 격자 미연동) | ✅ 국내만(ACAS엔 없는 강점), 해외 v2 |

**공통 판정 모듈은 소스 무관 재사용:** `flight-category.js`·`hazard-section.js`(3D 매칭)·`taf-window.js`. 해외 경로 브리핑은 `profile-composer.js`가 SID/STAR 없는 해외공항 단면까지 이미 처리.

---

## 7. 데이터 모델 (ACAS 스키마를 우리 스택으로)

> **2026-07 갱신 — 절반은 이미 있음.** 아래 SavedFlightPlan은 목표 모델이고, 실제로는 **`routes`(계획 저장)·`presets`(미니마)·`requests`(예보관 문의) 테이블이 이미 배포됨**([schema.sql](../../../backend/src/db/schema.sql)). #13 착수 = 기존 `routes`에 알림 컬럼을 얹고 신규 알림 테이블 2개만 추가.

**이미 있는 것(재사용):**
```
routes {                                // ✅ 배포됨 (me/routes.js CRUD)
  id, user_id, name,
  etd,                                  // ISO — 주석에 "#13 감시"라고 이미 명시됨
  payload(JSON snapshot),               // routeForm/vfrWaypoints/cruiseAltitudeFt/alternateAirport 등 무손실
  created_at, updated_at
}
presets { user_id, ... }                // ✅ 개인 미니마 서버 미러 (localStorage 병행)
requests { id, user_id, route_id, ... } // ✅ 조종사→예보관 문의 큐
```

**#13 착수 시 추가할 것(신규):**
```
// routes 테이블에 얹을 알림 설정 컬럼(또는 route_alert_settings 1:1 테이블)
+ alert_enabled: bool
+ alert_start_min_before_etd: int (0~360, 기본 120)
+ altitude_filter_ft: int (기본 4000)
+ send_no_change_confirm: bool, confirm_min_before_etd: int (기본 60)
+ eta                                        // 목적지 TAF 평가 시각. 사용자 입력(주), 초기값=ETD+거리/tasKt
+ last_briefing_snapshot_id                 // diff 기준
+ expires_at (=eta+2h)                       // 감시 종료
  // 미니마는 presets 테이블을 user_id로 조인(별도 ref 불필요)
  // ⚠️ 구현 확인: ETA 초기값 서버 계산하려면 tasKt가 route payload(snapshot)에 저장돼야 함
  //    (cruiseAltitudeFt는 저장 확인됨, tasKt 저장 여부 점검)

push_subscriptions {                    // 🆕 없음 — Web Push VAPID 구독
  id, user_id, endpoint, keys(p256dh,auth), created_at
}
triggered_alerts {                      // 🆕 없음 — 발송 이력·dedup
  id, route_id,
  type: CATEGORY|VIS|CEIL|WIND|WX|ALTERNATE_FLIP|ENROUTE_HAZARD|ENROUTE_ICE_TURB|NO_CHANGE_CONFIRM,
  severity: CRITICAL|HIGH|MEDIUM|LOW|INFO,
  target(airportOrSegment), from_val, to_val,
  source_id, source_seq, source_issued_at,  // dedup 키
  dedup_key, reissue_count,
  detected_at, pushed_at, channel_status
}
```

---

## 8. 우리 코드 재사용 / 신규 구분

**재사용(있음):**
- 상류 변화감지: `store.js`(SHA-256), snapshot-meta → 재브리핑 트리거 **(2026-07: 국내+해외 6 store 타입 watch, §5B)**
- 재브리핑: `POST /api/route-briefing`(briefing-composer) **— 국내+해외 병합 조립 이미 됨**
- 판정: `flight-category.js`, `taf-window.js`(교체 1-2-3), `hazard-section.js`+`geo-time-match.js`(경로∩시간∩고도), `enroute-model.js`, `planned-altitude.js`(고도필터)
- 미니마: `SettingsModal` localStorage `airport_minima_settings` **+ 서버 `presets` 테이블(미러)**
- 쿨다운/조용시간 개념: 모니터링 `alert-state.js` **(⚠️ `monitoring/legacy/` 경로 — legacy화 여부 확인 후 재사용)**
- **🆕 서버측 계획 저장·로그인(#7) = 배포 완료** — `routes` 테이블(`etd` "#13 감시"), auth·role, `me/routes.js` CRUD. **문서 원본이 "하드 전제"라 한 항목이 이미 충족됨.**

**신규(남은 것만):**
1. **재브리핑 스케줄러** — 상류 갱신마다 or 15~30분 정시, 각 활성 계획 재계산 (**국내+해외 소스 게이트, §5B**)
2. **diff 엔진** — §3·§4 규칙(판정은 기존 함수 호출, diff+severity+dedup만 신규)
3. **Web Push** — service worker + VAPID + `push_subscriptions` 테이블 + 발송(⚠️iOS는 홈화면 추가 필요)
4. **알림 테이블·설정 컬럼** — `routes`에 알림 설정, `triggered_alerts`(§7)
5. **알림 피로 플레이북**(§5) — 억제·rate limit·차등채널

> ~~서버측 계획 저장 + 로그인~~ 은 배포되어 신규 목록에서 재사용으로 이동함.

---

## 9. v1 범위 확정 제안

> **2026-07 갱신:** 서버 계획저장·로그인·서버 미니마는 **이미 있음** → v1 실작업은 스케줄러·diff·Web Push·알림 테이블. 아래 "포함"의 전제는 충족된 것으로 표시.

**포함(확정 2026-07-07 — §3.0 7종):**
- ~~서버 계획저장(로그인)~~ **✅ 배포됨** + 활성 계획 재브리핑(**국내+해외 6 store 게이트**)
- **알림 7종**: 목적지 운고/시정 · 교체필요 플립 · 경로 신규 Convective SIGMET · severe 착빙 · severe 난류 · 출발공항 저시정(ETD) · 출발공항 TS(ETD). 모두 고도필터 4000ft, 해외 경로 동일(SIGMET은 `asia_firs` 범위).
- **감시 라이프사이클(확정): 시작 ETD−2h 기본(조종사 2~6h 선택), 종료 ETD.** "이상없음" 확인알림 ETD−60분(옵션).
- **개인 미니마 v1 = 운고·시정만**(이미 구현). 측풍·돌풍·pilot_type = v2.
- **전달 단계(§11.5):** Phase 1(시연) = 두뇌(스케줄러·diff·피로방지) + **인앱 알림센터 + 텔레그램** + 딥링크(SW 없이 끝까지 시연 가능) → Phase 2 = **Web Push**(SW·manifest·VAPID) → Phase 3 = 카카오·이메일.
- 억제·dedup(§5의 1·2·4)

**v2로 미룸:**
- **바람·측풍·돌풍 미니마**(죽은 스키마 컬럼 연결) · pilot_type 프리셋
- 인플라이트 감시(CTA+2h), PIREP, 리라우팅 제안(디스패치 영역)
- **해외 확장**: `asia_firs` 밖 FIR SIGMET, 해외 NOTAM, 해외 엔루트 착빙·난류 격자

---

## 10. 출처

- **ACAS**: 1800wxbrief.com/Website/faqs · Lockheed Martin 2012 발표 · AOPA 2012-10-13
- **ForeFlight/Garmin**: blog.foreflight.com(Flight Notifications/NOTAM Advisor) · ipadpilotnews.com · garmin.com newsroom/blog
- **SkyDemon/autorouter/Maverick**: skydemon.aero/plan · autorouter.aero/wiki/gramet · weathercompany.com Maverick Dispatch · Breeze Airways 사례(aircraftit.com)
- **임계값 표준**: ICAO Annex 3 App.5 · WMO No.49 · NWS 10-813 · FAA JO 7900.5E · NWS CAC(weather.gov/aviation/cac) · 한국 AIP GEN 3.5(KOCA, ICAO 정렬)

---

## 11. UX · 데이터 모델 (2026-07-07 확정) ★★

이 절이 v1 입력·관리 화면의 **단일 확정본**. §7 데이터 모델은 이 절 기준으로 읽는다.

### 11.1 핵심 개념 — 템플릿 vs 예정 비행
경로(재사용)와 특정 날짜의 비행(감시 대상)을 분리한다. **테이블은 기존 `routes` 하나** — `etd` 유무로 구분.

| 개념 | `etd` | 감시 | 수명 |
|---|---|---|---|
| **경로 템플릿** | null | 안 함 | 안 지워짐(재사용). 상한 100 |
| **예정 비행** | 있음 | ETD−6h~ETD | **ETD+3h 지나면 자동삭제** |

- **등록** = 템플릿 클론 + ETD/ETA 세팅(행 복사). **반복 비행 = 템플릿 하나로 "새 비행" 반복 등록**(자동 recurrence는 v2).
- **지난 비행은 아카이브 없이 삭제** — 사후 브리핑 용도 없음. 지연 대비 ETD+3h 유예.

### 11.2 서버 부하·알림 피로 = "1인 1활성감시" 규칙
- 경로는 여러 개 등록해도 **활성 감시 = 사용자당 가장 임박한 예정 비행 1개만**(ETD가 감시창 2~6h에 든 것 중 최선두).
- 효과: 서버 부하 = 사용자 수 × 1(경로수 무관, §5C 여유 재확인), 동시 알림 폭주 방지. 6h 안에 두 비행 겹치면 임박한 것 우선, 앞 비행 ETD 지나면 다음 감시 시작(엣지, v1 단순규칙).

### 11.3 화면 — 개인설정 창(탭 2)
알림 등록·관리의 **유일한 집 = 개인설정 패널**(옵션 A 확정). 경로 창엔 지름길 버튼만.

```
[기상 미니마] 탭
  운고(ft) · 시정(m) 단일 입력 + [VFR][IFR] 프리셋 버튼   ← 공항별 그리드 폐기
  (실효 = max(내 값, 공항 published[#8]))

[비행 알림] 탭
  + 새 알림 등록:  템플릿[RKSI→RKPC ▾]  ETD[datetime-local]  ETA[입력값·러프 pre-fill]  [등록]
  등록 목록(행별):  RKSI→RKPC  ETD 07-08 10:00  [감시중]  [ETD 조정] [삭제]
```
- **ETA = 사용자 입력이 주(主).** 조종사는 자기 EFB에서 경로·ETA를 이미 뽑아오므로 그 값을 넣게 한다. "예상값·수정하세요" 라벨.
  - **초기값(pre-fill) = ETD + totalDistanceNm ÷ tasKt** — 러프. **둘 다 이미 있음**(거리=등록 시 baseline 브리핑, TAS=route form [AircraftProfileField.jsx](../../../frontend/src/features/route-briefing/AircraftProfileField.jsx), 기체 프로파일 재사용도 구현됨). **새 속도 필드·바람보정·성능프로파일·절차 track-mile 안 만듦**(상용 비행계획 엔진 영역, ±30분 목적엔 과함).
  - TAS≠GS(바람 무시)지만 ETA는 "목적지 TAF 몇 시 걸 볼까"용(±30분 충분) + 사용자가 덮어씀 → 러프 무방.
- **시간 입력 위젯은 이 탭 한 곳.** [ETD 조정]이 같은 위젯 재사용(지연 시 ETD 미루면 감시창도 이동).
- **비행경로 창의 기존 시간 = "브리핑 시각"으로 라벨 변경**(일회성 조회용, ETD 아님). 경로 창의 **[이 비행 알림 등록]** 버튼은 현재 경로+시각을 알림 패널로 **넘겨서** 등록시키는 지름길일 뿐, 저장·관리는 항상 패널.
- 결과: 한 비행 ETD = **단일 값**(예정 비행 레코드), 위젯 재사용, 편집은 패널에서만.

### 11.3.1 등록 흐름 · 게이트 · 상태 (2026-07-07 확정)
**두 입구:**
- **A. 패널에서** — 기존 템플릿 선택 → ETD 입력 → 등록.
- **B. 경로 창에서** — [이 비행 알림 등록] → **경로를 템플릿으로 자동 저장**(없으면) + 패널로 넘겨 등록. (등록=저장 의도이므로 자동저장 확정.)

**고급(접힘 기본):** `감시 시작 [2h ▾ 2~6]` · `이상없음 확인 [off]`. 대부분 안 건드림.

**게이트:**
- 미니마 미설정 → **차단 안 함**, **VFR 프리셋 기본 적용**(§3.2) + 인라인 힌트 "기본 VFR 적용 중 · 미니마 설정".
- ETD **미래만**(과거 차단), ETA > ETD.
- 저장 상한 **100** 초과 시 차단.

**등록 후 피드백(기대관리):** 토스트 "등록됨 · ETD−2h부터 감시 시작". 며칠 전 저장해도 감시는 나중 시작임을 명시.

**리스트 상태칩:** **대기**(감시창 전) · **감시중**(창 안) · 겹침 시 임박한 것 감시중, 나머지 **대기·순번 #n**(§11.2). ETD 지나면 자동 소멸.

**관리:** [ETD 조정](지연 시 인라인, ETD 밀면 ETA·감시창 따라감) · [삭제](즉시 + undo 토스트) · 같은 템플릿 **여러 날짜 등록 가능**(=반복비행).

**시간대:** 저장=UTC(Z), 표시=**Z + KST 병기**(항공 UTC 관례, 해외 취항지 혼동 방지).

### 11.4 데이터 모델 정정(§7 갱신)
- **개인 미니마 = 사용자당 단일 {ceiling_ft, visibility_m}(+pilot_type v2)** → 배포된 per-airport `presets`는 과함. v1은 단일 레코드로 축소(공항별 override는 v2). #8 published 미니마는 별개 객관 데이터(전사 JSON).
- `routes`에 알림 컬럼(§7)은 **예정 비행 행에만** 의미. 템플릿 행은 `etd=null`·알림 off.
- 신규 테이블은 여전히 `push_subscriptions`·`triggered_alerts` 2개(§7).

### 11.5 알림 전달 · 상호작용 (2026-07-07 확정)

**채널 (실현가능성 코드확인 반영):**
| 대상 | 채널 | 구현 | 비고 |
|---|---|---|---|
| **데스크톱 웹** | **인앱 알림센터**(벨 버튼 → 누적 알림 패널) | **신규 제작**(monitoring/legacy 알림 UI 재사용 안 함 — 그건 클라 실시간 임계경보라 다른 물건) | 서버 `GET /api/me/alerts`(`me/routes.js` 패턴)로 `triggered_alerts` 조회 |
| **모바일** | **Web Push** | **Phase 2** — 자리만: `push_subscriptions` 테이블 + 발송 seam은 Phase 1에 두되, 서비스워커·manifest·`web-push`+VAPID·구독 UI는 Phase 2 | 지금 SW·PWA manifest·web-push 의존성 전부 없음(순수 신규). iOS는 홈화면 설치 필수 |
| **시연** | **텔레그램 봇** | **Phase 1** — 백엔드 이미 네이티브 `fetch` 사용 → `sendMessage` POST 한 줄, 의존성 0 | `.env` `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID`(@BotFather 발급). inline 버튼에 딥링크 URL → 텔레그램에서도 탭→비행화면 |
| 카카오 알림톡 · 이메일 | — | **나중**(v2+) | 알림톡=비즈채널·템플릿승인·건당비용 |

**발송 seam(준비):** diff 엔진은 채널 무관하게 `TriggeredAlert`만 만들고, **얇은 sender 계층**이 채널별로 분기(텔레그램 now / web-push·인앱은 추가만). 채널 추가가 diff 로직을 안 건드리게. (과한 추상화 금지 — 함수 하나로 시작.)

**딥링크 (탭 → 그 비행 변경점 화면):**
- App.jsx가 이미 pathname + `?airport=` 쿼리로 라우팅(라우터 라이브러리 없음) → **`?flight=<routeId>`** 추가. 저장 경로를 서버에서 로드해 브리핑에 먹이는 배선만.
- 화면 = §2 에스컬레이션 UX 그대로: 비행 헤더 + 무엇이 언제(before→after) + 왜 알림(내 미니마 대비) + [전체 브리핑 보기] + "공식 KMA 재확인" 고지.
- 세션 만료 시 로그인 후 그 화면으로 착지(딥링크 유지). 여러 건이면 알림센터 리스트 → 각 항목이 이 화면으로.

**알림 문구(글랜서블):** 예) `RKPC 목적지 IFR 하락 · ETA 12:10 운고 400ft(내 미니마 500 아래)`. ko/en(앱 언어설정 재사용).
