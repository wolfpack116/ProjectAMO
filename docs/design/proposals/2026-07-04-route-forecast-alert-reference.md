# 경로 예보변화 알림(#13) — 구현 참조

> 상태: **구현 참조(reference)** — [운영 기능 확장 초안](2026-07-04-operational-features-draft.md) #13의 근거 문서. 스펙 작성 시 여기 수치·규칙을 그대로 가져다 쓴다.
> 근거: 2026-07-04 병렬 심층조사 4건(Leidos ACAS / ForeFlight·Garmin / SkyDemon·autorouter·Maverick Dispatch / ICAO Annex 3·NWS 임계값 표준).
> 대상 기능: 사용자가 **비행예정일+경로**를 저장 → 그날 전까지 경로·시각 예보가 **의미있게 변하면 푸시**. (모니터링 페이지의 공항 실시간 임계값 경보와 별개.)
> ⚠️ 환각 경계: 아래 "DOCUMENTED"는 출처 확인분, "추정"은 표시함. 벤더 내부(회랑 폭 등)는 공개 안 됨 → 우리 기본값으로 대체.

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
| **감시 시작** | ETD − N분, N ∈ [0, 360], 기본 **120** | 계획 저장 시 사용자가 N 선택(기본 2h 전) |
| **감시 종료(프리플라이트)** | ETD 도달 시 중단 | 동일 |
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

### 3.1 유일 핵심 트리거 — "내 미니마 선"을 예보가 넘을 때 ★핵심
- 알림의 본질 = **예보가 "내가 못 가는 선"을 넘을 때.** 그 선은 조종사 유형·기량에 따라 다르므로 **사용자가 설정**한다. 우리는 이미 `SettingsModal`에 공항별 `ceilingFt`·`visibilityM`을 저장(`airport_minima_settings`) → 그대로 사용(#8과 동일).
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

| ACAS 상품 | 우리 보유 데이터/소스 | 상태 |
|---|---|---|
| SIGMET/AIRMET | KMA IWXXM(5분), `hazard-section.js` 3D 매칭 | ✅ 있음 |
| TFR | — | 국내 상응(공역 NOTAM/경보)로 대체 검토 |
| NOTAM/활주로폐쇄 | KOCA 크롤, `notam-parser`(고도 파싱), 경로 NOTAM | ✅ 있음 |
| urgent PIREP | — | 국내 PIREP 수집 없음(별도 확보 필요, v2) |
| CWA/severe watch | 공항경보(`AIRPORT_WARNINGS`), SIGWX | ✅ 부분 |
| 카테고리(운고·시정) | METAR/TAF, `flight-category.js` | ✅ 있음 |
| 엔루트 착빙·난류 | KIM 착빙·KTG, `enroute-model.js` | ✅ 있음(ACAS엔 없는 우리 강점) |

---

## 7. 데이터 모델 (ACAS 스키마를 우리 스택으로)

```
SavedFlightPlan {                       // 서버 저장 (로그인 #7 필요)
  id, userId,
  dep, dest, altn, route,               // 기존 routeStore.js 입력 확장
  etd, eta, cta,                        // 계획 시각
  altitudeFt,
  // 알림 설정
  alertEnabled: bool,
  alertStartMinBeforeEtd: int (0~360, 기본 120),
  altitudeFilterFt: int (기본 4000),
  sendNoChangeConfirm: bool, confirmMinBeforeEtd: int (기본 60),
  minimaProfileRef,                     // #7·#8 미니마 연계
  pushSubscriptions: [webPushSubscription],  // VAPID
  lastBriefingSnapshotId,               // diff 기준
  createdAt, updatedAt, expiresAt(=eta+2h)
}

TriggeredAlert {
  id, planId,
  type: CATEGORY|VIS|CEIL|WIND|WX|ALTERNATE_FLIP|ENROUTE_HAZARD|ENROUTE_ICE_TURB|NO_CHANGE_CONFIRM,
  severity: CRITICAL|HIGH|MEDIUM|LOW|INFO,
  target: {airportOrSegment}, from, to,
  sourceId, sourceSeq, sourceIssuedAt,  // dedup 키
  dedupKey, reissueCount,
  detectedAt, pushedAt, channelStatus
}
```

---

## 8. 우리 코드 재사용 / 신규 구분

**재사용(있음):**
- 상류 변화감지: `store.js`(SHA-256), snapshot-meta → 재브리핑 트리거
- 재브리핑: `POST /api/route-briefing`(briefing-composer)
- 판정: `flight-category.js`, `taf-window.js`(교체 1-2-3), `hazard-section.js`+`geo-time-match.js`(경로∩시간∩고도), `enroute-model.js`, `planned-altitude.js`(고도필터)
- 미니마: `SettingsModal` localStorage `airport_minima_settings`
- 쿨다운/조용시간 개념: 모니터링 `alert-state.js`

**신규:**
1. **서버측 계획 저장 + 로그인**(#7) — 지금 localStorage → 서버(앱 꺼져도 감시)
2. **재브리핑 스케줄러** — 상류 갱신마다 or 15~30분 정시, 각 활성 계획 재계산
3. **diff 엔진** — §3·§4 규칙(판정은 기존 함수 호출, diff+severity+dedup만 신규)
4. **Web Push** — service worker + VAPID + 구독 저장 + 발송(⚠️iOS는 홈화면 추가 필요)
5. **알림 피로 플레이북**(§5) — 억제·rate limit·차등채널

---

## 9. v1 범위 확정 제안

**포함(실용 기준 최소):**
- 서버 계획저장(로그인) + 활성 계획 재브리핑
- 판정: **① 내 미니마 선 크로싱(악화, 2h 지속 — 카테고리 프리셋으로 선 설정, 데이터 이미 있음) · ② 교체필요 플립 · ③ 경로상 신규 SIGMET**(+고도필터 4000ft).
- 감시 시작 ETD−120분(설정), 종료 ETD / "이상없음" 확인알림 ETD−60분(옵션)
- Web Push + 억제·dedup(§5의 1·2·4)

**v2로 미룸:**
- 인플라이트 감시(CTA+2h), PIREP, 바람·측풍·돌풍 미니마 정밀화, 리라우팅 제안(디스패치 영역)

---

## 10. 출처

- **ACAS**: 1800wxbrief.com/Website/faqs · Lockheed Martin 2012 발표 · AOPA 2012-10-13
- **ForeFlight/Garmin**: blog.foreflight.com(Flight Notifications/NOTAM Advisor) · ipadpilotnews.com · garmin.com newsroom/blog
- **SkyDemon/autorouter/Maverick**: skydemon.aero/plan · autorouter.aero/wiki/gramet · weathercompany.com Maverick Dispatch · Breeze Airways 사례(aircraftit.com)
- **임계값 표준**: ICAO Annex 3 App.5 · WMO No.49 · NWS 10-813 · FAA JO 7900.5E · NWS CAC(weather.gov/aviation/cac) · 한국 AIP GEN 3.5(KOCA, ICAO 정렬)
