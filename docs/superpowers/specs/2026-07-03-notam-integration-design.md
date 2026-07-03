# NOTAM Integration Design

## Purpose

대한민국 유효 항공고시보(NOTAM)를 백엔드에서 주기적으로 수집해, (1) 공항 패널의 NOTAM 탭에서 공항별로, (2) 지도 위에 카테고리별 레이어로 표시한다.

## Scope

- 백엔드: KML 크롤러 → 파서 → 프로세서 → store → API
- 프론트엔드: 사이드바 전역 NOTAM 패널(카테고리 토글 + 지도 레이어), 공항 패널 NOTAM 탭(공항별 목록)
- 비행 전 브리핑(route-briefing) 파이프라인 연동: 경로상 NOTAM을 기존 hazard-section 매칭에 태워 Go/No-go 배너·③노선 위험 리스트·지도 레이어 칩에 자동 반영

## Anti-Scope

- NOTAM 이력 저장/DB화(최신본만 유지)
- xls 소스 크롤링(KML만 사용)
- 반경 기반 공항 매칭(A필드 정확 일치만)
- AWS 프로덕션 배포 실증(별도 미해결 리스크로 기록, 이번 스코프 아님)
- SNOWTAM 등 특수 시리즈에 대한 별도 UX(전부 같은 파이프라인으로 수집·분류만 함)
- LineString형 NOTAM(회랑형 임시제한구역)의 브리핑 자동 경로매칭(아래 Route-Briefing Integration의 한계 참조 — 지도/탭 노출은 포함, 매칭만 제외)
- 경로(출발-목적지) 연동 우선순위 정렬(전역 패널에는 "선택 공항" 우선순위만 포함, 경로 연동은 브리핑 섹션 통합으로 대체)

## Verified Facts (2026-07-03 조사)

### 크롤링 소스 확인

- URL: `https://aim.koca.go.kr/xNotam/index.do?type=search2&language=ko_KR`
- 로그인 불필요. 페이지 GET 로드 시 서버가 기본 검색을 이미 실행해서 결과 테이블이 채워져 있음.
- 기본 폼 상태: `sch_inorout` 라디오 = **국내**(checked), 나머지 필터(LOCATION/SERIES/AIRSPACE 등)는 전부 빈칸.
- **"KML다운로드" 버튼**은 `kmldownload()`를 호출 → 현재 검색 컨텍스트에 따라 `/searchValidNotam.do`(유효 검색 화면 기준) 등으로 hidden form을 POST 제출, `target=_blank`로 파일 스트림 다운로드.
- 검색 버튼을 누르지 않고 기본 상태에서 바로 다운로드해도 됨 — 이게 오히려 정답.

### 화면 테이블과 다운로드 파일의 차이 (중요, 실측 검증됨)

- 화면 결과 테이블(`#notamSheet-table`)은 **ISSUE TIME(발행일) 기준 최근 며칠치만** 보여줌(실측: 07-01~07-03, 103건).
- **KML 다운로드는 발행일과 무관하게 "현재 유효한" 전체 집합**을 반환함(실측: 414건, B)필드 발효시작일이 2026-02-21까지 소급되는 장기 유효 NOTAM 포함).
- 따라서 크롤러는 화면 테이블이 아니라 **KML 다운로드 결과를 기준 데이터**로 삼는다. 화면 행 수와 다운로드 건수가 다른 것은 버그가 아니라 정상 동작.
- 국내 공항 코드(`A)RK**`)만 나오는 것 확인, 국제 유출 없음.

### 헤드리스 크롤링 가능성 (실측 검증됨)

- 로컬 Windows 환경에서 Playwright(`chromium.launch({ headless: true })`, 신규 브라우저 컨텍스트, 쿠키/세션 없음)로 사이트 접속 → `KML다운로드` 텍스트 셀렉터 클릭 → `download` 이벤트로 파일 저장까지 **정상 동작 확인**(931,866 bytes, 로그인 불필요, 캡차/봇 차단 없음, 확인창 없음).
- **미검증(별도 리스크로 기록)**: AWS 프로덕션 EC2(`3.34.113.37`, Amazon Linux, `docs/aws-ec2-manual-deploy.md` 기준)에서도 동일하게 동작하는지는 이번 세션에서 사내망 클라우드 접속 차단으로 검증 못함. 배포 전 별도 확인 필요:
  1. Chromium 시스템 의존성 설치 가능 여부(`playwright install chromium --with-deps`, Amazon Linux 패키지 매니저 호환성)
  2. 아웃바운드 443 방화벽/보안그룹 허용 여부
  3. `aim.koca.go.kr`의 AWS IP 대역 차단 여부(서울 리전이라 가능성은 낮다고 추정하나 미확인)

