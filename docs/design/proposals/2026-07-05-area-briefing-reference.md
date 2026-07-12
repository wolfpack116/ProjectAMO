# 지역(폴리곤) 기상 브리핑(#15) — 구현 참조

> 상태: **구현 참조(reference)** — [운영 기능 확장 초안](2026-07-04-operational-features-draft.md) #15의 상세 설계.
> 기능: 사용자가 **영역을 지정**(직접 그리기 or 관제섹터 선택)하면, 그 안의 모든 기상·항공 요소를 **한 패널로 요약 브리핑**.
> 근거: 2026-07-05 병렬 리서치 3건(외부 선례 GFA/ForeFlight/SkyDemon · 코드 구현 검토 · 표시 항목). 대상: 예보관(주)·디스패처·조종사.

---

## 0. 범위 (v1 / v2)
- **v1(지금)**: 영역 지정(그리기+섹터선택) + **벡터 요소** 브리핑(METAR/TAF/SIGMET/AIRMET/NOTAM/공역/낙뢰/공항).
- **v2(차후)**: **래스터·격자** 면적통계(레이더 커버리지%, KIM 바람·기온·착빙 min/max, KTG 난류, 비행카테고리 면적비) — 격자 샘플러 필요, 미룸.

---

## 1. 영역 선택 — 2모드 (둘 다 구현)

### (A) 직접 그리기
- **폴리곤**: 지도에 점 찍어 다각형(더블클릭/Enter로 완료, Esc 취소).
- **원**: 중심(공항 또는 클릭) + 반경(NM) → 프론트에서 원을 폴리곤으로 변환.

### (B) 관제섹터 선택 (복수 가능) ★
- `frontend/public/data/sectors.geojson`에서 섹터를 **여러 개 탭** → 선택한 섹터들의 합집합이 영역.
- **합집합 처리(단순)**: 기하 union 계산 안 함. 선택 섹터들을 **MultiPolygon으로 묶어** 보내고, "어떤 섹터 하나에라도 들면 영역 안"으로 OR 판정 → union 라이브러리 불필요.

### 공통 — 프론트가 모든 모드를 하나의 geometry로 해석
```
그리기 폴리곤 → Polygon
원            → Polygon(원→다각형 변환)
섹터 다중선택 → MultiPolygon(선택 섹터들)
```
→ **백엔드는 항상 `area: Polygon|MultiPolygon` 하나만** 받음(모드 무관, 균일).

---

## 2. 표시 요소 — 6섹션 (v1 벡터)

| # | 섹션 | 영역용으로 무엇을 |
|---|---|---|
| ① | **개황·카테고리** | 영역 내 **최악 비행카테고리** 배지 + 영향 공항 수("8곳 중 3곳 IFR") + 자료시각 + 영역 크기 |
| ② | **위험현상** | SIGMET/AIRMET을 **현상별**(착빙·난류·뇌우·시어) + 고도대(FL) + 유효시각 + 개수 배지 |
| ③ | **공항 현황** | 영역 내 공항 **최악순 정렬** 표(카테고리·운고·시정·현상·TAF추세). 행 클릭→상세 |
| ④ | **NOTAM·공역** | NOTAM 유형별 그룹(활주로·항법시설·공역) + 금지/위험/제한구역 저촉 + 개수 배지 |
| ⑤ | **상층·바람** | v1: **영역 중심점 샘플**(FL별 바람, 결빙고도). 격자 평균은 v2 |
| ⑥ | **관측** | 낙뢰 개수(10분/30분), 레이더 에코 유무. 커버리지%는 v2 |

**리더별 강조**(같은 데이터, 정렬만): 예보관=②위험현상·원자료 / 디스패처=③공항·④NOTAM go-nogo / 조종사=①카테고리·내 고도대 위험.

---

## 3. 표시 방식 — "데이터 덤프 금지" (GFA 패턴)

1. **최악 먼저** — 상단에 위험현상+최악 카테고리. 영역 대푯값은 평균 아닌 **최소 운고·시정**(가장 나쁜 것) → 위험 숨김 방지.
2. **개수 배지 + 접기** — "SIGMET 3 ▾"처럼 개수만, 클릭 시 펼침(기본 접힘).
3. **필터 토글** — "IFR 이하만" / "내 고도대만" / "위험만".
4. **클릭 → 상세** — 공항행=기존 공항패널, NOTAM=기존 `NotamCell`, SIGMET=상세 팝업.
5. **레이아웃** — 브리핑형 별도 패널(우측/시트). 섹션 카드 세로 스택, 데스크톱은 2열.

---

## 4. 백엔드 구현

### 재사용 (이미 있음)
| 파일 | 역할 |
|---|---|
| `geo-time-match.js` | `pointInPolygon`(공항·낙뢰 바로), `routeIntervalInGeometry`(선∩폴리곤), `timeWindowsOverlap` |
| `hazard-section.js` | `matchItems`·위험 레벨·정렬 → 경로축 대신 영역으로 |
| `notam-briefing.js` | NOTAM 시간·기하 매칭 → 폴리곤으로 |
| `airspace-zones.js` | 금지/위험/제한구역 로드(이미 GeoJSON→아이템). **섹터 로드도 같은 패턴** |
| `briefing-composer.js` | 브리핑 조립 패턴 → 영역 페이로드로 |

