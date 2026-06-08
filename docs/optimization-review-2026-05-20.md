# ProjectAMO 네트워크 요청량·횟수 절감 검토 요청 (프로젝트 전체)

> 작성일: 2026-05-20. 코덱스/리뷰어가 맥락 없이 검토할 수 있도록 자체 완결형으로 정리한 문서.

## 배경 / 운영 구조
- Vite+React 프론트 / Node+Express 백엔드 항공 기상 대시보드. 저사양 GCP free-tier VM 가정.
- 프로덕션: **nginx(:80/443) + PM2**. nginx가 `frontend/dist` SPA와 `/data/*`를 직접 서빙하고, `/api/*`는 Express(127.0.0.1:3001)로 reverse proxy. (`docs/aws-ec2-manual-deploy.md`, `deploy/nginx/projectamo.conf.example`)
- 첫 진입: `loadWeatherData()`가 19개 엔드포인트 병렬 요청(`frontend/src/api/weatherApi.js:91`) → 이후 60초 주기 `/api/snapshot-meta` 폴링 + 해시 비교로 변경분만 재요청.
- 제약: KIM 과학식·UI 레이어 의미·라우트 단면 스코프 변경 금지, 로컬 개발 후방호환 유지.

## 이미 적용되어 있어 손대지 말 것 (확인용)
- 정적 프론트 자산/navdata/geojson/Symbols/JS·CSS 번들 → nginx `public, max-age=31536000, immutable` (`deploy/nginx/projectamo.conf.example:40-43`). 프론트도 navdata/procedure를 메모리 캐시(`frontend/src/features/route-briefing/lib/routePlanner.js:5`, `frontend/src/features/route-briefing/lib/procedureData.js:22`).
- radar/satellite/SIGWX PNG 프레임 → `immutable 3h`, meta JSON → `no-cache`.
- KIM field 라우트 → `immutable` + ETag + gzip (`backend/server.js:126`).
- `/api/snapshot-meta` → 서버 5초 메모이제이션 + `no-cache` (`backend/server.js:257`).
- gzip: nginx(`gzip on`, json 포함) + Express `compression()` 둘 다 적용.
- ADS-B·KIM 폴링은 레이어 visible일 때만 동작(`frontend/src/features/map/MapView.jsx:492`).

→ 따라서 추가 절감은 아래 6개로 좁혀짐. 각 항목의 타당성/부작용/우선순위 의견을 부탁함.

---

## A. 정적 설정 `/api` 엔드포인트가 `no-store`로 매번 재전송
- `backend/server.js:89-94` `/api` 미들웨어가 KIM field 외 전부 `no-store`.
- 사실상 불변(부팅 시 import 상수)인데도 매 진입·새로고침마다 재다운로드:
  - `/api/airports` → `config.airports` (`backend/server.js:583`)
  - `/api/warning-types` (`backend/server.js:584`)
  - `/api/alert-defaults` (`backend/server.js:585`)
- **제안**: 이 3개를 allowlist로 분리해 `public, max-age` 또는 ETag 적용.
- **위험**: 매우 낮음. 운영 중 설정 변경 시 max-age 동안 stale → 길이 합의 또는 ETag만 사용.

## B. `/api/snapshot-meta` 중복 폴링 (프론트)
- 메인 폴러 1개(`frontend/src/app/useWeatherPolling.js:35`) + KIM 훅 4개가 동일 엔드포인트를 각자 60초 폴링(`frontend/src/features/weather-overlays/lib/useKimSurfaceWind.js:238`, useKimTemperature/CloudPotential/Icing 각 152행 부근). 오버레이 다 켜면 동일 응답 분당 최대 5회.
- 계획서(`docs/superpowers/plans/2026-05-20-kim-nwp-server-ops-optimization.md`) Task 6의 공유 폴러 `useKimSnapshotMeta`가 **미구현**.
- **제안**: 모듈 레벨 단일 폴러로 통합, 4개 훅이 구독. 가능하면 메인 폴러와도 단일화.
- **위험**: 중간(훅 4개 수정). 훅별 해시 키(uv/T/cloud/icing)가 달라 공유 객체에서 올바른 해시 선택 유지가 핵심. 회귀 테스트 필요.

