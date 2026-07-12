# 지도 기반 대시보드 디자인 레퍼런스 — 통합 보고서

> **문제 정의:** 시중의 "디자인 베끼기" 조언은 거의 다 **SaaS 랜딩페이지**용이다. 하지만 이 프로젝트는 **지도 위에 패널·범례·타임슬라이더·위험(hazard) 리본·단면도가 얹힌 항공 기상 브리핑 대시보드** = "운영/관제(operational/geospatial) 대시보드" 장르다. 장르가 다르니 **베끼는 대상도, 베끼는 방법도** 달라야 한다.
>
> 4개 트랙 병렬 리서치(① 항공·기상 UI ② 운영 지도 대시보드 ③ 지오공간 툴·디자인시스템 ④ 비주얼 레퍼런스 큐레이션)를 통합했다. 조사일: 2026-06-27.

---

## 0. 핵심 결론 3줄

1. **통째로 베끼지 말고 "패턴"을 베껴라.** 지도는 당신 데이터가 결정하는 캔버스라 스크린샷 복사가 불가능하다. 대신 ▲패널 배치 ▲범례·타임슬라이더 ▲위험 표출 ▲베이스맵 후퇴 — 이 *조각*들을 베낀다.
2. **당신과 DNA가 가장 가까운 단 하나는 [aviationweather.gov GFA](https://aviationweather.gov/gfa/).** 위험 색코딩 + 시간 슬라이더 + **별도 고도(FL) 슬라이더** + **항로 단면도**까지, 필요한 모든 요소를 운영급으로 구현해 둔 "정답지"다.
3. **역할 분담:** 구조·위험규칙·단면·고도는 **GFA** / 색 일관성은 **ForeFlight** / 미감·범례·picker는 **Windy·Ventusky** / 정보밀도는 **Bloomberg·Datadog** / 실제 구현 패턴은 **Mobbin**.

---

## 1. 왜 SaaS 베끼기가 여기선 안 통하나

| | SaaS 랜딩페이지 | 지도 대시보드 (당신) |
|---|---|---|
| 디자인의 핵심 | **레이아웃 자체**가 디자인 | **데이터를 읽히게** 하는 게 디자인 |
| 베끼는 법 | 스크린샷 통째로 따라하기 가능 | 불가능 — 지도는 데이터가 결정 |
| 색의 역할 | 감성·브랜딩 | **의미**(위험=빨강). 장식색은 독 |
| 우선순위 | "와우" 감성 | **0.5초 판독성** (조종사가 위험을 즉시 읽어야) |
| 영감 출처 | Dribbble "SaaS landing" | 실제 항공·관제 제품 + 데이터밀도 에세이 |

> **그래서 베끼는 대상은 "화면"이 아니라 "패턴"이다:** 지도 위 패널 배치, 정보 밀도 정리, 레이어 토글·시간축·범례 위치, 베이스맵을 죽여서 데이터를 띄우는 법.

---

## 2. 도메인 직격 레퍼런스 — 항공·기상 (1순위로 뜯어볼 것)

이미 검증된 상업 제품들이라 "정답지"다.

### ⭐ AWC GFA (Graphical Forecasts for Aviation) — 당신의 1:1 벤치마크
[aviationweather.gov/gfa](https://aviationweather.gov/gfa/) · [도움말](https://aviationweather.gov/gfa/help/)
- **베이스맵 12종 + 불투명도 슬라이더.** 기본 "Dark Grey"(육지 회색/바다 검정) — **데이터를 띄우려고 베이스맵을 일부러 죽인다.** 항공 차트(VFR/IFR)도 베이스맵으로 선택 가능.
- **레이어 2단 분리:** "Weather"(관측·예보) vs "Products"(예보관 발령 경보: SIGMET·G-AIRMET·CWA) — **출처별로 분리**.
- **시간 슬라이더 = 하단**, 유효시각(UTC) 표시, 현재시각은 **주황색** 마킹. 모바일은 back/now/forward로 축약.
- **고도 전용 슬라이더가 별도로 존재** — 착빙/난류 같은 고도 의존 레이어를 켜면 등장. FL300까지 3,000ft 간격. **"MAX"(전 고도 최댓값)** 옵션이 압권.
- **Cross Section:** 항로(공항·픽스·VOR) 입력 → 지도에 분홍 선 → 세로축=고도, 가로축=경유지 단면도. **지도와 단면도가 시간축을 공유**해 같이 움직인다.
- **위험 표출:** Flight Category는 **VFR=투명(정상은 안 그림)**, 위험할수록 진하게. 착빙은 색 단계 + **SLD는 빨간 빗금(해칭)**으로 2차 위험을 패턴으로 중첩.

### ForeFlight — 색 일관성의 교과서
[제품](https://www.foreflight.com/products/foreflight-mobile/weather/) · [범례 가이드 PDF](https://cloudfront.foreflight.com/docs/ff/14.10/Foreflight%20Legends%20Guide%20v14.10.pdf)
- **색의 의미를 축마다 분리:** METAR 신뢰도/나이는 한 팔레트, Flight Category는 다른 팔레트, 상층풍은 또 다른 색. **한 색 = 한 의미.**
- **색 스케일 3중 동기화:** 착빙/난류를 (a)맵 (b)단면(Profile) (c)3D 미리보기 세 뷰에서 **완전히 동일한 색 스케일**로. 뷰를 바꿔도 "빨강=심함"이 불변 → 학습비용 0.

### Windy.com — 미감 + 범례/타임라인의 대중 표준
[windy.com](https://www.windy.com/) · [컬러설정](https://www.windy.com/colors) · [API 구조 문서](https://api.windy.com/map-forecast/docs)
- **picker** = 지도 위 한 점에 호버하면 그 지점 격자값을 읽어줌. **NetCDF 격자를 다루는 당신에게 거의 필수.**
- 범례를 **타임슬라이더 바로 아래** 붙여 시선 이동 최소화. 활성 레이어 따라 단위 변경.

### 그 외 (각각 한 가지씩 훔칠 것)
- **Ventusky** ([ventusky.com](https://www.ventusky.com/)) — **좌:요소 / 우:타임라인 / 중앙:지도** 3분할 골격. "장식보다 데이터 렌더링" 철학.
- **Zoom Earth** ([zoom.earth](https://zoom.earth/)) — **접이식 레이어 패널**(지도 면적 확보) + 레이더 전용 다크 베이스맵.
- **Tomorrow.io** ([제품](https://www.tomorrow.io/weather-intelligence-platform/)) — **타임라인 위에 위험 이벤트를 마킹** = 당신의 **hazard ribbon과 똑같은 발상**("리본 = 시간축 위 위험 막대").
- **Garmin Pilot** ([기상솔루션](https://www.garmin.com/en-US/c/aviation/weather-solutions/)) — 단면도에 **계획 항적·계획 고도선을 기준선**으로 깔고 위험을 얹기. 폭풍 셀 예측 경로(15/30/45/60분).
- **SkyVector** ([skyvector.com](https://skyvector.com/)) — **항공 차트를 베이스맵 옵션**으로(도로지도보다 섹셔널이 더 읽힘).
- **MyRadar** — 위험 **종류는 해칭 패턴, 심각도는 색**으로 분리(2차원 인코딩).

### 한국 레퍼런스 (국내 용어·색 관례)
- **항공기상청(AMO) 항공날씨정보** [amo.kma.go.kr](https://amo.kma.go.kr/weather/image/radar.do) — 국내 항공 특화 표출 관례.
- **기상청 날씨누리 날씨지도** [weather.go.kr](https://www.weather.go.kr/wgis-nuri/html/map.html) — **같은 데이터를 지도/그래프/표 3모드로 전환**하는 패턴.

---

## 3. 인접 장르 — 운영/관제 대시보드 (정보 밀도·패널 배치)

지도+패널을 잘 푼 비(非)기상 제품에서 레이아웃·밀도를 배운다.

- **Flightradar24** ([live](https://www.flightradar24.com/)) — **컨트롤을 가장자리로 몰아 지도를 비운다**(우측 세로 + 하단 바). 풀스크린 2단계.
- **MarineTraffic** ([live map](https://support.marinetraffic.com/en/articles/9552654-live-map)) — **2단 디테일 드릴다운**: 지도 위 가벼운 인포 윈도우(요약) → "상세" 클릭 시 풀 패널. 패널을 처음부터 무겁게 만들지 마라.
- **FlightAware** — ⭐ [카토그래퍼의 베이스맵 설계 글(필독)](https://andywoodruff.com/posts/2024/flightaware-maps/). **"베이스맵은 후퇴, 데이터는 전진."** 배경 도로/라벨 끄고, 색 대비는 오직 데이터 오버레이에만. 줌 레벨별 점진 노출.
- **Uber/물류 ops** ([fleet UI 가이드](https://hicronsoftware.com/blog/fleet-management-dashboard-ui-design/)) — **엔티티 상태 = 색+텍스트 배지(enum)**, 마커 색을 상태에 바인딩.
- **NOC/미션컨트롤** ([NOC 모니터링](https://www.manageengine.com/network-monitoring/noc-monitoring.html)) — **평상시 무채색, 이상치만 색.** 색이 곧 알람.
- **Bloomberg 터미널** ([UX 글](https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity/)) — **"숨기지 말고 정렬하라."** 서브메뉴로 감추지 말고 다 보여주되 키보드·즉시로딩으로 밀도를 높여라. **live/stale/loading 3상태를 반드시 디자인.**
- **Datadog/Grafana** ([Grafana 베스트프랙티스](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)) — 패널을 **group으로 묶고**, 패널마다 의미있는 타이틀·단위. 가장 중요한 건 **좌상단**. 카드 대신 dense 테이블.

### 지도 UI 패턴 카탈로그 (북마크)
- **[Map UI Patterns](https://mapuipatterns.com/)** — Info panel / Legend / Layer list / Timeline slider / **Data dimming**(무관 데이터 흐리게) 등 패턴 사전.
- **[Esri: Docked vs Floating 패널](https://www.esri.com/arcgis-blog/products/arcgis-storymaps/mapping/employing-and-enjoying-sidecars-docked-and-floating-panel-layouts)** — Docked는 복잡한 오버레이에 적합, Floating은 데스크톱 몰입엔 좋지만 **모바일에선 지도를 덮는다** → bottom-sheet 대비책 필수.

### 정보 밀도 설계 에세이 (이 장르의 바이블)
- ⭐ **[Matt Ström — UI Density](https://matthewstrom.com/writing/ui-density/)** — 밀도를 visual/information/**value** density로 분해. "value density = 가치 ÷ 시간·공간." 로딩 속도가 화면당 정보량보다 중요할 때가 많다.
- **[Dense Interfaces Are Back (2026)](https://mydesigner.gg/blog/dense-interfaces-information-hierarchy-2026)** — "Dense ≠ cluttered, 차이는 정보 위계." 핵심 지표는 ≤1클릭.
- **[Dense data를 엑셀로 안 만들기](https://uxtbe.medium.com/designing-ui-for-dense-data-without-turning-the-screen-into-an-excel-spreadsheet-bad61c3c5cae)** — **델타+스파크라인**을 raw 값보다 강조. 적·황색은 진짜 이상치에만(아니면 "색 면역" 생김).

---

## 4. 기술 스택 — 이 화면을 실제로 만드는 도구

> **현업 표준 구조:** 베이스맵은 **MapLibre**가 깔고, 대용량 데이터 레이어는 **deck.gl**이 그 위에 GPU로 그린다.

### 렌더링 코어
- **MapLibre GL JS** ([링크](https://maplibre.org/projects/gl-js/)) — 무료/오픈소스 벡터타일 베이스맵. **베이스맵의 기본 선택**(Mapbox는 MAU 과금 부담).
- **deck.gl** ([deck.gl](https://deck.gl/)) — GPU 기반 **대용량 레이어 엔진**(수십만 포인트도 즉시). ContourLayer(등치선)·HeatmapLayer·ScatterplotLayer 등. [MapLibre와 interleaved 통합](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre).
- **react-map-gl** ([링크](https://visgl.github.io/react-map-gl/)) — React에서 `<Map>` + `<DeckGL>` 카메라 동기화.
- **kepler.gl** ([kepler.gl](https://kepler.gl/)) — 레이어 구성·컬러맵을 **먼저 프로토타이핑**으로 검증 → deck.gl로 직접 구현.

### 베이스맵 스타일 ("데이터 후퇴형"으로)
- **CARTO Dark Matter / Positron** ([github](https://github.com/CartoDB/basemap-styles)) — 데이터 시각화 전용 절제 스타일. **다크 대시보드 1순위 기본값.**
- **Protomaps (PMTiles)** ([docs](https://docs.protomaps.com/basemaps/maplibre)) — **자체 호스팅 + 거의 무료**(단일 파일). 내부 대시보드에 타일 백엔드 없이 다크맵.
- **Maputnik** ([maputnik](https://maplibre.org/maputnik/)) — 비주얼 스타일 에디터. CARTO/Protomaps 스타일을 가져와 **라벨 줄이고 채도 낮춰** 데이터용으로 커스터마이즈.
- 원칙: desaturate + 라벨 최소화 → 데이터가 발광하도록.

### 컬러맵 (⚠️ rainbow/jet 금지)
jet은 지각 비균일 + 색각이상에서 모호 → **위험 오판** 위험. 대신:
- 강도/확률 → **viridis/cividis** ([viridis](https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html))
- 편차/이상 → **ColorBrewer diverging** ([colorbrewer2](https://colorbrewer2.org/))
- 기상 도메인 변수 → **cmocean** ([cmocean](https://matplotlib.org/cmocean/))
- **색만으로 등급 구분 금지** — 명도 차 + 범례 + 패턴(해칭) 병행.

### 기상 데이터 레이어 & 파이프라인
- **WeatherLayers GL** ([docs](https://docs.weatherlayers.com/weatherlayers-gl)) — deck.gl용 기상 레이어: 라스터/등치선/고저기압/**바람 입자 애니메이션**. 바람장·등치선 1순위.
- 파이프라인: **NetCDF/GRIB2 → (서버) TiTiler/COG 또는 Zarr로 전처리 → (클라이언트) WeatherLayers GL, 색칠은 WebGL 셰이더**에서 위 컬러맵으로. ([MapTiler WebGL 기상](https://www.maptiler.com/news/2021/05/visualize-weather-forecast-with-webgl/))

### UI 패널/크롬
- **shadcn/ui** ([ui.shadcn.com](https://ui.shadcn.com/)) — 플로팅 패널·다이얼로그·탭의 셸.
- **Tremor** ([tremor.so](https://www.tremor.so/)) — KPI 카드·미니차트·범례 박스.
- **Radix Slider** → 타임/고도 슬라이더, **Collapsible** → 접이식 패널.
- 지도 옆 차트(시계열·고도 프로파일) → **Observable Plot** ([plot](https://observablehq.com/plot/)).

---

## 5. 비주얼 레퍼런스를 "찾는 법" (검색어가 핵심)

`dashboard`라고 치면 SaaS만 나온다. 아래 검색어·링크를 써라.

### 실제 제품 (정보구조의 진실 — 1순위)
- **Mobbin** ⭐ — [web/screens/map](https://mobbin.com/explore/web/screens/map)(데스크톱 관제), [mobile/screens/map](https://mobbin.com/explore/mobile/screens/map), [Maps & Navigation](https://mobbin.com/explore/mobile/app-categories/maps-navigation). 실제 출시 앱이라 구현 가능.
- **Refero** — [refero.design](https://refero.design), [대시보드 프롬프트](https://styles.refero.design/ai-agents/dashboard-design-prompts).
- **Page Flows** — [Carrot Weather 플로우 영상](https://pageflows.com/ios/products/carrot-weather/).

### 컨셉/비주얼 톤 (⚠️ Dribbble은 구현 불가 컨셉 아트 많음 — 색/구도만)
- Dribbble: [map-dashboard](https://dribbble.com/search/map-dashboard) · [map-data-visualization](https://dribbble.com/search/map-data-visualization) · 태그 [geospatial](https://dribbble.com/tags/geospatial) · [command_center](https://dribbble.com/tags/command_center)
- Behance(케이스스터디): [monitoring dashboard](https://www.behance.net/search/projects/monitoring%20dashboard) · [telemetry](https://www.behance.net/search/projects/telemetry)
- Awwwards: [Maps/Geolocation 컬렉션](https://www.awwwards.com/awwwards/collections/maps-geolocation-streetview/)
- Pinterest(스와이프 파일 축적): [Map dashboard UI](https://www.pinterest.com/ielleenk/map-dashboard-ui/) · [Control Room](https://www.pinterest.com/guerinadrien/design-ui-control-room/)

### 한국어
- 노트폴리오 [notefolio.net](https://notefolio.net)(검색: 관제·모니터링·지도 UI)
- 위시켓 관제 대시보드 [예시1](https://www.wishket.com/project/150581/)(국내 현업이 실제 원하는 것)
- Pinterest 한국 [GIS 보드](https://www.pinterest.co.kr/ayhong12/gis/)

### 검색어 풀 (어디든 붙여넣기)
`map dashboard` · `geospatial dashboard` · `command center` · `control room` · `monitoring dashboard` · `telemetry dashboard` · `fleet tracking` · `air traffic` · `radar UI` · `aviation UI` · `GIS interface`
한글: `관제 대시보드` · `모니터링 시스템 UI` · `지도 대시보드` · `상황판 UI` · `통합관제센터`

> **균형:** 영감 50%(Dribbble/Awwwards) + 실제 패턴 50%(Mobbin/Refero/Page Flows). Dribbble 샷은 가짜 데이터 밀도·일러스트 맵이라 그대로 만들면 깨진다.

### 스와이프 파일은 "컴포넌트 단위"로 쪼개라
전체 화면 말고 8개 보드로: ①베이스맵·레이어토글 ②사이드 패널/디테일 드로어 ③범례·색스케일 ④타임슬라이더·재생 ⑤Hazard/Alert 표시 ⑥상단 상태바/KPI(당신의 ETD→ETA 헤더와 직결) ⑦마커·클러스터·궤적 ⑧데이터테이블↔지도 연동.

---

## 6. 이 프로젝트가 지금 당장 훔칠 패턴 TOP 12

위험·단면·고도가 핵심인 당신 케이스에 맞춰 우선순위로 정렬:

1. **hazard ribbon = 타임라인 위 위험 막대** — 위험 구간 시작/끝을 시간축에 마킹. (Tomorrow.io)
2. **2차원 인코딩: 심각도=색, 위험 종류/2차위험=해칭(빗금)** — 착빙 색 + SLD 빨간 빗금. (GFA/MyRadar/SPC)
3. **시간 슬라이더 + 별도 고도(FL) 슬라이더 2개**, "MAX/전고도 최댓값" 옵션. (GFA)
4. **지도 ↔ 단면도 시간축 완전 동기화** (세로축=고도, 가로축=경유지). (GFA)
5. **모든 뷰가 단 하나의 색 스케일 공유** — 맵·단면·3D 어디서나 "빨강=심함" 불변. (ForeFlight)
6. **색의 의미를 축마다 분리** — 데이터 나이 ≠ 심각도 ≠ 풍속, 각각 다른 팔레트. (ForeFlight)
7. **정상=투명/비움, 위험할수록 채움** — 화면에 칠해진 건 곧 주의 신호. (GFA)
8. **베이스맵은 후퇴, 데이터는 전진** — CARTO Dark Matter + 채도↓ + 라벨↓ + 불투명도 슬라이더. (FlightAware/GFA)
9. **picker(호버 격자값 인스펙터)** — NetCDF 격자 정확값 확인. (Windy)
10. **단면도에 계획 항적·계획 고도선을 기준선**으로 깔고 위험을 얹기. (Garmin Pilot)
11. **2단 디테일 드릴다운** + 컨트롤을 가장자리로 몰아 지도 비우기 + 접이식 패널. (MarineTraffic/Flightradar24)
12. **rainbow/jet 금지 → viridis/cividis/cmocean**, 색+명도+범례 병행. (과학 컬러맵 표준)

---

## 7. AI에게 시킬 때 넣을 규칙 (CLAUDE.md / 디자인 규칙 파일)

이전 보고서의 "규칙을 파일로 박기"를 **이 장르용**으로 구체화:

```
# 디자인 규칙 — 항공 기상 관제 대시보드 (SaaS 랜딩페이지 아님)

## 장르
- 이건 마케팅 사이트가 아니라 항공 기상 브리핑 관제 대시보드다.
- 최우선 가치는 "감성"이 아니라 "0.5초 판독성"이다. 조종사가 위험부터 즉시 읽어야 한다.

## 베이스맵
- 베이스맵은 무조건 차분한 다크(CARTO Dark Matter류). 채도 낮추고 라벨 최소화.
- 데이터 레이어가 주인공. 베이스맵 색이 데이터 색과 경쟁하면 안 된다.

## 색
- 색은 "의미"로만 쓴다. 장식용 색·그라데이션 금지.
- 한 색 = 한 의미. 데이터 나이/심각도/풍속은 각각 다른 팔레트.
- 위험도는 viridis/cividis(순차), 편차는 ColorBrewer diverging. jet/rainbow 절대 금지.
- 색만으로 등급 구분 금지 — 명도 차 + 범례 + 해칭 패턴 병행.
- 정상 상태는 비우고(투명), 위험할수록 채운다.

## 레이아웃
- 컨트롤(레이어 토글·세팅)은 화면 가장자리로. 접이식 패널로 지도 면적 확보.
- 디테일은 2단 드릴다운(지도 위 요약 → 클릭 시 상세 패널).
- 정보 밀도는 높게, 단 위계로 정리(4/8/12px 그리드, dense 테이블, raw 값보다 델타+스파크라인).
- live/stale/loading 3상태를 명시적으로 디자인.

## 참고 제품 (이걸 벤치마크해라)
- 구조·위험·단면·고도: aviationweather.gov GFA
- 색 일관성: ForeFlight
- 범례·picker·미감: Windy.com, Ventusky
- 정보 밀도: Bloomberg terminal, Datadog/Grafana
```

레퍼런스 첨부도 SaaS 캡처가 아니라 **GFA / Windy / Flightradar24 스크린샷**을 줘라.

---

## 부록 — 가장 먼저 읽을 3개

1. **[FlightAware 베이스맵 설계 (andywoodruff.com)](https://andywoodruff.com/posts/2024/flightaware-maps/)** — "데이터를 위해 베이스맵을 죽이는 법"의 정수.
2. **[Matt Ström — UI Density](https://matthewstrom.com/writing/ui-density/)** — 정보 밀도 설계의 바이블.
3. **[aviationweather.gov GFA](https://aviationweather.gov/gfa/)** — 직접 만져보며 당신 앱과 1:1 대조.

---

*4개 병렬 리서치 트랙(항공·기상 UI / 운영 지도 대시보드 / 지오공간 툴·디자인시스템 / 비주얼 레퍼런스 큐레이션)을 통합했다. SaaS용 일반 디자인 조언과 달리, 이 장르는 "데이터 판독성 + 위험 표출 + 베이스맵 후퇴 + 정보 밀도"가 핵심이며, 그 정답지는 실제 항공·기상·관제 제품에 이미 구현돼 있다.*