### 신규
- **엔드포인트**: `POST /api/area-briefing`
```
Body: { area: Polygon|MultiPolygon, time?: {from,to}, layerIds?: [...], altitudeBand?: {lower,upper} }
Resp: { meta, summary:[{key,label,level,count}], sections:{ hazards, airports, notam, airspace, lightning, upperAir, raster:null } }
```
- **매칭 로직**: 각 요소를 `area`와 교차 판정. 포인트(공항·낙뢰)=`pointInPolygon`. **폴리곤(SIGMET/AIRMET/NOTAM/공역)=polygon∩polygon** → 지금 없음.
- ⚠️ **polygon∩polygon 신규**: `@turf/boolean-intersects` 도입 권장(작고 검증됨, 직접 짜면 버그 위험). MultiPolygon은 각 서브폴리곤에 OR.
- **최악값 계산**: 영역 내 공항 METAR로 `min(ceiling)`, `min(vis)`, 최악 카테고리 산출(기존 `flight-category.js` 재사용).

---

## 5. 프론트 구현 (ADR 0001 준수)

새 feature 모듈 — MapView 손대지 않고 `useXOverlay` 훅으로(ADR 0001).
```
frontend/src/features/area-briefing/
├── AreaBriefingPanel.jsx      // 패널: 영역 지정 UI + 결과
├── AreaBriefingResults.jsx    // 6섹션 결과 뷰
├── useAreaSelection.js        // 그리기/원/섹터선택 상태 → area geometry 해석
├── usePolygonCapture.js       // Mapbox 이벤트로 폴리곤 직접 캡처(신규 의존성 0)
├── useAreaBriefing.js         // fetch + 상태
└── lib/areaBriefingModel.js   // 순수 뷰모델(정렬·필터·색·최악값)
```
- **폴리곤 캡처**: `mapbox-gl-draw` 대신 **Mapbox 클릭 이벤트로 직접**(임시 GeoJSON 소스+레이어 미리보기). 신규 의존성 없음.
- **섹터 선택**: `sectors.geojson`를 레이어로 띄우고 클릭 토글(선택 하이라이트, 복수).
- **원**: 중심+반경 입력 → 폴리곤 변환.
- **요소 체크리스트**: `layerActions.js` 레지스트리 재사용(어떤 요소 포함할지).
- **결과 재사용**: `BriefingBanner`(최악 배지), `NotamCell`, 공항패널 탭 스타일, `WeatherLayerTimestampBar`(자료시각).
- **API**: `frontend/src/api/areaApi.js`(기존 `briefingApi.js` 패턴).

---

## 6. 요소별 v1/v2

| 요소 | 형태 | v1 | 매칭 |
|---|---|:--:|---|
| METAR/TAF(공항) | 포인트 | ✅ | pointInPolygon + 최악순 |
| SIGMET/AIRMET | 폴리곤 | ✅ | polygon∩polygon(turf) |
| NOTAM | 점/선/폴리곤 | ✅ | 기존 매처 + 폴리곤 |
| 공역(금지/위험/제한) | 폴리곤 | ✅ | `airspace-zones` 재사용 |
| 낙뢰 | 포인트 | ✅ | pointInPolygon |
| 레이더/위성 | 래스터 | ✗ v2 | 픽셀 샘플링 |
| KIM 바람/기온/착빙 | 격자 | ✗ v2 | 격자 보간 |
| KTG 난류 | 격자 | ✗ v2 | 격자 샘플 |
| 비행카테고리 | 래스터 | ✗ v2 | 셀 분류 |

---

## 7. 재사용/신규 + 의존성
- **재사용**: `geo-time-match`·`hazard-section`·`notam-briefing`·`airspace-zones`·`briefing-composer`(백) · `BriefingBanner`·`NotamCell`·`layerActions`·공항패널(프론트).
- **신규 의존성**: **`@turf/boolean-intersects`**(폴리곤 교차) + (원 변환용 `@turf/circle` 또는 수동). 그 외 신규 npm 없음(폴리곤 캡처는 Mapbox 네이티브).
- **신규 코드**: `/api/area-briefing` 라우트, area-briefing 프론트 모듈.

---

## 8. 구현 단계 (v1 체크리스트, ~20h)
1. **`geometryIntersectsGeometry`**(turf) + `featuresInPolygon` 래퍼(geo-time-match 확장).
2. **`POST /api/area-briefing`** — 벡터 요소 수집·최악값 산출(briefing-composer 패턴).
3. **영역 선택 UI** — 폴리곤 캡처 + 원 + **섹터 다중선택**(sectors.geojson).
4. **결과 패널** — 6섹션(개수배지·접기·최악순·필터), 기존 컴포넌트 재사용.
5. **요소 체크리스트**(layerActions) + 지도 하이라이트 토글.
6. 사이드바/모바일 진입 등록.

---

## 9. v1 갭 & 결정
**v1 갭(차후):** 래스터/격자 면적통계(v2), 관심영역 저장/재사용, #13 알림 연계("이 구역 감시"), 타임라인 스크러버 연동.
**결정(권장):**
- 시간 기준: v1 **"지금" 기본**(스크러버 연동은 차후).
- polygon∩polygon: **`@turf/boolean-intersects` 도입 OK로 진행**.
- 섹터 합집합: **union 계산 없이 OR 판정**(라이브러리 불필요).
- 사전정의 소스: v1은 **관제섹터(sectors)** 우선. FIR/TMA/CTR/행정구역은 같은 방식으로 나중에 추가 가능(데이터 이미 있음).

---

## 10. 참고
- GFA(aviationweather.gov) 4단 구조·최악값·현상별 그룹 / ForeFlight·SkyDemon 영역 브리핑.
- 관련: [운영 기능 확장 초안 #15](2026-07-04-operational-features-draft.md) · ADR [0001-mapview-layer-gravity](../../adr/0001-mapview-layer-gravity.md).
