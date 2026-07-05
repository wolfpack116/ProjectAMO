# 잔여 기능 상세 구현 스펙 (#1~6, #8, #12, #14)

> 상태: **구현 스펙(implementation-ready)** — [운영 기능 확장 초안](2026-07-04-operational-features-draft.md)의 나머지 S/M 기능. #7·#13·#15는 별도 대형 참조 문서, 이 9개는 소·중 규모라 한 문서에 각 요소별 상세.
> 근거: 2026-07-05 병렬 코드 심층조사 4건(파일·라인 인용). 각 항목: **현황(file:line) / 정확한 변경 / 엣지·리스크 / 검증**.
> ⚠️ 오케스트레이터 검수 주석(⟢)은 서브에이전트 제안 중 정확성 의심 지점을 바로잡은 것 — 착수 전 반드시 반영.
> 착수 순서: **#5 → #1·#4 → #3 → #14 → #12 → #6 → #2 → #8**(값싼 표시 먼저, 선확인·정확성 필요한 #2·#8 뒤).

---

# A. 신뢰·메타 (#1, #2, #4)

## #1 출처·발표·유효시각 명시 — S
**현황**
- 발표/관측 시각 **이미 보존**: `metar-parser.js:198-204`(`iwxxm:issueTime`·`observationTime`), `taf-parser.js:48-54`(validPeriod begin/end).
- 수신 시각: `metar-processor.js:9`(`fetched_at`).
- **빠진 것**: 출처 식별자(어느 소스인지). SIGMET/AIRMET 출처(FIR/unit) 추출 여부 **확인필요**(`iwxxm-advisory-parser.js:98-100` `parseUnitDesignator`). NOTAM 타임스탬프 메타 없음.