## C. 첫 진입 19개 병렬 요청 중 비핵심 지연 로딩
- `frontend/src/api/weatherApi.js:91-117`가 진입 즉시 19개 전부 요청. 첫 화면 비필수 후보: `ground-overview`, `environment`, `airport-info`, `sigwx-low-history`.
- **제안**: 첫 화면 필수 vs 패널/탭 진입 시 로드로 분리.
- **위험**: 낮음~중간. 무엇이 첫 화면 필수인지 **UX 확인 필요**.

## D. 가변 weather `/api`에 ETag/304 없음
- METAR/TAF/SIGMET 등 `no-store`라 F5·새 탭은 미변경에도 전체 페이로드 재다운로드. 폴링은 snapshot-meta 해시로 막지만 전체 리로드는 못 막음.
- **제안**: `no-cache`+ETag로 전환, 미변경 시 304. KIM의 `sendImmutableJson` 패턴 재활용(단 max-age=0/revalidate, immutable 금지).
- **위험**: 중간. ETag seed는 기존 `content_hash` 기반이어야 하고 폴링 해시 로직과 충돌 없는지 확인.

## E. 외부 vworld WFS 항공공역 — 캐시/프록시 부재 (프로젝트 전체 신규)
- 항공공역 레이어(FIR/TMA/CTR/제한·금지·위험구역/항로)는 `/vworld-wfs?...`로 외부 vworld WFS 직접 호출(`frontend/src/features/aviation-layers/aviationWfsLayers.js:271`).
- 그러나 이 프록시는 **vite 개발용**(`frontend/vite.config.js:27`)뿐이고, **프로덕션 nginx 설정에 `/vworld-wfs` location이 없음**(`deploy/nginx/projectamo.conf.example`) → 프로덕션 동작/캐시 양면에서 검증 필요(요청이 SPA fallback으로 빠질 가능성).
- 캐시 관점: 공역 폴리곤은 사실상 불변인데 레이어 토글·리로드마다 외부 재호출 → 외부 의존성·egress·지연 증가.
- **제안**: (1) 백엔드/nginx에 WFS 프록시 + 응답 캐시(장기 TTL) 추가, 또는 (2) 공역 GeoJSON을 빌드 타임에 정적 자산으로 프리페치해 nginx immutable 캐시로 서빙.
- **위험**: 낮음~중간. 정적 프리페치 시 갱신 주기(AIRAC 사이클 등) 운영 합의 필요.

## F. 초기 번들 코드 스플리팅 (첫 로드 한정)
- 번들 자체는 nginx immutable 캐시라 **재방문엔 영향 없음**. 첫 방문 JS 다운로드만 절감.
- monitoring 페이지·vertical profile·route briefing 등을 `React.lazy`/동적 import로 분리.
- **위험**: 낮음. lazy 경계 로딩 폴백 UX만 확인.

---

## 우선순위(제안)
1. **A** (정적 API 캐시) — 위험 최소·즉효
2. **B** (snapshot-meta 공유 폴러) — 폴링 요청 대폭 감소, 설계 이미 존재
3. **E** (WFS 캐시/프록시) — 외부 의존성·egress 절감 + 프로덕션 동작 검증 겸함
4. **D** (ETag/304) — 새로고침/새 탭 egress 절감
5. **C, F** — UX 확인·번들 분석 선행

**코덱스에게**: 위 6개의 기술적 타당성, 누락 위험(특히 B·D의 stale/해시 정합성, E의 프로덕션 동작 여부), 우선순위 조정 의견 부탁함.

---

# KIM NWP 고유 최적화 (수집→저장→서빙 경로)