### Q-code 카테고리 매핑 (FAA/ICAO Appendix B 공식 문서 기준, 실측 대조 완료)

출처: `https://www.faa.gov/air_traffic/publications/atpubs/notam_html/appendix_b.html` (International NOTAM Q Codes, 2nd/3rd letter = subject, 4th/5th letter = status)

실측 414건 기준 2nd/3rd letter(subject) 분포와 공식 의미:

| Subject code | 공식 의미 | 실측 건수(대표 조합) |
|---|---|---|
| RP | Prohibited area | 6 (QRPCA) — **비행금지구역** |
| RD | Danger area | 155 (QRDCA) — 위험구역 |
| RR | Restricted area(상시) | 13 (QRRCA) — 제한구역 |
| RT | Temporary restricted area | 161 (QRTCA) — 일시제한구역 |
| RA | Airspace reservation | 소수 — 공역유보 |
| OB | Obstacle | 8 (QOBCE) — **장애물** |
| PO | Obstacle clearance altitude/height | 소수 — 장애물 관련 |
| WM | Missile/gun/rocket firing | 1 (QWMLW) — 사격/훈련구역 |
| GA/GW/IC/IL/IN/IG/ID/NT/CT/CP/CA | 항행안전시설(GNSS/ILS/VOR/레이더/무선국) | 합계 다수 |
| MR/MX/MP/MD/MB/MA/LX/FA/PI/PF | 공항시설(활주로/유도로/계기접근절차 등) | 합계 다수 |

→ **지도 레이어 카테고리 7개**로 확정: 비행금지구역(RP) / 위험구역(RD) / 제한구역(RR+RT+RA) / 장애물(OB+PO) / 사격·훈련구역(WM) / 항행·공항시설 공지(나머지 시설계열 코드) / 기타(미매핑 폴백)

### 심각도 3단계 매핑 (외부 리서치로 검증됨)

디자인 헌법 §2/§4("색=의미, 색 아껴쓰기, 표준 없는 도메인은 직접 제작이되 절제")에 따라 카테고리 7개를 색 7개로 나누지 않고 3단계로 묶는다. ForeFlight/Garmin Pilot 등 EFB 업계도 공식 심각도 표준은 없지만 유사한 3단계 운영영향 등급을 관행적으로 씀(리서치로 확인, 2026-07-03) — 아래 매핑을 그대로 채택:

| 심각도 | 카테고리 | 의미 |
|---|---|---|
| red | 비행금지구역(RP), 사격·훈련구역(WM) | 진입 금지 |
| amber | 위험구역(RD), 제한구역(RR+RT+RA), 장애물(OB+PO) | 주의 필요 |
| gray | 항행·공항시설 공지, 기타 | 운영 정보(회피 대상 아님) |

`notam-processor.js`가 카테고리와 함께 `severity: 'red'|'amber'|'gray'`를 레코드에 계산해 넣는다. 색은 배지에만 쓰고 카드/행 자체엔 강조 테두리를 넣지 않는다(좌측 색 보더 카드는 범용 AI 대시보드 톤이라 배제 — 앱의 실제 관례는 `.ap-taf-period`처럼 무채색 카드+색 배지 조합).

## Architecture

### 데이터 흐름

```
cron(1일 1회, backend/src/index.js)
  → notam-crawler.js (Playwright: 사이트 접속 → 기본상태 그대로 KML다운로드 클릭 → 메모리 버퍼로 수신, 디스크 파일 저장 없음)
  → notam-parser.js (KML XML → 구조화 레코드: id/series/location(A필드)/qcode/validFrom/validTo/rawText/geometry)
  → notam-processor.js (Q-code → 7개 카테고리 매핑, 공항(A필드)별 그룹 인덱스 사전 계산)
  → store.save('notam', data)  (최신본만, 기존 latest.json 패턴)
  → GET /api/notam  (store.getCached('notam') 그대로 반환)
  → frontend fetchNotam()
       ├─ (A) 사이드바 NotamPanel: 카테고리 필터 + 지도 레이어 토글
       └─ (B) AirportPanel NotamTab: A필드 정확 일치 필터
```