**정확한 변경**
1. 각 파서 반환에 `header.source = { identifier:'KMA', publish_time, valid_from, valid_to, fetch_time:null }`.
2. `metar-processor.js`에서 `fetch_time` 채워 `store.save`.
3. `airport-summary.js:80`에서 `source`를 프론트로 통과.
4. 프론트 공용 `DataProvenance.jsx`(~50줄): `identifier · 발표시각 · 유효 · 수신` 표기. METAR/TAF 카드 헤더·브리핑 섹션에 마운트. (**#4와 같은 컴포넌트 공유**.)

**엣지·리스크**: IWXXM 중첩 TimeInstant는 기존 `||` 체인으로 처리됨. fetch_time은 파싱 후 processor에서 저장(요청/응답 경계). 시각 표기 Z/KST 통일.
**검증**: METAR `source.publish_time`==`issueTime` 테스트. 카드에 "KMA · 12:30Z · valid…" 배지.

## #2 원문 토글 — 하~중
**현황 (핵심 결론)**
- ⟢ **IWXXM에는 원본 TAC 문자열이 애초에 없다.** `airport-summary.js:26-49` `reconstructMetarRaw()`가 파싱 토큰으로 TAC를 **재조립**. TAF/SIGMET도 동일(원문 미보존).
- `api-client.js:115-118`가 원본 XML을 받지만 파싱 후 버림.

**정확한 변경**
1. 사용자용 "원문" = **재구성으로 충분**(METAR 이미 있음). TAF는 `reconstructTafRaw()`를 briefing 모듈에 추가(change group도 `type/start/end/wind/vis/wx/clouds`로 재조립 — `taf-parser.js:171-199`).
2. 라벨을 정직하게: **"원문(재구성)"**. IWXXM만 있는 소스는 "원본 TAC 없음 → 재구성" 명시.
3. (선택) 진짜 원본 XML 아카이빙이 필요하면 `header._raw_xml`을 **config 게이트(기본 off)**로 저장(METAR당 ~50KB라 상시 저장 비권장).

**엣지·리스크**: 재구성 TAC는 display 토큰에서 100% 복원 가능(원본 인코딩 불필요). CAVOK 처리 확인.
**검증**: `reconstructMetarRaw` 출력이 TAC 정규식 매칭. 프론트 토글 시 추가 fetch 없음.
⟢ **결론**: "원문 토글"은 사실상 **"재구성본을 정직하게 원문으로 라벨링 + TAF 재구성 추가"**. 상류 원본 확보(선확인)는 아카이빙 목적일 때만.

## #4 KIM 메타 (모델·해상도·cutoff) — S
**현황**
- `model`·`tmfc`·`hf`·`validTime`은 **이미 노출**(`kim-nwp-model.js:82-93` parseTmfc, `server.js:595-627` index). `kim-surface-wind-processor.js:101-116` 그리드에 `nx,ny,bounds`.
- **빠진 것**: **cutoff(초기장 시각)**, **해상도(km)**. manifest 내용 일부 **확인필요**(`kim-nwp-store.js:91-93`).

**정확한 변경**
1. `buildKimNwpGrid`에 `resolution:{dx_km,dy_km,nx,ny}` 추가(도→km 환산).
2. manifest에 `initial_time`, `data_cutoff` 추가.
   - ⟢ **cutoff는 "+3h" 가정 금지** — KMA KIM 사이클별 실제 cutoff를 명세/설정에서 확인해 넣을 것(에이전트의 `tmfc+3h`는 임시값).
3. `server.js` index 응답에 `resolution·initial_time·data_cutoff` 노출 → 프론트 #1 컴포넌트에 표기.

**엣지·리스크**: ⟢ 도→km는 **위도 의존**(경도 방향은 `×cos(lat)` 보정 필요, 111.32는 위도 방향만). manifest 없으면 기본값 폴백.
**검증**: `/api/kim/wind/index`에 `resolution·initial_time` 비-null. 툴팁 "KIMG/NE57 1.5×1.5km, run 12:00Z".

---

# B. 표시·리팩터 (#3, #5, #6)

## #3 데이터 없음 명시 — 중
**현황**
- 지원목록: `shared/airports.js:2-17`(`amos_stn` 비-null=지원; RKSI/RKSS/RKPC/RKJB/RKJY/RKPU/RKNY). ground forecast: `config.js:90-99`(8공항).
- 현재 미지원 시: `AmosTab.jsx:95` "AMOS 데이터 없음"(미지원/실패 구분 없음), `AirportInfoTab.jsx:12`, `CurrentWeatherTab` 하드코딩 메시지. **지원목록을 읽는 컴포넌트 없음.**

**정확한 변경**
1. `frontend/src/shared/airport-support.js`: `isAmosSupported(icao)`·`isGroundForecastSupported(icao)`(Set).
2. `shared/ui/UnsupportedDataChip.jsx`: `type='unsupported'(미수집)|'loading-failed'(일시 로드 실패)`.
3. AmosTab/AirportInfoTab/CurrentWeatherTab: **지원 체크 → 미지원이면 "미수집" 칩, 지원인데 없으면 "일시 로드 실패" 칩.**

**엣지·리스크**: ⟢ 프론트 하드코딩 목록은 **stale 위험** → 백엔드 `config.js`에서 **build-time 생성**하거나 `/api/meta/supported-airports` 엔드포인트 권장. 로딩중 vs 실패 구분하려면 `loading` prop 필요. 백엔드가 미지원=204 / 실패=500로 주면 프론트가 구분 가능.
**검증**: RKPK→"미수집", 지원공항 빈응답→"일시 로드 실패", 정상→칩 없음.

## #5 RVR 표면화 — S (거의 표시만)
**현황**
- AMOS RVR: `amosViewModel.js:122-133`(`formatRvrValue`), `:241-249`(runway별 RVR/MOR) → `AmosTab:125-134` 이미 표시.
- CurrentWeatherTab: `formatRvrSummary`(`currentWeatherViewModel.js:56-65`)로 **시정 카드 secondary 소문자**에만 → 눈에 안 띔.
- `metarViewModel.js`: RVR 미추출(obs.rvr 있으나 미사용).

**정확한 변경**
1. `buildRvrCard(amos, icao, airportMeta)`를 `currentWeatherViewModel.js`에 추가(AMOS runway별 RVR/MOR, `isRvrGood` 색).
2. `CurrentWeatherTab` MetarSummary `cardList`에 RVR 카드 추가(temperature 뒤, `.filter(Boolean)`).
3. RVR 카드 렌더(runway별 리스트) + 최소 CSS.
⟢ 소스는 **AMOS 우선**(runway별·포맷 풍부). METAR RVR은 v1 범위 밖.

**엣지·리스크**: AMOS 없으면 카드 null(안전). runway 라벨은 기존 기본값 처리. 카드 순서만 조정.
**검증**: RKSI→RVR 카드(2 runway), RKPK→카드 없음.

## #6 TAF 표시 일원화 — 중~대 (리팩터, **동작 변화 있음**)

> ⟢ **2026-07-05 심층조사 결정 (착수 전 필독) — 스펙의 "안전한 무동작 리팩터" 프레이밍은 틀렸다.**
> **판정 함수가 두 곳에서 실제로 갈린다(불일치 실재):**
> - 패널 `frontend/src/shared/weather/helpers.js:230 getFlightCategory` — 3단계(VFR/IFR/LIFR), 운고<1500→IFR, **공항별 미니마** 적용(미만이면 LIFR).
> - 브리핑 `backend/src/briefing/flight-category.js:2 categoryFor`(=`taf-window.js:34 stateCategory`가 호출) — 국제표준 4단계(**MVFR 포함**), 운고<1000→IFR, 미니마 없음.
> - **실증**: RKSI 시정 9km·운고 1400ft → 패널 **IFR** vs 브리핑 **MVFR**. 같은 관측, 다른 라벨.
>
> **사용자 도메인 결정: 「패널식 3단계 + 공항미니마」로 통일한다.**
> → 브리핑도 `getFlightCategory` 기준 채택: **MVFR 폐기**(3단계로), 운고컷 1500, **공항미니마 적용**. 브리핑 라벨이 바뀌므로 **before/after 육안(Playwright) 필수.**
>
> **착수 시 함정(이번 조사에서 발견):**
> 1. **런타임 경계**: 백엔드(Node)는 `frontend/src/shared/`를 import 못 한다. 통일하려면 3단계+미니마 판정 로직을 **양 런타임이 쓸 공용 형태**로 둬야 함(공용 패키지화 or 백엔드에 미러 + 단일 테이블). TAF core 분리(스펙 step1~3)와 **같은 경계 문제**.
> 2. **미니마 출처**: 패널 미니마는 사용자 SettingsModal(프론트 localStorage)에서 온다. 백엔드 브리핑은 사용자 커스텀을 모름 → 백엔드는 **`DEFAULT_AIRPORT_MINIMA_RULES`(helpers.js:155)** 기준만 적용 가능. "패널=사용자미니마 / 브리핑=기본미니마"로 여전히 갈릴 수 있음 — 이 한계를 결정할 것(기본으로 통일 or 클라이언트가 미니마를 briefing 요청에 실어보냄).
> 3. **MVFR 폐기 파급**: 브리핑의 `levelForCategory`·색·`periodRow`·`categoryTimeline`·4단계 가정 UI 전부 3단계로 정리.
> 4. `stateCategory` 단일화가 **핵심**이지만, 위 1·2 때문에 "완전 단일 모듈"이 아니라 "**단일 임계값·미니마 테이블을 양쪽이 공유**"가 현실적 목표.

**현황**
- 패널: `CurrentWeatherTab.TafSummary:284-354` ← `buildCompactTafModel`(`currentWeatherViewModel.js:128-169`) ← `buildTafViewModel`(`tafViewModel.js:87-95`).
- 브리핑 ④: `BriefingView.jsx:538-671` ← 백엔드 `taf-window.js:190-213 buildDestination`.
- **공유 코어 없음** — 타임라인 빌드가 프·백 각각 독립. ⟢ **핵심 문제: `stateCategory`가 두 곳(`taf-window.js:34-37` vs `tafViewModel.js:40-45`)에 중복** → 판정 불일치 위험.

**정확한 변경 (리팩터 구조)**
1. 프론트 `shared/taf/tafCoreModel.js`(~80줄): `buildTafCore(taf,icao)` — 타임라인→slots, **필터 안 함**(호출자가 필터). `tafSlotView`·`stateCategory` 이관.
2. 패널 `buildCompactTafModel`은 `buildTafCore` 호출 후 now+6h 필터(시그니처 유지 → 기존 테스트 통과).
3. 백엔드 `taf-core-builder.js`(~20줄): `buildTafTimeline(taf)` — `buildDestination`이 인라인 타임라인 대신 호출.
4. **컴포넌트 props 변경 없음.** 각 표면의 필터/표시 로직은 **독립 유지**(패널=전체·뷰전환, 브리핑=ETA강조·읽기전용).

**엣지·리스크**: ⟢ **최우선 = `stateCategory` 단일화**(두 구현 통일). 필터는 표면별로 남김(now+6h vs ETA±). 타임존(UTC↔KST) 일관성. 기존 `buildCompactTafModel` 시그니처 유지로 회귀 방지.
**검증**: 패널 TAF 6슬롯 수, 브리핑 ④ 전체 기간+ETA 하이라이트, 타임존 스왑.

---

# C. NOTAM 필터 · PDF (#12, #14)

## #12 NOTAM 고도대역 필터 + 관련도 랭킹 — S~중
**현황**
- 파서 고도 **이미 있음**: `notam-parser.js:86` `{lower,upper,unit('FL'|'FT'),ref('AMSL'|'AGL'|null)}`. FL→FT 정규화됨.
- 3D 매칭 **이미 있음**: `hazard-matcher.js classifyEncounter`(계획고도 범위 교차).
- 필터 현황: `NotamPanel.jsx:108-112` 카테고리+위치만. `notamViewModel.js:39-48` `formatAltitude`가 AGL/AMSL 라벨 표시.

**정확한 변경**
1. `NotamPanel`에 **고도 기준면 셀렉트**(무관심/AGL/AMSL) + predicate(`item.altitude?.ref` 기준). useMemo 의존성에 추가.
2. `notamViewModel.js`에 `NOTAM_SEVERITY`(prohibited3>restricted/danger/firing2>obstacle/facility1>other0) + `sortByRelevance`(1차 시간상태, 2차 심각도).

**엣지·리스크**: ⟢ **AGL↔AMSL 정밀 비교는 v1 범위 밖** — 계획고도=MSL, NOTAM=AGL이면 정확 비교엔 **공항표고 필요**. v1은 "기준면 선택으로 표시 필터"만(사용자가 ref 골라 봄), 실제 고도교차 판정은 기존 `hazard-matcher`(브리핑) 사용. 고도 없는 NOTAM은 모든 필터 통과. FL/FT 정규화 확인.
**검증**: 기준면별 필터 상태 유지, prohibited가 obstacle보다 상위 정렬.

## #14 브리핑 PDF 내보내기/인쇄 — S
**현황**
- `BriefingView.jsx`: `.briefing-view`(우측 패널) / `.bv-scroll` / `.bv-section`(①~⑥) / sticky nav. **`@media print` 없음**(`BriefingView.css`).

**정확한 변경**
1. `.bv-navwrap`에 **[인쇄/저장] 버튼**(`window.print()`, lucide `Download`).
2. `BriefingView.css`에 **`@media print`**: `.bv-collapse-tab/.bv-navwrap/.bv-layer-action/버튼` 숨김; `.briefing-view{position:static;width:100%}`; `.bv-scroll{height:auto;overflow:visible}`; `.bv-section{break-inside:avoid}`; `@page{size:A4;margin:0.75in}`; `body{color:#000;background:white}`(다크모드 강제 라이트); svg/table break-inside 회피.
3. **출처 스탬프**: 컨테이너 `data-print-footer`(발표시각·경로·소스) + `::before`로 첫 페이지 표기. (#1 메타 연계.)

**엣지·리스크**: SVG(단면도) 네이티브 인쇄 OK. 긴 섹션은 페이지 분할 허용. 다크모드 강제 라이트. **Puppeteer/서버 PDF 불필요**(브라우저 내장, 사용자 개시, 드묾).
**검증**: Chrome+Firefox 인쇄 미리보기 — 버튼·숨김·A4·페이지분할·스탬프·표 가독성. Save as PDF.

---

# D. 접근 최저치 (#8) — 중, ⚠️ 정확성·라이선스 선결

## #8 접근 최저치(라이트) + 카테고리 자동대조
**현황**
- 사용자 미니마(별개): `helpers.js:155-171` `DEFAULT_AIRPORT_MINIMA_RULES`(공항별 ceilingFt/visibilityM), SettingsModal 저장. **이것과 혼동 금지.**
- 판정 재사용: `flight-category.js:2-26 categoryFor`, `airport-summary.js:51-80 summarizeAirport`.
- IAP 데이터: `procedureData.js:3-20`(SID/STAR만), `public/data/navdata/procedures/*-representative-iap-routes.json`(IAP id 매핑만, **최저치 없음**).

**데이터 모델** — 공항별 `{airport}-approach-minima.json`(IAP 옆):
```
approaches[]: { id, runway, type('ILS CAT III B'|'RNAV (GNSS)'|'PAR'…),
  minima[]: { category('A'~'D'), daFt|mdaFt, rvrM, visibilityM, notes } }
metadata: { airport, cycle('AIRAC 2025-08-21'), licenseNote }
```

**통합**
1. `backend/src/briefing/approach-minima.js`: `loadApproachMinima(airport)`(정적 JSON 캐시) + `evaluateMinimaCompliance(...)` → GO/한계/불가.
2. `airport-summary.js`에 `approachMinima[]` 필드 주입(공항별 runway·type·카테고리별 판정). `composeBriefing` async화.
3. 프론트 `procedureData.js`에 `getApproachMinima(airport)`, 목적지 섹션(④)에 "접근 최저치 대조" 표(runway별 GO/한계/불가, 카테고리 접기, `--level-*` 색).

**⟢ 정확성 선결 (에이전트 제안의 오류 교정 — 착수 전 필수)**
- **DA/MDA는 AMSL, METAR 운고(ceiling)는 AGL.** `ceil >= mdaFt` 직접 비교는 **틀림.** → 비교 전 **공항표고(field elevation)를 빼서** "문턱 위 높이"로 변환하거나, 운고(AGL)를 AMSL로 올려 비교해야 함. 공항표고 데이터 필요.
- **"한계" 마진(0.8×RVR, MDA−50)은 임의값** — 규정 근거 없음. 실제 판정 기준을 도메인 확인 후 확정(그 전엔 GO/불가만이라도).
- 단위: RVR/시정 m 통일.

**소싱·갱신·라이선스**
- KOCA eAIP(aim.koca.go.kr) 공항별 AD-2 접근차트 표에서 **수작업 전사**(공항 8개+α, AIRAC 28일 주기 사람이 점검·커밋).
- ⚠️ **라이선스 게이트(선결)**: 한국 AIP는 KOCA 정책상 운영목적·비상업·재배포 제한 가능 → **도구 탑재 가능 여부 서면 확인 후 착수.** JSON metadata에 licenseNote. 공개 레포에 올리지 말 것.

**검증**: `evaluateMinimaCompliance` 경계 유닛테스트(단, **위 고도 보정 반영 후**), `/api/route-briefing` 응답 `.airports[arr].approachMinima[]`, eAIP 실값 대조.

---

## 공통 선행 / 착수 전 체크
- **선확인 3건**: #2 상류 원본 TAC 제공 여부(아카이빙용), #4 KIM cutoff 실제값+km 위도보정, #8 **KOCA 라이선스**.
- **정확성 선결**: #8 고도 AMSL/AGL 보정·"한계" 기준 확정(그 전 빌드 금지).
- **묶어서 이득**: #1·#4(공용 `DataProvenance`), #5·#6(표시 리팩터).
- 전부 design-language 토큰·기존 컴포넌트 재사용. 새 npm 없음(#8 데이터 전사 제외).
