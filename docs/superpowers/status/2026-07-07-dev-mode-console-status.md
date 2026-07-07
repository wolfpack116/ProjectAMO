# 개발자 모드 콘솔 — 작업 상태 / 세션 핸드오프

> **새 세션 안내:** 이 파일 먼저 읽어라. 계획서 = [plans/2026-07-07-dev-mode-console.md](../plans/2026-07-07-dev-mode-console.md). 이 문서는 "지금까지 뭐가 됐고, 왜 이렇게 됐고, 무엇이 검증됐고, 함정이 뭐고, 다음에 뭘 할지"의 전체 맥락.

최종 갱신: 2026-07-07 · 상태: **테스트 인스턴스 인프라 완료·검증됨. `/dev` 대시보드는 계획만(미구현).**

---

## 0. 한 줄 요약

로컬 개발/테스트를 위해 **"테스트 인스턴스 모드"**(`npm run dev:test` = cron off + 데이터 고정 + 개발자 주입 도구)를 만들어 **검증 완료**했다. 다음 단계는 이 위에 **`/dev` 대시보드 페이지**(조작+관찰)를 계획서대로 구현하는 것. 부수적으로 딥링크 "전체 브리핑 보기"도 이 세션에서 고쳐서 작동한다.

---

## 1. 이 세션의 여정 (왜 지금 구조가 됐나)

1. 처음엔 "개발자 버튼으로 악기상 발생 → 알림 뜨는지" 요청. 초기 구현은 **운영 store/파일을 덮어쓰는 방식**이었음.
2. 문제 발생: cron이 몇 분 뒤 되덮음, 60초 폴링 지연, `readLatest`가 캐시↔디스크 대조로 되돌림, 지도 반영 안 됨 → **운영 데이터를 건드리는 접근이 근본적으로 나쁨**을 확인.
3. 사용자 통찰: **"메인이랑 똑같은데 cron이 안 도는 별도 테스트 환경"**을 원함 = 업계의 **staging/test instance** 패턴.
4. 채택: **같은 코드 + 설정만 다르게**. `DISABLE_COLLECTION=1`로 cron 끄고, 주입은 **메모리(store 캐시)에만**, 파일 미변경. → 완성·검증.
5. 그다음 사용자: 개발자 모드의 진짜 목적은 **조작(트리거) + 관찰(로그·데이터흐름·비효율)** 이라며, `/dev` 대시보드를 제대로 만들자 → 리서처 3 + 웹검색 → **계획서 작성(Phase 1~3)**.

---

## 2. 지금 실제로 구현·검증된 것 (코드 반영 완료)

### 2-1. 테스트 인스턴스 모드 (핵심, 검증됨)

- **cron 게이트** — `backend/src/index.js` `main()`: `stats.initFromFile` 직후 `if (process.env.DISABLE_COLLECTION) { log; return }`. store는 파일에서 로드(고정)되지만 **cron 스케줄·초기수집을 건너뜀**.
- **readLatest 게이트** — `backend/server.js` `readLatest(type)`: `if (process.env.DISABLE_COLLECTION) return cached`. 일반 모드는 캐시↔디스크 해시 대조로 되돌리는데(그래서 in-memory 주입이 무효화됐던 원인), 테스트 모드는 **캐시를 그대로 서빙** → 주입이 지도·API에 일관 반영, 파일 미변경.
- **health testMode** — `backend/server.js` `/api/health` → `{ ok, uptime, testMode: !!process.env.DISABLE_COLLECTION }`.
- **dev 라우터 마운트 게이트** — `backend/server.js`: `if (process.env.DISABLE_COLLECTION) app.use('/api/dev', createDevRouter())`. **테스트 모드에서만 존재**(일반/운영은 404).
- **런처** — `scripts/projectamo-dev.mjs`: `serve:test` 커맨드 추가 → `process.env.DISABLE_COLLECTION='1'` 세팅 후 serve. (startProcess가 env 상속)
- **npm 스크립트** — `package.json`: `"dev:test": "node scripts/projectamo-dev.mjs serve:test"`.

