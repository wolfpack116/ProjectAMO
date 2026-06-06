export const MS_TO_KT = 1.943844

export function msToKt(ms) {
  return Number.isFinite(ms) ? ms * MS_TO_KT : NaN
}

export function windDirectionFromUV(u, v) {
  const dir = (Math.atan2(-u, -v) * 180) / Math.PI
  return (dir + 360) % 360
}

export function windBarbFeathers(kt) {
  let k = Math.max(0, Math.round((Number(kt) || 0) / 5) * 5)
  const pennants = Math.floor(k / 50); k -= pennants * 50
  const full = Math.floor(k / 10); k -= full * 10
  const half = Math.floor(k / 5)
  return { pennants, full, half }
}

export function pressureToFallbackFt(pressure) {
  const table = [[1000, 364], [925, 2500], [850, 5000], [700, 10000], [600, 13800], [500, 18300], [400, 23600], [300, 30000], [250, 34000], [200, 38600], [150, 44600]]
  for (let i = 1; i < table.length; i += 1) {
    if (pressure >= table[i][0]) {
      const [p0, a0] = table[i - 1]; const [p1, a1] = table[i]
      const r = (pressure - p0) / (p1 - p0)
      return a0 + r * (a1 - a0)
    }
  }
  return table[table.length - 1][1]
}

// cells: { nx, ny, values:[row-major y*nx+x], xs:[px per col], ys:[px per row] }
// returns array of segments; each segment = [{x,y},{x,y}]
export function isothermSegments(cells, level) {
  const { nx, ny, values, xs, ys } = cells
  const segs = []
  const at = (x, y) => values[y * nx + x]
  const interp = (a, b, va, vb) => (va === vb ? a : a + (b - a) * ((level - va) / (vb - va)))
  for (let y = 0; y < ny - 1; y += 1) {
    for (let x = 0; x < nx - 1; x += 1) {
      const tl = at(x, y); const tr = at(x + 1, y); const bl = at(x, y + 1); const br = at(x + 1, y + 1)
      if (![tl, tr, bl, br].every(Number.isFinite)) continue
      const pts = []
      if ((tl - level) * (tr - level) < 0) pts.push({ x: interp(xs[x], xs[x + 1], tl, tr), y: ys[y] })
      if ((bl - level) * (br - level) < 0) pts.push({ x: interp(xs[x], xs[x + 1], bl, br), y: ys[y + 1] })
      if ((tl - level) * (bl - level) < 0) pts.push({ x: xs[x], y: interp(ys[y], ys[y + 1], tl, bl) })
      if ((tr - level) * (br - level) < 0) pts.push({ x: xs[x + 1], y: interp(ys[y], ys[y + 1], tr, br) })
      if (pts.length >= 2) segs.push([pts[0], pts[1]])
    }
  }
  return segs
}
