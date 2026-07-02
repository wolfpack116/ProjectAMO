# 경로 파일 불러오기 (GPX·KML·GeoJSON) — 설계 스펙

> 상태: 설계 승인됨(2026-07-02, 브레인스토밍 4결정 + 접근①·설계 2섹션 승인).
> 다음: 사용자 스펙 검토 → writing-plans.
> 성격: **프런트 전용.** 외부 경로 파일을 우리 VFR 경유점으로 변환해 기존 브리핑 파이프라인에 주입.
> 선행: VFR 경유점 빌더(`vfrWaypoints`), leg 지형·반원고도(`vfrLegs`, `nearestVfrCruiseAltitude`), `getCurrentRouteLineString`, 브리핑·연직단면 파이프라인을 **재사용·확장**한다.

## 0. 목적 / 배경

Windy 대비 갭 분석에서 확인된 미보유 기능. 다른 도구(ForeFlight·SkyDemon·SkyVector·Flight Plan Database)의 비행계획이나 GPS 트랙을 불러와, **그 경로를 따라 우리 브리핑(위험·경로 위험·leg 지형·연직단면·목적지)을 그대로 돌린다.** 새 데이터·엔드포인트 없이 프런트 어댑터만 추가한다.

## 1. 결정 (승인됨)

- **용도 = 비행계획 + GPS 트랙 둘 다.** 공항 유무·점 개수 편차를 모두 흡수한다.
- **공항 = 자동 스냅 + 폴백.** 끝점이 공항 임계거리(기본 5NM) 안이면 그 공항으로 설정(`fixed:true`, 공항 표고 → 배너·현재·목적지 섹션 작동). 아니면 일반 지점(`fixed:false`)으로 두고 공항 의존 섹션은 자연히 "해당 없음".
- **점 솎기 = RDP 자동, 고정 목표.** `simplify-js`(Ramer–Douglas–Peucker)로 tolerance를 조절해 **≤ N개**(기본 N=20)로 축소, 첫·끝 점 보존. 사용자 조정 UI 없음.
- **형식 = GeoJSON + GPX + KML.** GeoJSON은 파싱 불필요. GPX·KML은 `@tmcw/togeojson` 하나로 둘 다 처리(브라우저 내장 `DOMParser` 사용).
- **접근 = ① 얇은 임포터 → 기존 VFR 파이프라인 재사용.** 임포터는 수동 빌더와 **동일한 결과물**(`routeResult` + `vfrWaypoints`)을 뱉는 어댑터.
- **불러오면 VFR 모드로 전환.** 임포트 경로는 점 기반이라 IFR 절차와 무관.
- **파일 고도값 무시.** 경유점 고도는 순항고도 기본값, 반원고도 힌트로 조정(기존 UX).

## 2. 컴포넌트 / 파일

- **신규** `frontend/src/features/route-briefing/lib/routeImport.js` — 순수 함수:
  - `parseRouteFile(name, text)` → GeoJSON FeatureCollection. `.geojson`/`.json`은 `JSON.parse`, `.gpx`/`.kml`은 `DOMParser` + `@tmcw/togeojson`(`gpx()`/`kml()`).
  - `extractRoutePoints(geojson)` → `[[lon,lat]…]`. 우선순위: LineString/MultiLineString → (GPX 변환 결과의) 다중 라인 → Point 시퀀스. 여러 경로 존재 시 **가장 긴 것** 사용, 나머지 무시 플래그 반환.
  - `simplifyRoute(coords, maxPts = 20)` → RDP. tolerance를 이분 증가시켜 결과 길이 ≤ maxPts, 첫·끝 보존.
  - `snapEndpointsToAirports(coords, airports, thresholdNm = 5)` → `{ departureAirport|null, arrivalAirport|null }`. 거리 = 기존 haversine 재사용.
  - `importRoute({ name, text, airports })` → `{ coords, departureAirport, arrivalAirport, warnings[] }` (위 단계 조합, 순수).