### 2-2. dev 라우터 (주입/초기화) — `backend/src/dev/scenario.js` (신규)

- `POST /api/dev/inject { routeId, scenario:{depLifr,destIfr,routeTs} }`: store 캐시(메모리)에 오버레이(출발 LIFR·목적지 IFR·경로 관통 TS SIGMET) `updateCache`로 얹고, `composeBriefing`+`buildSnapshot`+`detectChanges`(깨끗 baseline vs curr)로 알림 계산 → `triggered_alerts` 적재 + `dispatchAlert`(텔레그램, 400ms 간격 flood 회피). **파일 미변경.**
- `POST /api/dev/reset`: `loadLatest`로 metar/taf/sigmet를 파일에서 다시 읽어 `updateCache`(실황 복구) + 내 `triggered_alerts` 삭제.
- 게이트: `requireAuth`(자기 경로만).
- ⚠️ **`backend/src/dev/fire-alert.js`는 삭제됨**(옛 디스크덮어쓰기 방식). 지금은 scenario.js만.

### 2-3. 프론트 개발자 탭 — `frontend/src/features/personal/PersonalSettingsPanel.jsx`

- `DevTab`: 경로 선택(flights[0]) + [🌩 악기상 주입]/[↺ 초기화] → `/api/dev/inject`·`/api/dev/reset`. 성공 시 `setTimeout(reload, 900)`로 지도·SIGMET 즉시 반영.
- **이중 게이트**: `import.meta.env.DEV`(빌드 시 제거) + 런타임 `testMode`(`/api/health` fetch). → **테스트 모드에서만 개발자 탭이 뜸.**

### 2-4. `/test` 페이지 게이트 — `frontend/src/app/App.jsx`

- `if (pathname === '/test' && import.meta.env.DEV)` — 디자인 테스트 페이지를 운영 빌드에서 제거(전엔 게이트 없어 운영 노출됐음).

### 2-5. 딥링크 "전체 브리핑 보기" 수정 (이 세션에서 고침, 유지)

원래 알림의 [전체 브리핑 보기]가 빈 패널만 열거나 `.trim()` 크래시났음. 수정:
- `frontend/src/app/App.jsx` `onOpenRoute`: `listSavedRoutes()`로 백엔드 id 찾아 `mapRef.current.loadRouteBriefing(route)` + 패널 열기.
- `frontend/src/features/map/MapView.jsx`: imperative handle에 `loadRouteBriefing: (saved) => routeBriefing.actions.loadSavedRoute(saved, { autoBriefing: true })`.
- `frontend/src/features/route-briefing/useRouteBriefing.js`: `loadSavedRoute(saved, opts)` + `autoBriefingPending` state + `autoSearchRef` + **체인 effect**(자동추천이 픽스 채우면 → 검색 1회 실행 → routeResult 생기면 브리핑 생성). 국내(RKSI→RKPC)·국제(RKSI→RJAA) 모두 검증됨.
- `frontend/src/features/route-briefing/lib/routePlanner.js`: `normalizeIdent` = `(value ?? '').trim()...` (픽스 undefined 방어, 크래시 방지).
- ⚠️ **삭제됨**: `frontend/src/features/dev/DevScenarioPage.jsx`(+css) — 격리 시나리오 계산 페이지를 만들었다가 사용자가 "이게 아니라 테스트 인스턴스"라 해서 제거. App.jsx의 `/dev` 라우트도 제거.

### 2-6. 로컬 데이터/계정 상태

- `backend/.env` 생성됨(로컬, gitignore): `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN=8988517084:...`, `TELEGRAM_CHAT_ID=8333411467`. (사용자 실제 텔레그램 봇)
- **테스트 계정: `testpilot` / `testpass123`** (비번 이 세션에서 재설정).
- **route #1** = testpilot 소유, `RKSI→RJAA 데모`, `payload.routeGeometry` 있음(직선 8점), `alert_enabled=1`. inject는 이 경로의 `payload.routeGeometry`가 있어야 동작(SIGMET 박스용).
- ⚠️ 로컬 DB는 옛 스키마라 이 세션에서 **수동 ALTER**로 컬럼 채웠음.