### FIR 광역 스코프 (실측에서 발견된 갭)

실측 414건 중 342건이 `A)RKRR`(공항 코드가 아니라 **인천 FIR** 코드, 대한민국 전역에 적용됨). "공항탭 = A필드 정확 일치"만으로는 이 342건이 **어떤 개별 공항 탭에도 안 뜬다** — 실제로 전역에 영향 주는데도 누락됨.

`notam-processor.js`가 `scope: 'airport' | 'fir'`를 함께 계산:
```js
const KOREA_FIR_CODES = ['RKRR']  // 현재 확인된 것은 이거 하나, 구현 시 재확인
scope = KOREA_FIR_CODES.includes(location) ? 'fir' : 'airport'
```
`scope: 'fir'`인 레코드는 A필드 일치 여부와 무관하게 **모든 공항 탭에 "전역 공지" 섹션**으로 노출. 지도에도 342건을 폴리곤으로 겹쳐 그리면 화면이 붉게 뒤덮이므로, FIR 스코프는 폴리곤 렌더 대상에서 제외하고 리스트(전역 패널/공항탭)에서만 노출한다.

### 시간 상태 (활성 vs 예정)

크롤이 1일 1회라 서버가 `timeState`를 박아두면 최대 24시간 stale해진다 — **프론트에서 렌더 시점마다 계산**한다.
```js
// notam-processor.js 등 shared 위치가 아니라 frontend/src/features/notam/lib/notamViewModel.js
function deriveTimeState(validFrom, validTo, nowMs) {
  return nowMs < validFrom ? 'upcoming' : 'active'
}
```
`upcoming`은 텍스트를 `--text-3`로 톤다운 + "예정" 라벨. 심각도(배지 색)와는 다른 축이라 겹쳐 쓰지 않는다.

### 선택 공항 우선순위 (전역 패널)

`App.jsx`의 기존 `selectedAirport` 상태를 `NotamPanel`에 prop으로 넘겨, 해당 공항 A필드 일치 항목을 테이블 최상단에 별도 섹션으로 고정. 새 API 호출 불필요(이미 받은 전체 리스트 재정렬만). 경로(출발-목적지) 연동은 아래 Route-Briefing Integration으로 대체하고, 전역 패널 자체의 경로 인식은 범위 밖.

### 백엔드 파일

| 파일 | 역할 |
|---|---|
| `backend/src/notam/notam-crawler.js` | Playwright 크롤러(사이트 접속→다운로드 클릭→버퍼 수신) |
| `backend/src/parsers/notam-parser.js` | KML → 구조화 레코드 배열, Q-line·F)/G)필드에서 고도밴드 파싱 |
| `backend/src/processors/notam-processor.js` | Q-code→카테고리 매핑, `severity`(red/amber/gray) 계산, `scope`(airport/fir) 계산, 공항별 그룹 인덱스 |
| `backend/src/index.js` | cron 등록(1일 1회, 기존 per-type lock 패턴) |
| `backend/src/store.js` | `TYPES`에 `'notam'` 추가(최신본만) |
| `backend/server.js` | `GET /api/notam` 라우트 추가, `POST /api/route-briefing` 핸들러에 `store.getCached('notam')` 주입 |
| `backend/src/briefing/hazard-section.js` | `buildHazardSection`에 `notam` 파라미터·`matchItems(notam, 'NOTAM', ctx)` 추가, `hazardLevel()`에 NOTAM 분기 |
| `backend/src/briefing/briefing-composer.js` | `notam` 데이터를 `buildHazardSection` 호출에 주입(회색 심각도 제외) |
| `backend/test/notam-parser.test.js` | 실제 KML 샘플 fixture 기반 파싱 테스트 |
| `backend/test/notam-processor.test.js` | Q-code→카테고리/심각도/스코프 매핑 커버리지(확인된 코드 전부 + 미지 코드 폴백) |
| `backend/test/hazard-section.test.js` | NOTAM 매칭 케이스 추가(기존 SIGMET/AIRMET 커버리지에 통합) |

### 프론트엔드 파일