- **신규** `buildVfrRouteFromWaypoints(coords, { departureAirport, arrivalAirport, airports })` — `routeBriefingModel.js`(또는 `routePlanner.js`)에 추가. `buildVfrRoute`가 공항을 필수로 요구하므로, 불러온 좌표로 **직접** VFR `routeResult`를 구성(수동 빌더와 동일 shape: `flightRule:'VFR'`, `departureAirport`, `arrivalAirport`, `distanceNm`, `previewGeojson`{line+points}). 끝점 스냅 여부로 `vfrWaypoints`의 `fixed`/`airportElevationFt` 결정, 중간점은 `relabeledWaypoints`로 라벨링.
- **수정** `useRouteBriefing.js` — 액션 `importRouteFromFile(file)`: 파일 텍스트 읽기 → `importRoute` → `buildVfrRouteFromWaypoints` → `switchFlightRule('VFR')` + `setRouteResult` + `setVfrWaypoints` + fitBounds 요청 + 경고 표출. 실패 시 에러 상태.
- **수정** `RouteBriefingPanel.jsx` — VFR 빌더에 "경로 불러오기" 버튼 + 숨은 `<input type="file" accept=".geojson,.json,.gpx,.kml">`. 임포트 경고/에러 메시지 표시.
- **수정** `frontend/package.json` — `@tmcw/togeojson`, `simplify-js` 추가. (turf 불필요.)

## 3. 데이터 / 파생

- 임포트 결과 좌표는 `getCurrentRouteLineString`(VFR: `vfrWaypoints`→LineString)로 자동 지오메트리화 → leg 지형(`/vertical-profile`)·브리핑·연직단면이 그대로 소비.
- 한국 FIR 판정 = 지도 `maxBounds`(lon 116–139, lat 26–44) 내 여부. 밖이면 warning 추가(차단 아님).
- `vfrWaypoints` shape 유지: `{ id, uid, lon, lat, fixed, airportElevationFt?, altitudeFt }`.

## 4. 에러 / 엣지 (검증 대상)

- 파싱 실패 → "파일을 읽을 수 없습니다 (GeoJSON/GPX/KML 확인)".
- 좌표 < 2 → "경로 점이 부족합니다".
- FIR 밖 → 불러오되 경고.
- 경로 다수 → 가장 긴 것 + "나머지 무시" 안내.
- 과대 파일/점 → 솎기 전 상한(예: 원시 점 > 100k 또는 용량 > 5MB면 경고·거부).
- 끝점 둘 다 같은 공항(짧은 왕복) → 허용.
- 고도값 존재 → 무시.

## 5. 테스트

- 순수 단위테스트(`node --test`) — `routeImport`:
  - 3형식 파싱(§샘플 파일 내용 픽스처): GeoJSON/GPX/KML 각각 좌표 추출 동일 결과.
  - `simplifyRoute`: 조밀 입력 → ≤ N, 첫·끝 보존.
  - `snapEndpointsToAirports`: 임계 안/밖 케이스.
- `buildVfrRouteFromWaypoints`: 출력 shape가 수동 VFR 빌더와 일치(flightRule·waypoints·previewGeojson line+points).
- 브라우저 검증(Playwright, §8): 샘플 파일 불러오기 → 경유점·leg 정보 표시 → 브리핑 생성 작동. 샘플: `RKSS-RKPK`(scratchpad/route-samples, 필요 시 리포 픽스처로 이동).

## 6. Out of scope

- 드래그드롭 지도 투척(추후). 점 개수 사용자 슬라이더(추후). 파일 고도 반영. IFR 절차 임포트. 경로 **내보내기**(export). 다중 경로 동시 로드. turf 도입.

## 7. 열린 항목 (구현 중 확정)

- `buildVfrRouteFromWaypoints`를 `routePlanner.js`에 둘지 `routeBriefingModel.js`에 둘지(기존 VFR 로직 위치에 맞춰).
- 솎기 목표 N 기본값(20) 미세조정(경유점 목록 가독성 vs 경로 충실도).
- 공항 스냅 임계(5NM) 미세조정.
- 샘플 파일을 리포 테스트 픽스처로 승격할지.
