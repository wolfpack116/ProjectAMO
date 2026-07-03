# NOTAM Integration Design

## Purpose

대한민국 유효 항공고시보(NOTAM)를 백엔드에서 주기적으로 수집해, (1) 공항 패널의 NOTAM 탭에서 공항별로, (2) 지도 위에 카테고리별 레이어로 표시한다.

## Scope

- 백엔드: KML 크롤러 → 파서 → 프로세서 → store → API
- 프론트엔드: 사이드바 전역 NOTAM 패널(카테고리 토글 + 지도 레이어), 공항 패널 NOTAM 탭(공항별 목록)

## Anti-Scope

- NOTAM 이력 저장/DB화(최신본만 유지)
- xls 소스 크롤링(KML만 사용)
- 반경 기반 공항 매칭(A필드 정확 일치만)
- AWS 프로덕션 배포 실증(별도 미해결 리스크로 기록, 이번 스코프 아님)
- SNOWTAM 등 특수 시리즈에 대한 별도 UX(전부 같은 파이프라인으로 수집·분류만 함)

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

### 백엔드 파일

| 파일 | 역할 |
|---|---|
| `backend/src/notam/notam-crawler.js` | Playwright 크롤러(사이트 접속→다운로드 클릭→버퍼 수신) |
| `backend/src/parsers/notam-parser.js` | KML → 구조화 레코드 배열 |
| `backend/src/processors/notam-processor.js` | Q-code→카테고리 매핑, 공항별 그룹 인덱스 |
| `backend/src/index.js` | cron 등록(1일 1회, 기존 per-type lock 패턴) |
| `backend/src/store.js` | `TYPES`에 `'notam'` 추가(최신본만) |
| `backend/server.js` | `GET /api/notam` 라우트 추가 |
| `backend/test/notam-parser.test.js` | 실제 KML 샘플 fixture 기반 파싱 테스트 |
| `backend/test/notam-processor.test.js` | Q-code→카테고리 매핑 표 커버리지(확인된 코드 전부 + 미지 코드 폴백) |

### 프론트엔드 파일

| 파일 | 역할 |
|---|---|
| `frontend/src/api/weatherApi.js` | `fetchNotam()` 클라이언트 추가 |
| `frontend/src/app/layout/Sidebar.jsx` | NOTAM 아이콘 복귀, `PANEL_MAP`에 `notam` 등록 |
| `frontend/src/app/layout/MobileMoreMenu.jsx` | 모바일도 동일하게 복귀 |
| `frontend/src/features/notam/NotamPanel.jsx` | (A) 전역 패널: 카테고리 토글 + 유효 NOTAM 리스트 |
| `frontend/src/features/notam/lib/notamLayers.js` | Mapbox 소스/레이어 설치·동기화·카테고리 가시성(`NOTAM_SOURCE_IDS`/`NOTAM_LAYER_IDS` 소유권 export) |
| `frontend/src/features/notam/lib/notamGeoJson.js` | 백엔드 페이로드 → 카테고리별 GeoJSON FeatureCollection 변환 |
| `frontend/src/features/notam/lib/notamLayers.test.js` | GeoJSON 변환/카테고리 분리 테스트 |
| `frontend/src/features/airport-panel/tabs/NotamTab.jsx` | (B) 공항별 NOTAM 목록 |
| `frontend/src/features/airport-panel/lib/notamViewModel.js` | 공항 탭 표시용 가공(배지/유효기간 포맷) |
| `frontend/src/features/airport-panel/AirportPanel.jsx` | 탭 목록에 NOTAM 추가 |
| `frontend/src/features/map/MapView.jsx` | `activePanel === 'notam'` 조건부 렌더 + `useStyleSyncedEffect(mapRef, isStyleReady, styleRevision, (map) => syncNotamLayers(map, notamModel), [notamModel])` 한 줄(ADR 0001 seam 재사용, 새 `useEffect` 추가 금지) |

### 지도 렌더링

- Polygon → 반투명 fill + outline, LineString → line, Point-only(폴리곤 없는 경우, 예: GPS RAIM) → 아이콘 마커
- 카테고리별 고정 색상(디자인 헌법 토큰 범위 내에서 구현 시 확정)
- 클릭 시 팝업: 원문 텍스트 + 유효기간(SIGMET 팝업 패턴 재사용)

## Error Handling

- 크롤링 실패(접속 불가/셀렉터 변경/타임아웃): 이전 `latest.json` 유지, 크론 로그만 기록, 다음 주기 재시도. `mergeWithPrevious`(공항별 stale 병합) 미사용 — NOTAM은 전체 스냅샷 단위라 부분 병합 불필요.
- KML 파싱 실패: Placemark 단위 try/catch, 깨진 항목 스킵 + 개수 로그.
- 미매핑 Q-code: 자동 "기타" 카테고리 폴백 + 로그(표 보강용).
- 프론트: `/api/notam` 실패/빈 응답 시 기존 빈 상태 UI(`ap-empty`) 재사용, 지도는 조용히 미표시(throw 없음).

## Testing

- 백엔드: 파서/프로세서 단위 테스트(실제 KML fixture 사용)
- 프론트: GeoJSON 변환 단위 테스트
- 브라우저 스모크: 사이드바 NOTAM 패널 카테고리 토글→지도 반영, 공항 선택→NotamTab 필터 확인

## Open Decisions Resolved During Brainstorming

- 크롤 소스: KML만 (xls 불필요, KML에 좌표+원문 다 포함)
- 보관: 최신본만 (store.js 기존 패턴)
- 주기: 1일 1회(테스트 단계 기준값, 추후 조정 가능)
- 지도 분류: 소수 핵심 카테고리 + 기타(추측 아닌 FAA/ICAO 공식 표 기준으로 확정)
- 공항 매칭: A)필드 정확 일치
- 크롤 방식: 헤드리스 Playwright, 기존 백엔드 스케줄러(`backend/src/index.js`)에 통합(A안) — 별도 프로세스 분리(B안)는 주기가 촘촘해지면 재검토

## Unresolved Risk

- AWS 프로덕션 EC2에서 Playwright/Chromium 크롤링 동작 여부 미검증(사내망 클라우드 접속 차단으로 이번 세션에서 확인 못함). **구현 완료 후 배포 전 반드시 SSH로 실사 검증 필요.**