| 파일 | 역할 |
|---|---|
| `frontend/src/api/weatherApi.js` | `fetchNotam()` 클라이언트 추가 |
| `frontend/src/app/layout/Sidebar.jsx` | NOTAM 아이콘 복귀 — `topItems`(또는 `bottomItems`) 배열에 아이콘/라벨 항목 추가 **+** `PANEL_MAP`에 `notam` 등록(둘 다 필요, 최초 스펙은 후자만 언급함) |
| `frontend/src/app/layout/MobileMoreMenu.jsx` | 모바일도 동일하게 복귀 |
| `frontend/src/features/notam/NotamPanel.jsx` | (A) 전역 패널: 카테고리 토글 + 심각도 탭(금지·피격/주의/정보) + 밀도형 테이블(`ap-taf-table` 패턴), `selectedAirport` 우선순위 섹션 |
| `frontend/src/features/notam/lib/notamLayers.js` | Mapbox 소스/레이어 설치·동기화·카테고리 가시성, `minzoom` 기반 마커↔폴리곤 전환(`NOTAM_SOURCE_IDS`/`NOTAM_LAYER_IDS` 소유권 export) |
| `frontend/src/features/notam/lib/notamGeoJson.js` | 백엔드 페이로드 → 카테고리별 GeoJSON FeatureCollection 변환, `scope: 'fir'` 레코드 제외 |
| `frontend/src/features/notam/lib/notamViewModel.js` | `deriveTimeState`(active/upcoming), 심각도별 그룹핑·정렬, 청크 로딩("더 보기") |
| `frontend/src/features/notam/lib/notamLayers.test.js` | GeoJSON 변환/카테고리 분리 테스트 |
| `frontend/src/features/airport-panel/tabs/NotamTab.jsx` | (B) 공항별 NOTAM 목록 + `scope: 'fir'` 전역 공지 섹션 |
| `frontend/src/features/airport-panel/lib/notamViewModel.js` | 공항 탭 표시용 가공(배지/유효기간 포맷) |
| `frontend/src/features/airport-panel/AirportPanel.jsx` | 탭 목록에 NOTAM 추가 |
| `frontend/src/features/map/MapView.jsx` | `activePanel === 'notam'` 조건부 렌더 + `useStyleSyncedEffect(mapRef, isStyleReady, styleRevision, (map) => syncNotamLayers(map, notamModel), [notamModel])` 한 줄(ADR 0001 seam 재사용, 새 `useEffect` 추가 금지). `notamModel`을 `App.jsx`에서 prop으로 받는 배선 단계 포함(최초 스펙 누락분) |
| `frontend/src/features/weather-overlays/lib/weatherOverlayLayers.js` | `MET_LAYERS`에 `{ id: 'notam', label: 'NOTAM', color: ... }` 마스터 토글 등록(위 "레이어 가시성 모델" 참조) |
| `frontend/src/features/route-briefing/lib/hazardLayers.js` | RULEBOOK에 NOTAM 카테고리→`notam` 레이어 매핑 추가 |

### 지도 렌더링

- Polygon → 반투명 fill + outline, LineString → line, Point-only(폴리곤 없는 경우, 예: GPS RAIM) → 아이콘 마커
- 카테고리별 고정 색상 대신 위 심각도 3단계(red/amber/gray) 색만 사용
- 클릭 시 팝업: 원문 텍스트 + 유효기간(SIGMET 팝업 패턴 재사용)
- `scope: 'fir'` 레코드는 폴리곤 렌더 대상에서 제외(위 FIR 광역 스코프 참조) — 342건을 다 그리면 화면이 뒤덮임
- 줌 레벨 전환: 낮은 줌(전국)에서는 카테고리 아이콘 마커만, 확대(줌 9+)하면 실제 폴리곤/라인 노출. Mapbox 레이어 정의에 `minzoom`/`maxzoom`만 추가(플랜 단계에서 스파이크로 검증 — 이 코드베이스에 동일 소스 내 마커↔폴리곤 이중 레이어 줌 전환 선례는 없음).

### 레이어 가시성 모델 (리뷰로 발견된 수정 사항)

당초 "7개 카테고리 각각 개별 토글"로 설계했으나, `hazardLayers.js`(브리핑 "지도에 관련 레이어 보기" 칩)가 토글 가능한 대상은 `frontend/src/features/weather-overlays/lib/weatherOverlayLayers.js`의 `MET_LAYERS` 배열에 등록된 id뿐이고(`hazardLayers.test.js`가 강제), `MET_LAYERS`는 레이어당 on/off **하나**만 표현한다(`metVisibility.<id>`). 7개를 각각 별도 레이어로 등록하면 이 구조와 안 맞는다.

