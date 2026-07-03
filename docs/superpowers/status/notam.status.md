# NOTAM Integration Status

Updated: 2026-07-03 16:30 KST
Spec: docs/superpowers/specs/2026-07-03-notam-integration-design.md
Plan (Phase A): docs/superpowers/plans/2026-07-03-notam-phase-a-backend.md
Mockup: docs/superpowers/specs/refs/2026-07-03-notam-ui-mockup.html
Branch: **feat/notam-backend** (do NOT work on main)

## What this feature is (one-paragraph context)

대한민국 유효 NOTAM(항공고시보)을 백엔드가 주기적으로 크롤링(KOCA `aim.koca.go.kr` KML 다운로드) →
파싱 → 카테고리 분류 → `GET /api/notam`으로 서빙하고, 프론트에서 (A) 사이드바 전역 NOTAM 패널,
(B) 공항 패널 NOTAM 탭, 지도 레이어로 표시하고, (C) 비행 전 브리핑에 경로상 NOTAM을 연동한다.
3 Phase로 분할: **A=백엔드 파이프라인(현재 진행 중)**, B=프론트 UI, C=브리핑 연동. A만으로도 동작하는 API가 나온다.

## 핵심 결정(맥락 — 새 세션이 반드시 알아야 할 것)

- **색 = 시간 상태(발효중 red / 곧발효 amber / 예정 gray), 카테고리 무관 균일.** 우리는 위험도(심각도)를
  판단하지 않는다(안전/책임). 색은 B)/C) 필드에서 나온 객관적 사실. 카테고리는 아이콘+라벨로만 구분.
- **단, Go/No-go에 영향주는 NOTAM(공역 제한 계열 RP/RR/RT/RA/RD/WM이 발효중+경로통과=경로 저촉)은
  브리핑 배너에 사실 반영**(binary 플래그, 등급 아님). 이건 Phase C.
- **크롤 창 = 사이트 강제 24h**(7일 창 시도 실패 — validateAndSearch가 to-date를 from+1day로 clamp함을
  실측 확인). 대신 **6시간 주기 크롤**로 전방 가시성 ≥18h 확보. 크롤러는 날짜 조작 없이 기본 다운로드만.
- **고도 표시는 AGL/AMSL 기준면 보존 필수**(안전 — 500FT AGL≠AMSL). 파서가 F)/G)에서 ref 분리 저장.
- **FIR 스코프**: A)RKRR = 인천 FIR(전역). scope='fir'는 모든 공항 탭에 "전역 공지"로 노출, 지도 폴리곤은 제외.
- **파서는 실제 KOCA KML fixture로 검증**(`backend/test/fixtures/notam-sample.kml`, 실제 4건).
  실측으로 발견한 버그: KML MultiGeometry가 항상 Point(라벨 앵커)+Polygon이라 **지오메트리 추출은
  Polygon→LineString→Point 순서**여야 함(Point-first면 모든 폴리곤이 점으로 렌더됨).

## Resume Point

- Last completed: **Task 5** (store+config 등록), commit `feat(notam): register notam type in store + config (24h horizon, 6h cron)`.
- **Next: Task 6** (plan 파일의 "### Task 6: Wire cron + API route") — 다음 3가지:
  1. `backend/server.js` 518줄 부근(`app.get('/api/takeoff-fcst', ...)` 바로 아래)에
     `app.get('/api/notam', (_, res) => sendLatest(res, 'notam'))` 추가.
  2. `backend/src/index.js`: (a) 21줄 뒤 `import notamProcessor from './processors/notam-processor.js'`,
     (b) `locks` 객체(25줄)에 `notam: false`, (c) `buildInitialCollectionJobs` jobs 배열의 takeoff_fcst
     엔트리(87줄) 뒤에 `["notam", notamProcessor.process],`, (d) `main()`의 118줄 뒤에
     `cron.schedule(config.schedule.notam_interval, () => runWithLock("notam", notamProcessor.process))`.
  3. 라이브 검증: `npm.cmd run dev --prefix backend` 실행 → 시작 로그에 `notam: { type:'notam', saved:true, items:~400 }`
     확인, `curl http://127.0.0.1:3001/api/notam | head -c 300` 로 JSON 확인. 그다음 `cd backend && node --test`
     전체 통과 확인 후 커밋.
- **그다음 Task 7**: Architecture.md에 notam 백엔드 파일 role 추가(plan에 정확한 문구 있음) → 커밋.
- **그다음**: superpowers:finishing-a-development-branch 로 마무리(테스트 확인 → 머지/PR 옵션 제시).

## Verified

- `cd backend && node --test` → **205 pass / 0 fail** (Task 5 완료 시점, notam-crawler/parser/processor/store 포함).
- 크롤러 로직(goto + click KML다운로드)은 세션 중 스파이크로 라이브 다운로드 성공 검증(로컬 Windows).
- 파서: 실제 fixture 4건(QGAXX Point+Polygon, QRDCA danger Poly FIR, QOBCE obstacle, QRDCA LineString)에
  대해 5 test 통과 — 지오메트리/AGL/카테고리/스코프 정확.

## Unverified / Deploy Gate (배포 전 반드시)

- **AWS EC2(3.34.113.37, Amazon Linux)에서 Playwright/Chromium 크롤 동작 미검증**(사내망 클라우드 차단으로 이번 세션 확인 불가).
  plan 파일 맨 아래 "Deploy Gate" 체크리스트 참조: `npx playwright install chromium --with-deps`(Amazon Linux는 dnf/yum),
  아웃바운드 443, AWS IP 차단 여부. 새 playwright 의존성이라 `deploy-vm-full.sh` 필요(fast deploy 아님).
- Task 6의 라이브 크롤 검증은 아직 안 함(새 세션 Task 6에서 수행) — `config.notam.timeout_ms`가 실제로 잘 먹는지 포함.

## Deviations from Plan

- **7일 창 → 24h+6h로 변경**(실측 발견). plan/spec/mockup 전부 동기화 완료. 크롤러에서 날짜 필드 조작 제거(더 단순).
- **categorize 폴백 수정**: 당초 plan은 "unlisted→facility"였으나 spec 정합 위해 facility-family 코드를 명시 매핑,
  미매핑→'other'로 변경(실측 414건 subject는 전부 매핑됨, 'other'는 희귀). plan 문서도 수정 반영.
- Task 5 config를 Task 4보다 먼저 부분 적용(processor가 config.notam.fir_codes를 모듈 로드 시 읽어서 — 잠재 순서 의존성).

## 이 브랜치의 무관한 미커밋 변경(주의 — NOTAM 아님)

세션 초반 사용자 요청으로 만든 두 변경이 아직 커밋 안 됨(working tree에 있음, feat/notam-backend 위):
- `frontend/src/features/aviation-layers/AviationLayerPanel.jsx` — 카테고리 순서 항공로→항행시설→공역으로 재배열
- `frontend/src/features/map/MapView.jsx` — 레이더 기본 ON(`visibility.radar = true`)
→ 이건 NOTAM과 무관. 새 세션에서 별도 커밋하거나 별도 브랜치로 옮길지 사용자에게 확인. NOTAM 커밋에 섞지 말 것.

## Phase B / C (아직 계획 미작성)

- Phase A(`/api/notam`) 완료 후 작성 예정. B=프론트 UI(전역패널·공항탭·지도레이어·시간상태 색/형태·감사반영 접근성),
  C=브리핑 연동(matchItems 매칭코어·routeConflicts·배너). A의 item shape 계약은 plan "Global Constraints"에 고정됨.
