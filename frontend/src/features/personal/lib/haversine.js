// 대원거리(NM). routeGeometry.coordinates = [[lon,lat], ...] (GeoJSON 순서).
const R_NM = 3440.065 // 지구 평균반경, 해리 단위

function toRad(deg) { return (deg * Math.PI) / 180 }

function segmentNm(lon1, lat1, lon2, lat2) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// coordinates: [[lon,lat], ...] → 총 거리(NM). 2점 미만이면 null.
export function routeDistanceNm(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  let total = 0
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lon1, lat1] = coordinates[i - 1]
    const [lon2, lat2] = coordinates[i]
    if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return null
    total += segmentNm(lon1, lat1, lon2, lat2)
  }
  return total > 0 ? total : null
}