**수정된 모델**: NOTAM을 `MET_LAYERS`에 `{ id: 'notam', label: 'NOTAM', color: ... }` **마스터 토글 하나**로 등록(레이더/SIGMET과 동일 패턴). `NotamPanel`의 7개 카테고리 타일은 별도의 로컬 카테고리 필터 상태(어떤 카테고리를 보여줄지)로, `notamLayers.js`의 Mapbox `filter` 표현식에 적용 — 마스터가 꺼지면 전부 안 보이고, 마스터가 켜진 상태에서 타일로 세부 필터링. 이러면 브리핑 칩("NOTAM 레이어 보기")도 다른 위험기상 레이어와 동일하게 자연스럽게 작동한다. 카테고리 필터 상태를 어느 파일에 둘지(로컬 훅 vs `App.jsx` 리프트업)는 구현 계획 단계에서 확정.

## Route-Briefing Integration

`backend/src/briefing/hazard-section.js`의 `matchItems(items, source, ctx)`는 이미 범용이다 — `{geometry, valid_from, valid_to, altitude, phenomenon_code, phenomenon_label}` shape만 맞으면 SIGMET/AIRMET 전용이 아니어도 경로∩시간∩고도 매칭을 그대로 해준다. NOTAM 레코드가 이 shape에 거의 맞으므로 새 매칭 로직을 짜지 않고 기존 파이프라인에 태운다.

**연동 지점 4곳** (주의: `matchItems`는 이미 범용이라 재사용하지만, `hazardLevel()`은 소스별로 하드코딩된 분기라 NOTAM 분기 추가가 **필수** — "매칭 로직 재사용, 새 코드 없음"이 아니라 "매칭은 재사용, 레벨 판정 분기 1개는 신규"):

1. `backend/src/briefing/hazard-section.js` — `buildHazardSection`에 `notam` 파라미터 추가, `matchItems(notam, 'NOTAM', ctx)` 호출 추가. `hazardLevel()`에 `source === 'NOTAM'`이면 레코드의 `severity`(red/amber)를 그대로 사용하는 분기 추가(안 넣으면 SIGMET도 AIRMET도 아닌 소스는 현재 코드상 amber 고정 분기로 조용히 떨어짐 — red NOTAM이 amber로 격하되는 버그가 됨).
2. `backend/src/briefing/briefing-composer.js` — `buildHazardSection` 호출에 `notam: data?.notam?.items?.filter(n => n.severity !== 'gray') ?? []` 추가(회색=운영정보는 브리핑 위험요약 노이즈라 제외).
3. `backend/server.js` — `POST /api/route-briefing` 핸들러가 `store.getCached('notam')`도 읽어 `data.notam`으로 전달.
4. `frontend/src/features/route-briefing/lib/hazardLayers.js` — RULEBOOK에 `{ codes: ['notam-prohibited', 'notam-danger', 'notam-restricted', 'notam-obstacle'], layers: ['notam'] }` 추가. `notam`이 유효한 대상이 되려면 위 "레이어 가시성 모델"대로 `weatherOverlayLayers.js`의 `MET_LAYERS`에 `notam` id를 먼저 등록해야 함(`layerActions.js`가 아니라 `MET_LAYERS`+`hazardLayers.test.js`가 실제 강제 지점 — 최초 스펙의 오기 수정).

**공짜로 딸려오는 것(새 코드 불필요):**
- Go/No-go 배너(`BriefingBanner.jsx`)가 `adverse.level`을 그대로 쓰므로, 경로상 비행금지구역 조우 시 자동으로 빨강
- ③노선 위험 리스트(`BriefingView.jsx`)에 SIGMET/AIRMET/공항경보와 같은 카드로 NOTAM도 자연 노출(`source` 필드로 라벨만 다름)
- "지도에 관련 레이어 보기" 칩이 노선상 NOTAM 있으면 자동으로 NOTAM 레이어 토글 노출

