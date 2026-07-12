import { AIRLINE_LOGOS } from './airlines.js'

// Register each airline logo as a transparent cut-out Mapbox image (airline-{ICAO}).
// No background plate — just the logo, with a soft white halo so it stays legible
// over varied terrain.
const LOGO_H = 13
const MAX_W = 50
const PAD = 3

function loadSvg(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function buildLogo(icao) {
  const img = await loadSvg(`/Symbols/airlines/${icao}.svg`)
  const pixelRatio = Math.max(1, Math.round(window.devicePixelRatio || 1))
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 3
  let drawH = LOGO_H
  let drawW = LOGO_H * ratio
  if (drawW > MAX_W) {
    drawW = MAX_W
    drawH = MAX_W / ratio
  }

  const W = Math.ceil(drawW + PAD * 2)
  const H = Math.ceil(LOGO_H + PAD * 2)
  const canvas = document.createElement('canvas')
  canvas.width = W * pixelRatio
  canvas.height = H * pixelRatio
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.scale(pixelRatio, pixelRatio)

  const x = (W - drawW) / 2
  const y = (H - drawH) / 2

  // Soft white halo built up from a few blurred passes.
  ctx.shadowColor = 'rgba(255,255,255,0.95)'
  ctx.shadowBlur = 2.5
  for (let i = 0; i < 3; i += 1) ctx.drawImage(img, x, y, drawW, drawH)
  ctx.shadowBlur = 0
  ctx.drawImage(img, x, y, drawW, drawH)

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { data, width, height, pixelRatio }
}

export async function registerAirlineLogos(map) {
  await Promise.all([...AIRLINE_LOGOS].map(async (icao) => {
    const imageId = `airline-${icao}`
    if (map.hasImage(imageId)) return
    try {
      const image = await buildLogo(icao)
      if (!map.hasImage(imageId)) map.addImage(imageId, image, { pixelRatio: image.pixelRatio })
    } catch {
      // skip logos that fail to load
    }
  }))
}
