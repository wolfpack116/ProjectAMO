// #6 예보관이 있는 공항(문의 대상 후보 = 예보관 담당 배정 후보). 이 7개로 한정.
export const FORECASTER_AIRPORTS = ['RKSI', 'RKSS', 'RKPC', 'RKJB', 'RKNY', 'RKJY', 'RKPU']
const SET = new Set(FORECASTER_AIRPORTS)

export function isForecasterAirport(icao) {
  return SET.has(String(icao || '').toUpperCase())
}

// 담당공항 배열 정규화: 대문자화, 7개 집합만, 중복 제거. 유효한 게 없으면 null.
export function normalizeForecasterAirports(list) {
  if (!Array.isArray(list)) return null
  const out = [...new Set(list.map((a) => String(a || '').toUpperCase()).filter((a) => SET.has(a)))]
  return out.length ? out : null
}

export default { FORECASTER_AIRPORTS, isForecasterAirport, normalizeForecasterAirports }