---

## 3. 검증된 사실 (새 세션에서 재검증 불필요)

- ✅ `dev:test` → 로그 `[collection] DISABLE_COLLECTION 설정됨` (cron off).
- ✅ `/api/health` → `testMode:true` (테스트 모드), 일반 모드는 false.
- ✅ inject → 브리핑 RKSI 시정 4.0km→**0.8km**, 위험 0→**1(뇌우)**, `/api/sigmet` 아이템 1→**2**, 지도 SIGMET 뱃지 **2**(fresh load), 알림 4건+텔레그램.
- ✅ **파일 미변경**: inject 후 `data/taf/latest.json` RKSI base.vis = 4000 그대로.
- ✅ reset → 실황 복구(4.0km/위험0) + 알림 삭제.
- ✅ 개발자 탭: 테스트 모드에서만 렌더(Playwright 확인).
- ✅ 딥링크 [전체 브리핑 보기] → RKSI→RJAA 전체 항로(G597 웨이포인트) 그려지고 브리핑 렌더(크래시 없음).

---

## 4. 함정 / 주의 (반드시 인지)

1. **readLatest 되돌림**: 일반 모드(cron on)에선 `readLatest`가 캐시↔디스크 대조로 in-memory 주입을 되돌린다. 그래서 **주입은 테스트 모드에서만 유효**. (Phase에서 개발자 페이지도 테스트 모드 게이트 유지)
2. **Playwright reload 타이밍**: `window.location.reload()` 직후 뱃지를 읽으면 이전 값이 잡힐 수 있음(재fetch 전). 검증 시 fresh `goto` 또는 넉넉한 대기.
3. **inject엔 routeGeometry 필수**: `buildBriefingRequest`가 `payload.routeGeometry` 없으면 null → 400 no_geometry. route #1엔 있음.
4. **텔레그램 flood**: 여러 알림 연속 발송 시 429. dispatch 사이 400ms 간격 있음.
5. **국제 IFR 경로 재검색**: `KNOWN_AIRPORTS`는 국내 8개지만 공항 드롭다운은 더 큼(RJAA 선택 가능). loadSavedRoute의 체인 effect가 자동추천(exit fix 포함)까지 기다렸다 검색해야 완성됨 — 이미 반영.
6. **마이그레이션 순서 버그(별도 task chip 생성됨)**: `backend/src/db/index.js` `createDb`가 `schema.exec`(인덱스가 alert_enabled 참조)를 `ensureColumns`보다 먼저 실행 → **구버전 DB에서 서버 부팅 크래시**. AWS에 구DB로 #13 배포 시 위험. 회귀테스트+순서수정 필요(task chip으로 등록됨).
7. **recompute export**: `scheduler.js`에서 `export function recompute` 했는데 지금 scenario.js는 `buildBriefingRequest`·`buildSnapshot`만 씀 → recompute export는 현재 미사용(정리 후보, 무해).

---

## 5. 배포/운영 관련 (사용자와 논의된 것 — 중요)

- **프론트는 `npm run build`로 빌드해 nginx 정적 서빙** → `import.meta.env.DEV=false` → 개발자 탭·`/test` 코드가 **빌드 결과물에서 제거됨**(운영 노출 0). ✓
- **dev 라우터는 `DISABLE_COLLECTION`일 때만 마운트** → 운영엔 없음(운영은 그 플래그 안 켬). ✓
- ⚠️ **AWS 백엔드 `NODE_ENV=production` 미설정 의심**: PM2 시작 커맨드(`docs/operations.md`)에 없음. 미설정 시:
  - `SESSION_SECRET` 임시값 → **재시작(`pm2 restart`)마다 전체 로그아웃**.
  - 쿠키 `Secure` 안 붙음, CORS 안 조여짐.
  - **권장:** 서버 `backend/.env`에 `NODE_ENV=production` + `SESSION_SECRET`(openssl rand -hex 32) 세트 설정. (production인데 SESSION_SECRET 없으면 `session.js`가 throw → 부팅 실패, 반드시 세트로.)
