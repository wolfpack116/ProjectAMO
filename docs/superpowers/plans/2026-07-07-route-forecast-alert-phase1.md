# 경로 예보변화 알림(#13) — Phase 1 구현계획

> **작업자용:** 스펙 = [2026-07-07-route-forecast-alert-design.md](../specs/2026-07-07-route-forecast-alert-design.md). 태스크는 체크박스로 추적. superpowers:executing-plans 또는 subagent-driven-development로 태스크 단위 실행.

## 진행 현황 (2026-07-07)
- ✅ **Task 1·2·3 완료·푸시** (`26a2bb6`·`c32f072`·`9dea79c`): DB 스키마, 단일 미니마 API + 스냅샷 cruiseSpeedKt, 알림 등록 API(pickActiveFlight 유닛 4/4).
- ▶ **다음 = Task 4·5** (스케줄러 + diff 엔진 — 핵심 두뇌). 착수 전 `flight-category.js`·`taf-window.js`·`hazard-section.js`·`enroute-model.js` 리턴 구조 정독 필요.
- ⚠️ **테스트 실행 주의:** bcrypt(cost 12)·서버 통합 테스트는 이 환경에서 느려 실행 보류 중 — 파일만 작성하고 CI/수동에 맡김. **순수 함수 유닛 테스트는 즉시 실행 OK.**

**목표(Phase 1, 시연):** 서버가 저장된 비행을 감시 → 예보가 v1 7종 기준 나빠지면 **인앱 알림센터 + 텔레그램**으로 알림 + 탭하면 그 비행 브리핑으로 딥링크. **서비스워커 없이 end-to-end 시연.** (Web Push=Phase 2, 카카오·이메일=v2.)

## 실행 지침 (TDD 최소 — 필독)
태스크마다 test-first 강제 안 함. 아래만:
- **두뇌(Task 5 diff 엔진 · Task 4 스케줄러)만 test-first 스모크 1개씩.** node:test, `backend/test/auth.test.js`의 `makeServer()`+`fetch(at(server,path))` 패턴 재사용(supertest 아님).
- 나머지 백엔드: 구현 후 `npm --prefix backend test` 한 번 통과면 OK.
- 프론트: 파일마다 `npx esbuild ... --bundle=false` 빌드 스모크 + **마지막에 Playwright로 한 번** 수동 확인(`docs/dev-server-and-capture.md` 절차). Preview MCP 금지.
- 판정 로직은 **기존 모듈 호출**(신규는 diff+severity+dedup·스케줄·발송만).

## 리뷰 반영(2026-07-07, 정정된 전제)
- 경로 저장은 **이미 서버 우선**(routeStore) — 승격 배선 불필요.
- `tasKt`·거리는 스냅샷에 **없음** → Task 2에서 tasKt 저장 추가, **ETA는 클라 `etaCalc.js` 계산값 전송**(서버 재계산 안 함).
- 미니마 단일값은 **`users` 컬럼**에 저장(per-airport `presets` 안 씀).
- `alert-state.js`는 프론트 코드 → 서버 스케줄러가 import 불가, **알고리즘만 참고**.

---

## Task 1: DB 스키마 + 마이그레이션
- [ ] `schema.sql`: `routes`에 알림 컬럼(`alert_enabled`,`alert_start_min_before_etd` 기본120,`altitude_filter_ft` 기본4000,`send_no_change_confirm`,`confirm_min_before_etd` 기본60,`eta`,`last_briefing_snapshot_id`,`expires_at`). `users`에 `min_ceiling_ft`,`min_visibility_m`. 신규 테이블 `triggered_alerts`(스펙 §6), `push_subscriptions`(Phase 2용, 빈 채로).
- [ ] `db/index.js` `ensureColumns`: 없는 컬럼만 `ALTER TABLE ADD COLUMN`(기존 행 안전, 기본값 처리). 신규 테이블 `CREATE TABLE IF NOT EXISTS`.
- [ ] 스모크: `backend/test/db.test.js`에 컬럼·테이블 존재 1개. Run `node --test backend/test/db.test.js`.
- [ ] Commit.

## Task 2: tasKt 스냅샷 저장 + 단일 미니마 API
- [x] 프론트: `RouteBriefingPanel.jsx:329` `saveRoute(..., { ..., cruiseSpeedKt })` — 스냅샷에 속도 추가. (ETA는 이미 `computeEtaIso`로 클라 계산 중)
- [x] 백엔드: `createMeRouter`(presets.js)에 `GET/PUT /api/me/minima` — `users.min_ceiling_ft/min_visibility_m`, zod 검증, userId만.
- [x] 스모크: `me-presets.test.js`에 minima 왕복 1개.
- ⚠️ **정정: 기존 `SettingsModal` "공항 미니마" 탭은 건드리지 않는다** — per-airport `airport_minima_settings`는 monitoring(MonitoringPage·MetarCard·TafTimeline)이 소비하는 load-bearing 표시값. #13 **단일 미니마 입력 UI는 새 개인설정 패널 [기상 미니마] 탭(Task 9)**에 넣는다.
- [ ] Commit.

