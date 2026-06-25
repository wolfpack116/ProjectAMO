// User-facing release notes (newest first). Add a new entry on top each release
// and bump frontend/package.json to match CURRENT_VERSION.

export const CHANGELOG = [
  {
    version: '0.1.8',
    date: '2026-06-26',
    title: '모바일 레이아웃 개편',
    items: [
      '항공·기상 레이어를 바텀시트 + 아이콘 타일 그리드로 재구성 (전체 끄기, 한눈에 토글)',
      '지도 위 항공·기상 버튼에 활성 레이어 개수 배지, 낙뢰 깜빡임은 지도 범례로 이동',
      '경로 브리핑을 출발→도착 픽커 + 접이식 시트로 개편 (출도착 스왑, 절차 자동 표시)',
      '시트를 내리면 경로 요약(RKSI → RKSS · IFR · 거리)만 남기고 지도 확인',
    ],
  },
  {
    version: '0.1.7',
    date: '2026-06-25',
    title: '실시간 항공기(ADS-B)',
    items: [
      '지도에 실시간 항공기 표시 — 기종별 아이콘과 실제 크기 반영',
      '국적 항공사 로고 + 호버 팝업(편명·기종·경로 출발→도착)',
      '비행기 모션 꼬리로 진행 방향 표시',
      '보는 동안에만 자동 갱신(요청 기반) + 로딩 표시',
    ],
  },
  {
    version: '0.1.6',
    date: '2026-06-10',
    title: '비행기상 카테고리 & 시각 표시',
    items: [
      '공항 비행기상(VFR/IFR/LIFR) 오버레이',
      '기상 레이어 발효/유효 시각 바',
      '공항 마커·툴팁 표시 정리',
    ],
  },
  {
    version: '0.1.5',
    date: '2026-06-07',
    title: '단면(Cross-section) 브리핑',
    items: [
      '항로 수직 단면 — 등온선·바람·KTG 저고도 난류',
      'KIM 수치예보 기압면 확장',
    ],
  },
  {
    version: '0.1.4',
    date: '2026-05-21',
    title: '수치예보 확장 & 최적화',
    items: [
      'KIM 기온·결빙 가능성 오버레이',
      '네트워크 요청 최적화, 공항 기상 표출 통일',
    ],
  },
  {
    version: '0.1.3',
    date: '2026-05-18',
    title: '바람 오버레이 & 모바일',
    items: [
      'KIM 지상 바람(WebGL) 오버레이',
      '반응형/모바일 레이아웃',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-05-13',
    title: '항로 브리핑',
    items: [
      'TAF·SIGWX·AMOS 표출',
      '항로 수직 프로파일 브리핑, 기상 타임라인',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-05-07',
    title: '첫 릴리스',
    items: [
      'METAR 공항 기상 대시보드',
      '베이스맵·공항 패널, 항로 체크(SID/STAR/IAP/VFR)',
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
