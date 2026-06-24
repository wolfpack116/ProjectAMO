// Display helpers for the ADS-B popup: Korean type names, airport names, and route lookup.

export const TYPE_NAMES_KO = {
  B731: '보잉 737-100', B732: '보잉 737-200', B733: '보잉 737-300', B734: '보잉 737-400',
  B735: '보잉 737-500', B736: '보잉 737-600', B737: '보잉 737-700', B738: '보잉 737-800',
  B739: '보잉 737-900', B37M: '보잉 737 MAX 7', B38M: '보잉 737 MAX 8', B39M: '보잉 737 MAX 9',
  A318: '에어버스 A318', A319: '에어버스 A319', A320: '에어버스 A320', A321: '에어버스 A321',
  A19N: '에어버스 A319neo', A20N: '에어버스 A320neo', A21N: '에어버스 A321neo',
  B752: '보잉 757-200', B753: '보잉 757-300', BCS1: '에어버스 A220-100', BCS3: '에어버스 A220-300',
  E170: '엠브라에르 E170', E75L: '엠브라에르 E175', E190: '엠브라에르 E190', E195: '엠브라에르 E195',
  CRJ7: '봄바디어 CRJ700', CRJ9: '봄바디어 CRJ900',
  A332: '에어버스 A330-200', A333: '에어버스 A330-300', A338: '에어버스 A330-800neo',
  A339: '에어버스 A330-900neo', A342: '에어버스 A340-200', A343: '에어버스 A340-300',
  A345: '에어버스 A340-500', A346: '에어버스 A340-600', A359: '에어버스 A350-900', A35K: '에어버스 A350-1000',
  A388: '에어버스 A380-800',
  B762: '보잉 767-200', B763: '보잉 767-300', B764: '보잉 767-400',
  B772: '보잉 777-200', B773: '보잉 777-300', B77L: '보잉 777-200LR/F', B77W: '보잉 777-300ER',
  B788: '보잉 787-8', B789: '보잉 787-9', B78X: '보잉 787-10',
  B744: '보잉 747-400', B748: '보잉 747-8', MD11: 'MD-11',
  DH8D: '봄바디어 Dash 8 Q400', AT72: 'ATR 72', AT76: 'ATR 72-600', DHC6: '드 해빌랜드 트윈오터',
  C172: '세스나 172', C208: '세스나 캐러밴',
  H60: '시코르스키 S-70', EC35: '에어버스 H135', S76: '시코르스키 S-76',
}

// Korean airport names (ICAO). Foreign airports fall back to the city name from adsbdb.
export const AIRPORT_NAMES_KO = {
  RKSI: '인천', RKSS: '김포', RKPC: '제주', RKPK: '김해', RKTU: '청주', RKTN: '대구',
  RKJB: '무안', RKNY: '양양', RKJK: '군산', RKPS: '사천', RKTH: '포항', RKNW: '원주',
  RKJJ: '광주', RKPU: '울산', RKJY: '여수', RKTL: '울진', RKSM: '서울(공군)',
}

export function typeNameKo(typeCode) {
  if (!typeCode) return ''
  return TYPE_NAMES_KO[String(typeCode).toUpperCase()] || typeCode
}

function airportLabel(ap) {
  if (!ap || !ap.icao) return '?'
  const name = AIRPORT_NAMES_KO[ap.icao] || ap.city
  return name ? `${name}(${ap.icao})` : ap.icao
}

export function routeLabel(route) {
  if (!route || !route.origin || !route.destination) return null
  return `${airportLabel(route.origin)} → ${airportLabel(route.destination)}`
}

const routeCache = new Map()
export async function fetchRoute(callsign) {
  if (!callsign) return null
  const key = String(callsign).toUpperCase()
  if (routeCache.has(key)) return routeCache.get(key)
  try {
    const res = await fetch(`/api/adsb/route/${encodeURIComponent(key)}`)
    const data = await res.json()
    const route = data?.route || null
    routeCache.set(key, route)
    return route
  } catch {
    return null
  }
}
