// 표준 항공 비행범주. 시정 단위 m, 운고 단위 ft(최저 BKN/OVC).
export function categoryFor({ visibilityM, ceilingFt }) {
  const vis = Number.isFinite(visibilityM) ? visibilityM : Infinity
  const ceil = Number.isFinite(ceilingFt) ? ceilingFt : Infinity

  const byVis = vis < 1600 ? 'LIFR' : vis < 5000 ? 'IFR' : vis <= 8000 ? 'MVFR' : 'VFR'
  const byCeil = ceil < 500 ? 'LIFR' : ceil < 1000 ? 'IFR' : ceil < 3000 ? 'MVFR' : 'VFR'

  const order = { LIFR: 0, IFR: 1, MVFR: 2, VFR: 3 }
  return order[byVis] <= order[byCeil] ? byVis : byCeil
}

// categoryFor와 같은 임계값이되, 최악 범주 + 한계요인(운고/시정)까지 돌려준다.
// 배너 헤드라인이 "IFR인 이유"를 명시하는 데 쓴다.
export function categoryDetail({ visibilityM, ceilingFt }) {
  const vis = Number.isFinite(visibilityM) ? visibilityM : Infinity
  const ceil = Number.isFinite(ceilingFt) ? ceilingFt : Infinity

  const byVis = vis < 1600 ? 'LIFR' : vis < 5000 ? 'IFR' : vis <= 8000 ? 'MVFR' : 'VFR'
  const byCeil = ceil < 500 ? 'LIFR' : ceil < 1000 ? 'IFR' : ceil < 3000 ? 'MVFR' : 'VFR'

  const order = { LIFR: 0, IFR: 1, MVFR: 2, VFR: 3 }
  const category = order[byVis] <= order[byCeil] ? byVis : byCeil
  const driver = byVis === byCeil ? 'both' : order[byVis] < order[byCeil] ? 'visibility' : 'ceiling'
  return { category, driver }
}

// 표시용 3레벨 fold: MVFR을 VFR로 올려 접는다(운영 기준: 마진 VFR은 VFR로 취급).
// 내부 계산은 4등급 유지, 표시/색만 3단계(VFR·IFR·LIFR).
export function to3Level(category) {
  return category === 'MVFR' ? 'VFR' : category
}

// 색 = 심각도: VFR/MVFR=green(양호), IFR=amber(주의), LIFR=red(경고).
export function levelForCategory(category) {
  if (category === 'VFR' || category === 'MVFR') return 'green'
  if (category === 'IFR') return 'amber'
  return 'red' // LIFR
}

export default { categoryFor, categoryDetail, to3Level, levelForCategory }
