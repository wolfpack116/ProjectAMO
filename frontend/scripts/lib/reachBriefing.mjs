// 브리핑 result 뷰까지 자동 진입하는 재사용 헬퍼 (데스크톱 IFR).
// 브리핑 개편 작업 중 반복 캡처용 — 매번 폼 셀렉터 리버스엔지니어링하지 말 것.
//
// === 데스크톱 폼 셀렉터 메모 (2026-07-02 확인) ===
// - 공항 선택 = Fluent <Dropdown>. 트리거 = `button.fui-Dropdown__button` (role="combobox").
//   순서: nth(0)=출발, nth(1)=도착, nth(2)=교체. ⚠️ getByRole('button',{name:'-- 선택 --'})는
//   접근성 이름이 placeholder와 달라 매칭 안 됨 → 반드시 `.fui-Dropdown__button` 클래스로 잡을 것.
// - 열면 portal에 [role=option] 렌더 → getByRole('option',{name:'RKSI',exact:true}) 클릭.
// - 경로 검색 버튼 = 텍스트 '검색'(exact) / 결과 컨테이너 = `.route-check-result`.
// - 최종 산출 = '브리핑 생성'(exact) → `.briefing-view` 렌더.
// - 업데이트 모달이 처음 뜨면 `.updates-modal__close`로 닫아야 클릭이 안 가로채짐.

const settle = (p, ms = 1200) => p.waitForTimeout(ms)

async function pickDropdown(p, index, icao) {
  await p.locator('.fui-Dropdown__button').nth(index).click()
  await p.waitForTimeout(300)
  // 옵션 라벨이 'RKPU' 또는 '김해 RKPU' 등일 수 있어 부분일치(hasText)로 잡는다.
  await p.getByRole('option').filter({ hasText: icao }).first().click()
  await p.waitForTimeout(400)
}

// options: { departure='RKSI', arrival='RKPK', alternate=null }
// alternate = 교체공항 ICAO(3번째 Dropdown, index 2). null이면 미선택.
export async function reachBriefingResult(p, appUrl, { departure = 'RKSI', arrival = 'RKPK', alternate = null } = {}) {
  await p.goto(`${appUrl}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await p.waitForSelector('.map-shell', { timeout: 20000 }); await settle(p, 2000)
  const close = await p.$('.updates-modal__close')
  if (close) { await close.click().catch(() => {}); await p.waitForTimeout(300) }

  await p.getByRole('button', { name: '브리핑' }).click()
  await p.waitForSelector('.route-check-panel', { timeout: 10000 }); await settle(p, 800)

  await pickDropdown(p, 0, departure)
  await pickDropdown(p, 1, arrival)
  if (alternate) await pickDropdown(p, 2, alternate)

  const panel = p.locator('.route-check-panel')
  await panel.getByRole('button', { name: '검색', exact: true }).first().click()
  await p.waitForSelector('.route-check-result', { timeout: 12000 }); await settle(p, 1200)

  await panel.getByRole('button', { name: '브리핑 생성', exact: true }).first().click()
  await p.waitForSelector('.briefing-view', { timeout: 15000 })
  await p.waitForTimeout(3000)
}
