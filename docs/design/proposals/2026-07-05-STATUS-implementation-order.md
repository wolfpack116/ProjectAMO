# 운영 기능 확장 — 구현 순서 & 상태 (핸드오프)

> 목적: 세션 넘어 이어가기용 한 장 요약. 설계는 끝났고 **구현은 아직 0**. 이 문서 + 아래 링크만 보면 어디서든 착수 가능.
> 갱신: 2026-07-05.

## 문서 맵 (설계 완료)
- 인덱스: [운영 기능 확장 초안](2026-07-04-operational-features-draft.md) — 확정 12개(#1~8·#12·#13·#14·#15), 제외 #9·#10·#11
- [#13 경로 예보변화 알림](2026-07-04-route-forecast-alert-reference.md)
- [#7 로그인·계정·예보관 문의](2026-07-05-login-accounts-reference.md)
- [#15 지역 브리핑](2026-07-05-area-briefing-reference.md)
- [잔여 #1~6·#8·#12·#14 상세 스펙](2026-07-05-remaining-features-implementation-notes.md)
- 플랫폼 타깃: [design-language.md §6-0](../design-language.md) — **iPad(iOS Safari) 우선 + 웹앱/PWA, 네이티브 앱·안드로이드 아님**

## 구현 순서 (시간 넉넉 → 토대·의존성·리스크 순)

| 파 | 항목 | 상태 | 메모 |
|---|---|---|---|
| **1 토대** | #1 출처·발표·유효·수신 배지 | ✅ 구현·검증(빌드/테스트15/라이브 육안) | 공용 `frontend/src/shared/ui/DataProvenance.jsx` → 패널 METAR·TAF 헤더 + 브리핑② 행펼치기. 백엔드 `header.source`(KMA·publish·valid·fetch), 파서2·프로세서2·airport-summary 통과. ⚠️ 파서 경로 실제는 `backend/src/parsers/`(스펙의 `weather/`는 stale) |
| | #4 KIM 메타 | ⏸ 보류 | `data_cutoff` 실제값이 상류·manifest 어디에도 없음(가정 금지 규칙) → 사용자 결정으로 이번 세션 스킵. 해상도(km, 경도 ×cos(lat) 보정)·`initial_time`(=`tmfc`)은 즉시 구현 가능, **KMA cutoff 실제값 확보 시 재개** |
| | #5 RVR 표면화 | ✅ 구현·검증(빌드/로직) | 모든 METAR 표면(현재기상·METAR탭·지도툴팁·브리핑②) 일관, 없으면 "2000+". 공유 `formatRvr`. ⚠️ 육안(표 폭·툴팁 높이) 미확인 |
| | #6 판정 일원화 | ✅ 구현·검증(테스트239/로직대조) | 백엔드 `flight-category.js`를 패널식 3단계+기본미니마로 재작성(프론트 `helpers.js` 미러), taf-window·airport-summary에 icao 주입. 백엔드=패널 전 케이스 일치 확인(RKSI 9000/1400 양쪽 IFR). ⚠️ 브리핑 UI 라이브 육안만 미확인. 백엔드 기본미니마만 적용(사용자 커스텀 미니마 미반영은 잔여) |
| **2 키스톤** | #7 로그인/계정/역할/예보관 문의 | ⬜ | 나머지 토대이자 최대 불확실 → 일찍. 세션+쿠키·SQLite·bcrypt·분리 인증경로 |
| **3 가치** | #13 경로 예보변화 알림 | ⬜ | #7 위에. 트리거=내 미니마 선 크로싱(카테고리 프리셋), 이벤트구동+인덱스 |
| | #15 지역 브리핑 | ⬜ | 독립. 영역=직접그리기+관제섹터 복수. 신규 `@turf/boolean-intersects` |
| **4 폴리시** | #3 데이터없음 · #12 NOTAM 고도필터 · #14 PDF | ⬜ | 마감 없이 채워넣기 |
| **게이트** | #2 원문(선확인 후) · #8 접근최저치 | ⬜ | **맨 끝.** #8=KOCA 라이선스 게이트 + 고도(AMSL/AGL) 정확성 선결 |

## 착수 전 반드시 (선확인/선결)
- **선확인 3건**: #2 상류가 원본 TAC 주는지 · #4 KIM cutoff 실제값(+km 위도보정) · **#8 KOCA 라이선스**(도구 탑재 가능?).
- **#8 정확성 선결**: DA/MDA=AMSL, 운고=AGL → 공항표고 보정 없이 비교 금지. "한계" 기준도 도메인 확정 전 빌드 금지.
- **#6 순서**: #13·#15가 TAF 소비 늘리기 전에.

## 커밋 상태
- 커밋됨: `07d51fe`(설계문서 5개), `1e0e400`(공항 툴팁), 이 문서+플랫폼 노트(이번 커밋).
- 제외(사용자 작업): 없음(툴팁은 커밋함).

## #7 로그인/계정 진행 (2파 키스톤, 8단계)
> 결정: **세션+쿠키 · 예보관=관리자 직접 생성(초대토큰 X) · 마이그레이션 서버우선**. 스펙 [#7 참조](2026-07-05-login-accounts-reference.md).

| 단계 | 상태 |
|---|---|
| ① DB(SQLite)·스키마·유저생성·bcrypt | ✅ `backend/src/db/`(schema.sql·index.js·users.js·create-user.js), 테스트 8. DB=`backend/data/projectamo.db`(gitignore). 관리자: `USERNAME=.. PASSWORD=.. ROLE=admin node src/db/create-user.js` |
| ② 인증 API+세션+쿠키 | ✅ `backend/src/auth/`(session·middleware·validation·router). register(조종사만·예보관게이트·열거방지)·login(bcrypt·타이밍가드)·logout·me. 세션=SQLite스토어·HttpOnly·SameSite=Lax·Secure(운영)·절대24h/유휴1h. (개발)CORS. auth는 `NODE_ENV!=='test'` 가드(route테스트 DB잠금 회피). 통합테스트 4. `.env.example` |
| ③ 프론트 로그인/역할 | ✅ `features/auth/`(AuthContext `useAuth` + AuthModal 모달). 진입점=사이드바 하단 프로필(로그인 전 "로그인/게스트", 후 이름·역할) + 모바일 더보기. 게스트는 그대로 열람. Playwright 왕복검증(게스트→모달→로그인→로그아웃). UI/UX 결정: 모달·사이드바·게스트열람 |
| ④ 프리셋(미니마) 서버화 | ✅ `backend/src/me/presets.js`(GET/PUT/DELETE `/api/me/presets`, requireAuth·session.userId만·zod). SettingsModal이 로그인 시 서버 로드/저장(서버우선, 게스트=localStorage, 서버빈값이면 로컬이 첫저장으로 마이그레이션). 테스트4 + Playwright 왕복(GET/PUT 200) |
| ⑤ 경로 서버화 · ⑥ 문의 큐(발표핵심) · ⑦ 보안 하드닝 | ⬜ 다음 |

## 다음 액션
→ **1파 완료**: #1·#4·#5·#6. **2파 #7 — ①DB·②인증API·③프론트로그인 완료(로그인/회원가입/로그아웃 브라우저 동작). ①~④ 완료(로그인+개인 미니마 서버저장 동작). 다음 ⑤ 경로 서버화**(routeStore → /api/me/routes).
- 잔여 꼬리: #6 브리핑 UI 라이브 육안(백엔드는 확정), #4 지도 해상도 텍스트 표시, #4 cutoff(KMA 실제값 대기), #6 백엔드가 사용자 커스텀 미니마 미반영(기본미니마만) — 필요 시 클라이언트가 미니마 전달하도록 확장.
