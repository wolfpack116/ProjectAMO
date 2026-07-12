# 구현 계획 — 통합 검색 (MVP)

> 상태: **검토 대기** · 작성 2026-06-30
> 상위 제안: [search-feature.md](search-feature.md)

## 0. 핵심 아키텍처 결정 — 상태 간극 잇기

조사 결과: **레이어 상태와 토글이 전부 `MapView.jsx` 안**에 있다(`metVisibility`/`aviationVisibility`/`basemapId` + `toggleMet`/`toggleAviation`). 검색 UI는 Sidebar(App 셸)에 산다. 둘을 잇는 방식:

| 동작 | 상태 위치 | 검색의 접근법 |
|------|-----------|---------------|
| 공항 선택 | App `selectedAirport` | `setSelectedAirport` 직접 |
| 패널 열기 | App `activePanel` | `setActivePanel` 직접 |
| 레이어 토글 | **MapView** `metVisibility`/`aviationVisibility` | **MapView ref(imperative handle)** |
| 베이스맵 | **MapView** `basemapId` | **MapView ref** |

**결정:** MapView를 `forwardRef`로 만들고 `useImperativeHandle`로 `setLayerOn(id, kind)`·`switchBasemap(id)`만 노출. App이 `mapRef`를 쥐고, 검색 action을 라우팅. → 레이어 상태를 App으로 끌어올리는 대규모 리팩터 회피(리스크 최소). 기존 `toggleMet`/`toggleAviation`/베이스맵 핸들러를 **그대로 재사용**(제안서 구현제약 #2).

- `setLayerOn(id, kind)`: 현재 꺼져있을 때만 `toggleMet/toggleAviation` 호출(검색은 항상 **켜기**, 끄지 않음 — 놀람 방지).

## 1. 파일 구성

**신규**
- `frontend/src/features/search/layerActions.js` — 공유 레지스트리. `MET_LAYERS`·`AVIATION_WFS_LAYERS`·`BASEMAP_OPTIONS`에서 label/id import + aliases 맵. `LAYER_ACTIONS`, `PANEL_ACTIONS`, `BASEMAP_ACTIONS`, `buildSearchCatalog(airports)` export.
- `frontend/src/features/search/layerActions.test.js` — **커버리지 테스트**(모든 토글 레이어 id가 레지스트리에 존재) + 매칭 단위 테스트.
- `frontend/src/features/search/SearchPalette.jsx` (+ `.css`) — Cmd/Ctrl+K 오버레이(공항+action 결과, 키보드 내비, 타입 아이콘).

**수정**
- `MapView.jsx` — `forwardRef` + `useImperativeHandle(setLayerOn, switchBasemap)`.
- `App.jsx` — `mapRef`, 팔레트 open state, Cmd/Ctrl+K 리스너, `runAction()` 라우터, 팔레트 렌더.
- `Sidebar.jsx` — 레일에 **검색 아이콘 버튼**(Search, 앞서 제거한 것 재사용) 추가. 클릭 시 검색 팔레트 오픈(축소/확장 양쪽). ⌘K는 같은 팔레트 보조 단축키.
- `MobileMoreMenu.jsx` — 모바일은 사이드바가 숨으므로 **더보기 메뉴에 "검색" 항목** 추가 → 동일 팔레트 오픈(헌법 §6 모바일 진입점).
- 레이어 정의 파일 2개 — 머리에 "layerActions.js 연동" 1줄 주석.

## 2. 단계별 (각 단계 verify 포함)

**Phase 0 — 레지스트리 (순수·테스트 우선)**
- layerActions.js + aliases(제안서 §4 표) 작성. label은 정의에서 import(복제 X).
- → **verify:** `layerActions.test.js` 통과(커버리지 + 매칭). 순수 함수라 UI 없이 검증.

**Phase 1 — MapView ref 브리지**
- MapView forwardRef, setLayerOn/switchBasemap 노출(ensure-on). App에 mapRef 연결.
- → **verify:** 임시 콘솔 호출로 레이더 on/베이스맵 전환 확인. 패널 직접 토글 회귀 없음.

**Phase 2 — 팔레트 UI + 라우팅**
- SearchPalette: 입력→catalog 필터(공항 from weatherData + action), ↑↓/Enter/Esc, 타입 라벨(위성 동음 구분). App `runAction`: panel→setActivePanel, airport→setSelectedAirport, met/aviation-layer→setActivePanel+mapRef.setLayerOn, basemap→mapRef.switchBasemap. Sidebar 트리거 버튼 + Cmd/K.
- → **verify(Playwright):** "레이더"→MET 패널+레이더 ON · "인천"→공항 패널 · "단색"→베이스맵 · ⌘K 열림 · Esc 닫힘. 스크린샷.

**Phase 3 — a11y·폴리시**
- role="dialog"/aria-modal, 포커스 트랩+복귀, 결과 role="listbox/option", focus-visible.
- → **verify:** 키보드 단독 통과 + 캡처.

## 3. 확정된 결정 (검토 완료)
1. **검색 UI** — 사이드바 **검색 아이콘 버튼** → 검색 팔레트 오버레이(축소/확장 양쪽). ⌘K 보조 단축키.
2. **ensure-on** — 검색은 항상 **켜기만**(끄지 않음). 이미 켜져 있으면 패널만 열고 유지.
3. **레지스트리 위치** — `features/search/` (검색 기능 소유).
4. **비범위** — 브리핑/경로 토글, 위험매핑, 자동켜기 등은 [BACKLOG.md](BACKLOG.md)에 기록(미구현).

### 구현 중 확인할 것
- **베이스맵 핸들러 정확 명칭** — MapView의 BasemapSwitcher `onSwitchBasemap` 배선 재사용(Phase 1에서 정확 명 확인).

## 4. 비범위 (제안서 §7 재확인)
브리핑/경로 토글 UI, 위험현상→레이어 매핑, 자동켜기, 퍼지매칭, 최근/즐겨찾기, fix 좌표 검색.
