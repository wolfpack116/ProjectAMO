// 표준 항공 비행범주. 시정 단위 m, 운고 단위 ft(최저 BKN/OVC).
export function categoryFor({ visibilityM, ceilingFt }) {
  const vis = Number.isFinite(visibilityM) ? visibilityM : Infinity
  const ceil = Number.isFinite(ceilingFt) ? ceilingFt : Infinity

  const byVis = vis < 1600 ? 'LIFR' : vis < 5000 ? 'IFR' : vis <= 8000 ? 'MVFR' : 'VFR'
  const byCeil = ceil < 500 ? 'LIFR' : ceil < 1000 ? 'IFR' : ceil < 3000 ? 'MVFR' : 'VFR'

  const order = { LIFR: 0, IFR: 1, MVFR: 2, VFR: 3 }
  return order[byVis] <= order[byCeil] ? byVis : byCeil
}

export function levelForCategory(category) {
  if (category === 'VFR') return 'green'
  if (category === 'MVFR') return 'amber'
  return 'red' // IFR, LIFR
}

export default { categoryFor, levelForCategory }