> 위 A~F와 별개로, KIM NWP 데이터 경로에 한정한 추가 절감안. 이미 적용된 것(gzip, field `immutable`+ETag, 증분 수집, `KEEP_RAW=0`, run 보존 제한, snapshot-meta 5초 메모)은 제외하고, **"이미 계산한 데이터를 매 요청마다 다시 계산"**하는 지점에 집중함.

## K1. 파생 필드를 매 요청마다 재계산 — 서버 캐시 없음 (최우선)
- cloud/icing/temp/wind field 라우트는 요청마다 (1) grid.json 디스크 읽기 → (2) int16 디코딩 → (3) 전체 격자 재계산(cloud=노점온도, icing=셀마다 K-FIP 점수) → (4) JSON 직렬화 → (5) sha256 ETag 생성을 모두 수행 (`backend/server.js:424`, `backend/src/processors/kim-nwp-model.js:374`).
- 그러나 `(tmfc, hf, level)`이 같으면 결과는 항상 동일(immutable). 슬라이더 왕복·다중 사용자·동일 시각/고도 조회 시 동일 계산을 반복. 1GB VM에서 격자당 수만 셀 K-FIP 계산은 부담.
- **제안**: `product:tmfc:hf:level` 키 LRU 캐시에 계산 결과(또는 직렬화 JSON + ETag) 저장. tmfc가 키에 포함되어 새 run 발행 시 자연 무효화 → 반복 요청의 디스크 읽기·디코딩·재계산 제거.
- **위험**: 낮음. 메모리 상한(LRU 크기) 설정 필요. immutable 전제이므로 stale 위험 없음(키가 tmfc로 분리됨).

## K2. 304(변경 없음) 응답조차 전체를 재계산함
- 라우트가 `field = readSelected...Field(selection)`로 **전체 계산을 끝낸 뒤** ETag를 만들고 그 다음에 `If-None-Match`를 비교해 304를 반환 (`backend/server.js:547-555`, `backend/server.js:131`). → 본문 없는 304조차 서버 CPU를 풀로 소모.
- **제안**: grid 계산 전에 ETag 결정. index가 이미 변수별 content hash를 보관하므로(`backend/src/processors/kim-nwp-model.js:552`) 그 해시로 ETag를 선계산해 304면 grid를 아예 읽지 않도록 함. (K1 캐시 도입 시 자동 해결.)
- **위험**: 낮음~중간. ETag seed가 product·tmfc·hf·level·변수해시를 모두 반영해 product 간 충돌이 없도록 보장 필요.

## K3. 다중 오버레이 동시 사용 시 같은 grid를 4번 따로 요청
- 같은 시각·고도에서 wind/temp/cloud/icing을 모두 켜면 클라이언트가 4개 field 요청을 보내고, 서버는 같은 grid.json을 4번 읽어 각각 다른 파생값을 계산 (`backend/server.js:454/507/531/555`).
- **제안**: 선택한 `(tmfc,hf,level)`에 대해 활성 product를 한 번에 주는 통합 엔드포인트(예: `/api/kim/field?products=wind,temp,cloud,icing`). 요청 수 4→1, grid 디스크 읽기 4→1.
- **위험**: 중간. 프론트 4개 훅(useKimSurfaceWind/Temperature/CloudPotential/Icing) 수정 및 부분 실패(product 일부만 가용) 처리 필요.

## KIM 우선순위(제안)
1. **K1 + K2** (파생 필드 LRU 캐시 + ETag 선계산) — 과학식·UI 변경 없이 "이미 계산한 결과 재사용", 저사양 VM 체감 큼, 위험 낮음
2. **K3** (통합 field 엔드포인트) — 요청 수·디스크 읽기 절감, 프론트 훅 수정 동반

**코덱스에게**: K1 LRU 캐시 키/무효화 설계의 타당성, K2 ETag 선계산이 4개 product 간 충돌 없이 가능한지, K3 통합 엔드포인트의 부분 실패·계약 변경 위험을 검토 부탁함.
