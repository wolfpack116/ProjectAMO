# 로그인 · 계정 · 예보관 문의(#7) — 구현 참조

> 상태: **구현 참조(reference)** — [운영 기능 확장 초안](2026-07-04-operational-features-draft.md) #7의 상세 설계.
> 성격: 이 프로젝트 최초의 **"사용자→서버 쓰기 + 인증"** 영역. 기존은 공개 읽기(서버→사용자)뿐 → 신뢰 경계·검증·저장이 새로 생김.
> 대상: 조종사·예보관. 용도: 개인 프리셋(미니마)·저장 경로, **조종사→예보관 경로 문의(콘솔 팝업)**.
> 갱신: 2026-07-05 스펙 리뷰 반영(승인제·서버검증·DB제약·세션TTL·dev/prod쿠키·마이그레이션). 공유 방식은 **공유코드→예보관 요청 큐**로 교체.

---

## 0. 범위 (1차 발표용 / 차후)

**★ 1차 목표 (발표까지, 지금):**
- 고전 로그인(**아이디+비밀번호, 소셜 X**)
- 사용자별 **프리셋(미니마)·저장 경로**를 **서버**에 보관
- 역할 2종: **조종사 / 예보관** (예보관은 **승인/초대제**)
- **조종사→예보관 경로 문의**: 조종사가 [예보관에게 문의] → 예보관 콘솔에 **팝업/대기열**로 뜸 → 예보관이 열어 응대. **외부 수신 데이터만** 표시.

**차후 (발표 후):**
- 내부망→외부 **일방향 데이터 내보내기 + 역할 기반 2계층**(예보관 풍부 자료). egress만·인바운드 없음, 회사 거버넌스 필요.
- 소셜 로그인, 다중기기 동기화, 이메일 비번 재설정, 예보관 공항 담당 배정, 실시간 SSE.

---

## 1. 핵심 개념 3줄 요약 (용어)
- **인증(Authentication)**: "누구냐" 확인 = 로그인.
- **인가(Authorization)**: 로그인했어도 "**자기 것만** 건드리게" = 권한.
- **세션**: 로그인 상태를 계속 기억하는 "출입증"(쿠키로 유지).

---

## 2. 아키텍처 — "분리 원칙"

기존 공개 날씨 API는 **손대지 않고**, 개인/인증 경로를 옆에 새로 만든다.

```
공개(읽기, 인증 불필요):  /api/notam, /api/briefing, /api/kim-field ...   ← 지금 그대로
인증(개인, 로그인 필요):  /api/auth/*        회원가입·로그인·로그아웃·내정보
                        /api/me/*          내 프리셋·내 경로 (CRUD, 자기 것만)
예보관(역할 필요):        /api/forecaster/*  들어온 문의 대기열 조회·처리
문의 생성(조종사):        POST /api/me/requests   내 경로를 예보관에게 문의
```