**알려진 한계 (정직하게 기록, 이번 스코프 제외):**
- **고도 밴드 파싱**: Q-line `/000/999/`(FL밴드)와 원문 `F)/G)`필드(명시적 ft AMSL, 있을 때만)가 둘 다 존재 — 우선순위 로직 필요(F)/G) 있으면 그것 우선, 없으면 Q-line 밴드로 폴백). SIGMET/AIRMET보다 파서 작업이 더 든다.
- **LineString형 NOTAM(26건, 회랑형 임시제한구역) 매칭 불가**: `geo-time-match.js`의 `pointInPolygon`은 Polygon/MultiPolygon만 처리, 선 지오메트리는 경로 교차 판정이 안 됨. 원문에 폭 정보("1NM EITHER SIDE OF LINE")가 있으면 파서에서 얇은 폴리곤으로 버퍼링해 우회 가능하지만 별도 작업 — 이번 스코프에서는 LineString NOTAM을 지도/탭에는 노출하되 브리핑 자동매칭 대상에서는 제외한다.

## Error Handling

- 크롤링 실패(접속 불가/셀렉터 변경/타임아웃): 이전 `latest.json` 유지, 크론 로그만 기록, 다음 주기 재시도. `mergeWithPrevious`(공항별 stale 병합) 미사용 — NOTAM은 전체 스냅샷 단위라 부분 병합 불필요.
- KML 파싱 실패: Placemark 단위 try/catch, 깨진 항목 스킵 + 개수 로그.
- 미매핑 Q-code: 자동 "기타" 카테고리 폴백 + 로그(표 보강용).
- 프론트: `/api/notam` 실패/빈 응답 시 기존 빈 상태 UI(`ap-empty`) 재사용, 지도는 조용히 미표시(throw 없음).

## Testing

- 백엔드: 파서/프로세서 단위 테스트(실제 KML fixture 사용), `hazard-section.test.js`에 NOTAM 매칭 케이스(경로 교차/시간 겹침/고도 밴드) 추가
- 프론트: GeoJSON 변환 단위 테스트, `deriveTimeState` 단위 테스트
- 브라우저 스모크: 사이드바 NOTAM 패널 카테고리 토글→지도 반영(줌 전환 포함), 공항 선택→NotamTab 필터+전역 공지 섹션 확인, 경로 브리핑 생성→NOTAM이 노선 위험 리스트/배너에 반영되는지 확인

## Open Decisions Resolved During Brainstorming

- 크롤 소스: KML만 (xls 불필요, KML에 좌표+원문 다 포함)
- 보관: 최신본만 (store.js 기존 패턴)
- 주기: 1일 1회(테스트 단계 기준값, 추후 조정 가능)
- 지도 분류: 소수 핵심 카테고리 + 기타(추측 아닌 FAA/ICAO 공식 표 기준으로 확정)
- 공항 매칭: A)필드 정확 일치(단, `scope: 'fir'`는 예외적으로 전체 공항에 노출 — 위 FIR 광역 스코프 참조)
- 크롤 방식: 헤드리스 Playwright, 기존 백엔드 스케줄러(`backend/src/index.js`)에 통합(A안) — 별도 프로세스 분리(B안)는 주기가 촘촘해지면 재검토
- 심각도 표시: 카테고리 7개가 아니라 red/amber/gray 3단계로 압축(디자인 헌법 색 절제 원칙 + EFB 업계 리서치로 검증)
- UI 좌측 색 보더 카드 패턴 배제 — 무채색 카드 + 색 배지 조합으로(범용 AI 대시보드 톤 회피)
- 브리핑 연동: 기존 `hazard-section.js`의 범용 `matchItems`에 태우는 방식으로 결정, 매칭 로직 재사용(단 `hazardLevel()` NOTAM 분기는 신규)
- 지도 가시성 모델: 카테고리별 개별 레이어가 아니라 `MET_LAYERS` 마스터 토글 1개 + 카테고리 필터로 수정(리뷰로 발견 — 최초 설계는 `hazardLayers.js`/브리핑 칩과 안 맞았음)
- 플랜 단계 분할 권장: 스펙은 하나로 유지, `writing-plans`에서 (a) 크롤러+파서+프로세서+store+API, (b) 프론트 UI(전역패널+공항탭+지도), (c) 브리핑 연동(― (a)에 의존) 3단계로 나눠서 계획

## Unresolved Risk

- AWS 프로덕션 EC2에서 Playwright/Chromium 크롤링 동작 여부 미검증(사내망 클라우드 접속 차단으로 이번 세션에서 확인 못함). **구현 완료 후 배포 전 반드시 SSH로 실사 검증 필요.**
