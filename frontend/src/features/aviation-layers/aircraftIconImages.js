import { AIRCRAFT_CLASSES } from './aircraftClass.js'
import { AIRCRAFT_SHAPES } from './aircraftShapes.js'

// Render the solid-fill tar1090 silhouettes (see aircraftShapes.js) into Mapbox images,
// crisply at device resolution, with a bright fill + dark edge so they read on a light map.
const ICON_SIZE = 40
const FILL_COLOR = '#10b981' // emerald — original ADS-B color
const EDGE_COLOR = '#ffffff' // white border/halo
const EDGE_WIDTH = 1.8

function loadSvgImage(viewBox, path, fill) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><path d="${path}" fill="${fill}"/></svg>`
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

async function buildIcon(cls) {
  const shape = AIRCRAFT_SHAPES[cls] || AIRCRAFT_SHAPES.jet
  const pixelRatio = Math.max(1, Math.round(window.devicePixelRatio || 1))
  const [fillImg, edgeImg] = await Promise.all([
    loadSvgImage(shape.viewBox, shape.path, FILL_COLOR),
    loadSvgImage(shape.viewBox, shape.path, EDGE_COLOR),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE * pixelRatio
  canvas.height = ICON_SIZE * pixelRatio
  const context = canvas.getContext('2d', { alpha: true })
  context.scale(pixelRatio, pixelRatio)

  const inset = EDGE_WIDTH + 1
  const drawn = ICON_SIZE - inset * 2
  // Dark edge: stamp the silhouette around the rim, then the bright fill on top.
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    context.drawImage(edgeImg, inset + Math.cos(angle) * EDGE_WIDTH, inset + Math.sin(angle) * EDGE_WIDTH, drawn, drawn)
  }
  context.drawImage(fillImg, inset, inset, drawn, drawn)

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  return { data, width, height, pixelRatio }
}

export async function registerAircraftImages(map) {
  await Promise.all(AIRCRAFT_CLASSES.map(async (cls) => {
    const imageId = `aircraft-${cls}`
    if (map.hasImage(imageId)) return
    try {
      const image = await buildIcon(cls)
      if (!map.hasImage(imageId)) map.addImage(imageId, image, { pixelRatio: image.pixelRatio })
    } catch {
      // leave unregistered; the layer falls back to 'aircraft-unknown'
    }
  }))
}