- 백엔드: 기존 **Express**(`backend/server.js`)에 라우터·미들웨어 추가.
- 저장소: **SQLite부터**(파일 1개, 무설정) → 규모 커지면 Postgres. 계정·프리셋·문의는 **영구 저장**.
- 전송 보안: **HTTPS 이미 있음**(nginx + Let's Encrypt).
- **CORS**: 개발(프론트 5173, 백엔드 3001 = 다른 origin)에선 `cors({origin:'http://127.0.0.1:5173', credentials:true})` 필요. 운영은 nginx가 한 origin으로 서빙 → CORS 불필요.

---

## 3. 인증 방식 — 세션 + 쿠키 (채택)

단일 서버·수천 명 규모엔 세션이 더 단순하고 로그아웃/만료가 쉬움.

**동작:** 로그인 성공 → 서버가 세션 생성(`session.userId`, `role`) → **세션 쿠키** 발급 → 이후 요청마다 쿠키 자동 첨부 → `req.user` 세팅. 로그아웃 시 세션 파기.

**쿠키 속성:**
- `HttpOnly` — JS 접근 차단(XSS 탈취 방지)
- `Secure` — **운영에서만**(`secure: process.env.NODE_ENV === 'production'`) → 로컬 http 개발 안 깨짐
- `SameSite=Lax` — 교차사이트 POST에 쿠키 안 실림(CSRF 완화)

**세션 수명(구체):** **절대 만료 24h + 유휴 1h**(1시간 무활동이면 만료). "로그인 유지"는 v1 생략.

**세션 스토어:** `express-session` + **`better-sqlite3-session-store`**(또는 `connect-sqlite3`). 기본 MemoryStore 금지(재시작 시 소실).

**시크릿:** `SESSION_SECRET`은 `.env`(레포 커밋 금지, `openssl rand -hex 32`).

---

## 4. 비밀번호 보안
- **평문 저장 절대 금지.** `bcrypt` 해시(cost 12). salt 자동 포함.
- 로그인 시 `bcrypt.compare(입력, 저장해시)`. 원문 복원·로그 금지.
- 규칙: 최소 8자, 최대 128자.

---

## 5. 데이터 모델 (SQLite, CREATE TABLE + 제약)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'pilot' CHECK (role IN ('pilot','forecaster','admin')),
  display_name  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE presets (            -- 개인 미니마 (localStorage airport_minima_settings → 서버)
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  icao         TEXT NOT NULL CHECK (length(icao)=4),
  ceiling_ft   INTEGER CHECK (ceiling_ft BETWEEN 0 AND 60000),
  visibility_m INTEGER CHECK (visibility_m BETWEEN 0 AND 10000),
  wind_kt      INTEGER, xwind_kt INTEGER, gust_kt INTEGER,
  pilot_type   TEXT CHECK (pilot_type IN ('VFR','IFR') OR pilot_type IS NULL),
  updated_at   TEXT NOT NULL,
  UNIQUE(user_id, icao)
);

CREATE TABLE routes (             -- 저장 경로(= 문의·#13 감시 대상). inputs only.
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  name         TEXT,
  dep TEXT, dest TEXT, altn TEXT,
  waypoints    TEXT,              -- JSON, 개수·길이 상한(§8)
  altitude_ft  INTEGER CHECK (altitude_ft BETWEEN 0 AND 60000),
  etd          TEXT,              -- ISO, #13 감시
  rules        TEXT CHECK (rules IN ('VFR','IFR') OR rules IS NULL),
  created_at   TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE requests (           -- 조종사→예보관 문의 (공유코드 대체)
  id                  INTEGER PRIMARY KEY,
  pilot_id            INTEGER NOT NULL REFERENCES users(id),
  route_id            INTEGER NOT NULL REFERENCES routes(id),
  target_airport      TEXT NOT NULL,         -- 대상 공항 ICAO
  message             TEXT,                  -- 조종사 질문(선택)
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','viewed','closed')),
  assigned_forecaster INTEGER REFERENCES users(id),  -- (v2) 담당자
  created_at          TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- 세션 테이블은 express-session 스토어가 생성·관리.
```

- **마이그레이션/시드**: 최초 실행 시 위 스키마 생성 스크립트 1개. **첫 관리자/예보관 계정**은 시드 스크립트나 1회성 env 부트스트랩으로 생성(공개 등록으로 못 만듦, §6).
- (공유코드 방식을 예비로 남기려면 `shares` 테이블을 추가하되, 1차 기본은 `requests`.)

---

## 6. API 명세

접근: 🔓 공개 · 🔑 로그인 · 👤 조종사 · 🧑‍🔬 예보관.

### 인증
| 메서드·경로 | 접근 | 동작 |
|---|---|---|
| POST `/api/auth/register` | 🔓 | 검증→bcrypt→insert. **role='forecaster'는 초대토큰/관리자만**(없으면 400 `forecaster_approval_required`). 중복 아이디도 **동일 성공응답**(열거 방지) 후 내부 무시 |
| POST `/api/auth/login` | 🔓 | bcrypt.compare→세션·쿠키. 실패 401 "아이디 또는 비번 오류"(존재여부 안 흘림) |
| POST `/api/auth/logout` | 🔑 | 세션 파기 |
| GET `/api/auth/me` | 🔑 | {id, username, role, display_name} |

### 내 프리셋·경로
| 메서드·경로 | 접근 | 동작 |
|---|---|---|
| GET/PUT/DELETE `/api/me/presets[/:icao]` | 🔑 | 미니마 조회·upsert·삭제 (**자기 것만**) |
| GET/POST/PUT/DELETE `/api/me/routes[/:id]` | 🔑 | 경로 CRUD (**자기 것만**) |

### 문의 (조종사→예보관)
| 메서드·경로 | 접근 | 동작 |
|---|---|---|
| POST `/api/me/requests` | 👤 | {route_id, target_airport, message} → 대기열에 문의 생성 |
| GET `/api/forecaster/requests?airport=&status=pending` | 🧑‍🔬 | 들어온 문의 목록(폴링). 예보관 콘솔이 주기 조회 |
| POST `/api/forecaster/requests/:id/claim` | 🧑‍🔬 | 상태 viewed + 담당 배정 |
| GET `/api/forecaster/requests/:id` | 🧑‍🔬 | 문의의 경로 입력값 → 콘솔이 브리핑 렌더 |
| POST `/api/forecaster/requests/:id/close` | 🧑‍🔬 | 처리 완료 |

---

## 7. 인가(권한) — "자기 것만" + 역할

- **모든 `/api/me/*`는 `req.user.id`로 필터.** 클라이언트가 보낸 `user_id`/`pilot_id`는 **절대 신뢰 안 함**(대표 취약점: 남의 id 넣어 조회).
- 소유권 미들웨어 예시:
```js
function requireOwnership(getRow) {
  return (req, res, next) => {
    const row = getRow(req.params.id);        // DB에서 대상 조회
    if (!row) return res.sendStatus(404);
    if (row.user_id !== req.user.id) return res.sendStatus(403);  // 남의 것 → 403
    req.row = row; next();
  };
}
```
- 역할 미들웨어: `requireAuth`, `requireRole('forecaster')`. `/api/forecaster/*`는 예보관만.
- 문의 열람: 예보관은 대기열의 문의(경로 **입력값만**) 조회 가능. 조종사는 자기 문의 상태만.

---

## 8. 입력 검증 (신뢰 경계 — 들어오는 건 다 의심, **서버측 필수**)

- **서버에서 `zod` 스키마로 강제**(클라 검증은 편의일 뿐, 신뢰 안 함). 실패 400.
- 전역 본문 크기 제한: `app.use(express.json({ limit: '10kb' }))` (경로/브리핑 등 큰 엔드포인트만 개별 상향).
- DB는 **프리페어드 스테이트먼트**(`better-sqlite3`)로 SQL 주입 차단.

| 필드 | 규칙 |
|---|---|
| username | 3~32자, 영숫자·`_` |
| password | 8~128자 |
| role | `pilot`\|`forecaster`(가입 시 forecaster는 게이트) |
| icao / target_airport | 대문자 4글자 |
| ceiling_ft / visibility_m / altitude_ft | 정수 범위(§5 CHECK와 일치) |
| wind/xwind/gust kt | 0~200 |
| etd | 유효 ISO, 과거·과먼미래 거부 |
| waypoints | JSON, 개수 상한(예 100) + 총 길이 상한 |
| message | 길이 상한(예 500자) |

---

## 9. 조종사→예보관 문의 흐름 (발표 핵심, 공유코드 대체)

```
조종사: 경로/브리핑 보다가 [예보관에게 문의] 클릭 → 대상 공항 선택(RKSS) (+질문)
  → POST /api/me/requests → 대기열에 'pending' 생성

예보관: 콘솔 로그인·대기 중
  → 콘솔이 GET /api/forecaster/requests 를 3~5초 폴링
  → 새 문의 도착 → 화면에 팝업/뱃지 "🔔 새 문의: RKSS 경로 브리핑"
  → 클릭 → claim(viewed) → 그 조종사의 경로·브리핑이 열림(현재 외부 데이터로 렌더)
  → 전화 병행 응대 → [완료]로 close
```

**"해당 공항 예보관"에게 라우팅:**
- **v1(데모)**: 공용 대기열 + `target_airport` 태그 → 예보관이 자기 공항으로 **필터**.
- **v2(나중)**: 예보관별 **담당 공항/구역 배정** → 그 공항 문의만 그 예보관에게.

**실시간 전달:** 예보관은 데스크에 콘솔을 열어두므로 **폴링(3~5초)**이면 충분(웹푸시 불필요). 즉시성이 필요하면 **SSE**로 승격(차후).

**보안·프라이버시:** 조종사가 스스로 [문의] 눌러 동의. 넘어가는 건 **경로 입력값 + 질문**(민감 최소). `/api/forecaster/*`는 예보관 역할만.

> 예비: 예보관이 로그인·대기하지 않는 상황을 위해 **공유코드 방식**(짧은 8자 코드 + 2h 만료 + `/api/shared/:code` rate limit)을 폴백으로 둘 수 있음. 1차 기본은 문의 큐.

---

## 10. 프론트엔드
- **로그인/회원가입 화면**(모달/라우트) + 인증 상태·역할 컨텍스트(`useAuth()`).
- **마이그레이션(충돌 규칙)**: 최초 로그인 시 로컬(`airport_minima_settings`·저장 경로)이 있으면 "이 기기 설정을 계정으로 가져올까요?" 1회 제안. **가져온 뒤엔 서버가 소스**(로컬은 게스트/미로그인 폴백). 서버·로컬 동시 존재 시 **사용자가 선택**(기본: 서버 우선).
- **연결 지점**: `SettingsModal.jsx`(미니마 UI) → 로그인 시 `/api/me/presets`로 저장/로드(현재 `localStorage.setItem`을 `useAuth()` 분기로 감쌈). `routeStore.js`(경로 CRUD) → `/api/me/routes`.
- **문의 버튼**(조종사): 경로/브리핑 화면에 [예보관에게 문의].
- **예보관 콘솔**: 대기열 리스트 + 새 문의 토스트(폴링) + 클릭 시 경로·브리핑 뷰.
- 비로그인 게스트: 공개 날씨 열람만.

---

## 11. 보안 체크리스트
- [ ] HTTPS 강제(이미 있음). 쿠키 `HttpOnly` + `Secure`(운영만) + `SameSite=Lax`.
- [ ] 비번 `bcrypt` cost 12, 평문 로그 금지.
- [ ] **rate limit**: 로그인(IP당 15분 10회), 회원가입(IP당 시간당 5회), 문의생성(사용자당 시간당 30회). `express-rate-limit`.
- [ ] 모든 `/api/me/*` 소유권 필터(클라 id 불신), `requireOwnership`/`requireRole`.
- [ ] **서버측 zod 검증** + `express.json({limit:'10kb'})` + 프리페어드 스테이트먼트.
- [ ] 세션 시크릿 `.env`(커밋 금지), 세션 TTL(24h/유휴1h), 스토어=SQLite.
- [ ] **예보관 계정 승인/초대제**(공개 등록 금지). 첫 관리자=시드.
- [ ] 계정 열거 방지: 로그인·회원가입 응답이 존재여부 안 흘림.
- [ ] CSRF: `SameSite=Lax`로 교차사이트 POST 차단(1차 충분). **CSRF 토큰은 차후 하드닝**.
- [ ] 개발: `Secure` 끄고 CORS(credentials) 허용, 운영: 한 origin.

---

## 12. 기존 코드 재사용 / 신규
**재사용**: `SettingsModal.jsx`(미니마 UI, 현재 localStorage) · `routeStore.js`(경로 CRUD, localStorage, inputs only) · `backend/server.js`(Express 진입점).
> ⚠️ 재사용이라도 현재는 **서버 훅이 0** — localStorage 호출을 `useAuth()` 분기로 감싸고 fetch로 대체하는 작업이 실제로 필요(리뷰 지적).

**신규(백엔드 `package.json`에 추가)**: `better-sqlite3`, `express-session`, `better-sqlite3-session-store`(또는 `connect-sqlite3`), `bcrypt`, `zod`, `express-rate-limit`, (개발) `cors`.
**신규 코드**: DB 스키마·시드, 인증/소유권/역할 미들웨어, `/api/auth`·`/api/me`·`/api/forecaster` 라우터, `.env.example`(`SESSION_SECRET`,`NODE_ENV`,`FRONTEND_ORIGIN`), 프론트 로그인·문의·예보관 콘솔.

---

## 13. 구현 단계 (v1 발표용 체크리스트)
1. **DB(SQLite) + 스키마·시드 + 첫 관리자/예보관** + `bcrypt`.
2. **인증 API**(register[예보관 게이트]/login/logout/me) + `express-session`(스토어·쿠키속성·TTL).
3. **프론트 로그인/회원가입** + 인증 상태·역할.
4. **프리셋 서버화**(SettingsModal 연결 + 마이그레이션 규칙).
5. **경로 서버화**(routeStore 연결).
6. **문의 큐**: 조종사 [문의] → `/api/me/requests`, 예보관 콘솔 폴링·팝업·claim·close. ← **발표 핵심**.
7. **보안 하드닝**: 서버검증·rate limit·소유권·쿠키 dev/prod·CORS.
8. (역할 배지) 조종사/예보관. 내부 데이터 계층은 **차후**.

---

## 14. v1 갭 & 열린 질문 (명시)
**v1 갭(차후 보완):**
- 비번 재설정: v1은 **관리자 리셋만**(셀프 이메일 재설정은 차후, SMTP 필요).
- CSRF 토큰(SameSite로 대체), 실시간 SSE(폴링으로 대체), 예보관 공항 담당 배정(v1 공용큐), 다중기기 logout-all·감사로그 → 차후.

**결정 대기:**
- 세션 vs JWT: **세션 권장**(확정 대기).
- 예보관 등록: 관리자 생성 vs **초대토큰**(권장) 중 택1.
- 마이그레이션 충돌 기본값: 서버 우선 vs 물어보기.

---

## 15. 참고
- OWASP Session Management / Password Storage Cheat Sheet(bcrypt).
- 관련: [운영 기능 확장 초안 #7](2026-07-04-operational-features-draft.md) · [경로 예보변화 알림 참조 #13](2026-07-04-route-forecast-alert-reference.md)(경로·프리셋·역할 공유).