## Task 3: 알림 등록 API (예정 비행)
- [ ] `me/routes.js` 확장 or `me/alerts.js` 신규: 템플릿 클론 → 예정 비행 생성(입력 `templateRouteId?` or 스냅샷 + `etd`,`eta`,알림설정). ETA는 **클라 전송값** 저장(서버 계산 안 함).
- [ ] 목록(`GET`)·삭제(`DELETE`)·ETD 조정(`PATCH etd/eta/settings`). 전부 `userId` 필터.
- [ ] **활성 감시 선택 헬퍼**: 사용자당 ETD 가장 임박 + 감시창(ETD−N ~ ETD) 안인 1건.
- [ ] 게이트: ETD 미래·ETA>ETD, 상한 100, 미니마 미설정 시 VFR 기본.
- [ ] 스모크: 등록→목록→삭제 1개.
- [ ] Commit.

## Task 4: 재브리핑 스케줄러 (test-first 스모크)
- [ ] `backend/test/alert-scheduler.test.js` 먼저: 활성 예정비행 1건 넣고 tick 돌리면 baseline 스냅샷이 저장되는지.
- [ ] `backend/src/alerts/scheduler.js`: 인터벌(예 15분) or 상류 store 변경 훅. 활성 비행(Task 3 헬퍼)마다 저장된 `routeForm`으로 `briefing-composer` 재계산 → 스냅샷 저장(`last_briefing_snapshot_id`). **국내+해외 6 store 게이트**(store.js 해시로 무변경 시 skip). 무거운 KIM/KTG는 소스 주기에만.
- [ ] 등록 시 baseline 1회 계산.
- [ ] Run `node --test backend/test/alert-scheduler.test.js`. Commit.

## Task 5: diff 엔진 (test-first 스모크 — 두뇌)
- [ ] `backend/test/alert-diff.test.js` 먼저: prev(정상)→curr(목적지 IFR 하락) 넣으면 MINIMA 알림 1건, 무변경이면 0건.
- [ ] `backend/src/alerts/diff.js` `detectChanges(prev,curr,plan)`: 스펙 §1 7종. 판정은 기존 호출 — `flight-category.js`(운고/시정 크로싱), `taf-window.js alternateRequired`(교체 플립), `hazard-section.js`+고도필터(SIGMET·착빙·난류 severe), 출발공항 LVP/TS. 실효 미니마=max(users 미니마, #8 없으면 내 값).
- [ ] severity + dedup(항목ID+시퀀스) + dwell 2h + rate-limit(reference §5·§5B). `triggered_alerts` 행 생성.
- [ ] Run test. Commit.

## Task 6: 발송 seam + 텔레그램
- [ ] `backend/src/alerts/sender.js`: `formatAlert(alert)` → 글랜서블 문구(`RKPC 목적지 IFR 하락 · ETA…`). 채널 분기 seam.
- [ ] 텔레그램: `fetch('https://api.telegram.org/bot<token>/sendMessage', POST {chat_id,text,reply_markup:딥링크 inline 버튼})`. env `TELEGRAM_BOT_TOKEN`,`TELEGRAM_CHAT_ID`. 인앱=행 저장만.
- [ ] 스모크: formatAlert 단위 1개(발송은 env 없으면 skip).
- [ ] Commit.

## Task 7: 알림센터 피드 API
- [ ] `GET /api/me/alerts`(triggered_alerts, userId 필터, 최신순) + 읽음 표시(`PATCH .../read` or `read_at`).
- [ ] 스모크. Commit.

## Task 8: 프론트 — 인앱 알림센터 (신규)
- [ ] 앱 셸(App.jsx/Sidebar)에 벨 버튼 + 안 읽음 배지 + 패널(누적 알림 리스트). **legacy 알림 UI 재사용 안 함, 신규 제작.** 디자인 헌법 토큰.
- [ ] 각 항목 탭 → `?flight=<id>` 딥링크(Task 10).
- [ ] esbuild 빌드. Commit.

## Task 9: 프론트 — 개인설정 패널 [기상 미니마]+[비행 알림] 탭
- [ ] **[기상 미니마] 탭**: 단일 운고·시정 + VFR/IFR 프리셋. 로드=`GET /api/me/minima`, 저장=`PUT`. (기존 SettingsModal 공항 미니마와 별개.)
- [ ] **[비행 알림] 탭**: 등록 폼(템플릿 select·ETD·ETA[etaCalc pre-fill·수정]·고급 접힘[감시시작 2h 2~6·이상없음 off]) + 등록 목록(상태칩 대기/감시중/순번, ETD 조정·삭제). 목업 기준.
- [ ] 경로 창 [이 비행 알림 등록] 지름길 → 템플릿 자동저장 + 패널 등록.
- [ ] 시간 Z+KST 병기. esbuild 빌드. Commit.

## Task 10: 딥링크 `?flight=`
- [ ] `App.jsx`: `?flight=<routeId>` 읽어(기존 `?airport=` 패턴) 그 예정 비행 로드 → 브리핑 + 변경점 하이라이트 화면. 세션 만료 시 로그인 후 착지.
- [ ] esbuild 빌드. Commit.

## Task 11: 통합 · 수동 확인
- [ ] 텔레그램 e2e: 봇 토큰·chat_id 넣고 등록→강제 diff→텔레그램 수신 확인.
- [ ] Playwright: 개인설정 두 탭·알림센터·딥링크 스크린샷(`docs/dev-server-and-capture.md`).
- [ ] `npm --prefix backend test` 전체 통과. `graphify update .`.
- [ ] Architecture.md/EntryPoints.md 갱신(신규 `backend/src/alerts/*`, 알림센터).

---
## Phase 2 (별도) — Web Push
서비스워커·manifest·`web-push`·VAPID·`push_subscriptions` 구독 UI. sender seam에 push 채널 추가만.
