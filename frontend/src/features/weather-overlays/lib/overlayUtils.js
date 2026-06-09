export function parseRgba(color) {
  const match = String(color).match(/rgba\(([^)]+)\)/)
  if (!match) return [0, 0, 0, 0]
  const [r, g, b, a] = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
  return [r, g, b, Math.round((a ?? 1) * 255)]
}

export function coordinatesForGrid(grid) {
  if (!grid) return null
  const { lonMin, lonMax, latMin, latMax } = grid
  if (![lonMin, lonMax, latMin, latMax].every(Number.isFinite)) return null
  return [[lonMin, latMax], [lonMax, latMax], [lonMax, latMin], [lonMin, latMin]]
}
