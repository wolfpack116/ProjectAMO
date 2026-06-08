/**
 * Inverse Distance Weighting interpolation (power=2).
 * @param {Array<{x:number, y:number, value:number}>} points  정규화 좌표 [0,1]
 * @param {number} gridSize  출력 격자 한 변의 길이 (square)
 * @returns {Float32Array}  row-major, row 0 = top (y=0)
 */
export function idwInterpolate(points, gridSize = 512) {
  const out = new Float32Array(gridSize * gridSize)
  const inv = 1 / (gridSize - 1 || 1)
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const px = c * inv
      const py = r * inv
      let num = 0, den = 0
      for (const p of points) {
        const dx = px - p.x
        const dy = py - p.y
        const d2 = dx * dx + dy * dy
        if (d2 < 1e-10) { num = p.value; den = 1; break }
        const w = 1 / d2
        num += w * p.value
        den += w
      }
      out[r * gridSize + c] = den > 0 ? num / den : 0
    }
  }
  return out
}