- 운영 데이터 경로: `DATA_PATH=/opt/projectamo/shared/data` (PM2). 지형 4GB는 git 밖, 서버 직접 업로드.

---

## 6. 리서치 종합 (재실행 불필요 — 계획서 근거)

**리서처1(테스트할 상호작용 우선순위):** ⭐⭐⭐ 알림 스케줄러 즉시발화(15분 대기 제거)·브리핑 위험탐지 프리셋 > ⭐⭐ 역할전환/예보관승인·딥링크 > ⭐ 공항카테고리·레이어·NOTAM·저장경로.

**리서처2(데이터흐름·관찰):** 흐름 = cron수집→store캐시→API→60초 폴링(snapshot-meta). **안 찍히는 것**: 수집기 소요시간·캐시 hit/miss·응답크기·store크기. **비효율**: snapshot-meta 5s TTL vs 60s 폴링 헛fetch·METAR/TAF 전체 재fetch(델타X)·KIM NWP 20~30MB 통짜·알림 스케줄러 15분 전체 재계산·디스크 회전 I/O. **재사용 엔드포인트**: `/api/admin/metrics`(CPU/mem/disk)·`/api/stats`·`/api/snapshot-meta`·`/api/health`. **추가 제안**: `/api/dev/store-stats`, `/api/dev/request-log`(타이밍 미들웨어), `/api/dev/processor-log`(duration_ms).

**리서처3(재사용 인프라):** `/admin` 콘솔이 대시보드 템플릿 — `ResourceTimeline`(Recharts)·게이지·5초 폴링·테이블. dev 도구·게이팅 이미 있음. **권장: `/dev` 독립 페이지 + import.meta.env.DEV 게이트 + 기존 엔드포인트/컴포넌트 재사용 → 백엔드 ≈0, 프론트 ~200줄.** `frontend/src/features/developer/{DeveloperPage,developerApi,tabs/*}` 구조.

**웹 레퍼런스:** Feature Toggles(Fowler) / MSW(mswjs.io, 네트워크 목킹 — 우리 주입의 프론트판) / 관찰 Sentry·LogRocket·Highlight. 정석 = **"조작+관찰 세트, 개발/테스트 한정".**

---

## 7. 다음 할 일 (계획서 Phase 1부터)

계획서 [plans/2026-07-07-dev-mode-console.md](../plans/2026-07-07-dev-mode-console.md) 의 **Phase 1 (Task 1~5)** 부터:
1. `/dev` 라우트+페이지 골격(테스트모드 게이트) 2. 조작 탭(현 DevTab 이관) 3. 스케줄러 즉시발화+알림삭제 엔드포인트 4. 관찰 탭 기본3(triggered_alerts 피드·snapshot-meta·CPU/메모리) 5. 마무리(graphify·Architecture).

**착수 전 확인:** `npm run dev:test`로 띄우고 `testpilot/testpass123` 로그인, route #1 존재 확인.

---

## 8. 현재 러닝/정리 상태

- 이 세션 중 띄운 테스트 서버들은 사용자 요청으로 **포트(3001/5173) 비워둠**. 새 세션에선 `npm run dev:test`로 새로 띄우면 됨.
- 임시 검증 스크립트(`_*.mjs`)·시드 스크립트 전부 삭제됨(정리 완료). `_dev_backup.json` 없음.
- 커밋 안 함(이 세션 변경은 워킹트리에 있음) — 필요 시 커밋/브랜치는 사용자 지시 대기.
- 별도 task chip: "마이그레이션 크래시 수정"(§4-6) 등록됨.
