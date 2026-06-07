import { getWeatherIconSrc } from '../../../shared/weather/weather-icon-registry.js'
import {
  AIRPORT_CATEGORY_COLORS,
  AIRPORT_CATEGORY_UNKNOWN_COLOR,
} from './airportStationModel.js'

const STATION_SKY_COVERS = ['clear', 'few', 'sct', 'bkn', 'ovc']
const STATION_CATEGORIES = [
  ['vfr', AIRPORT_CATEGORY_COLORS.VFR],
  ['ifr', AIRPORT_CATEGORY_COLORS.IFR],
  ['lifr', AIRPORT_CATEGORY_COLORS.LIFR],
  ['unknown', AIRPORT_CATEGORY_UNKNOWN_COLOR],
]
const WIND_BUCKETS = Array.from({ length: 12 }, (_, index) => (index + 1) * 5)
const WEATHER_ICON_PREFIX = 'airport-wx-'

function getPixelRatio() {
  return Math.max(1, Math.round(window.devicePixelRatio || 1))
}

function createCanvasImage(draw, logicalSize) {
  const pixelRatio = getPixelRatio()
  const canvas = document.createElement('canvas')
  canvas.width = logicalSize * pixelRatio
  canvas.height = logicalSize * pixelRatio
  const context = canvas.getContext('2d', { alpha: true })
  context.scale(pixelRatio, pixelRatio)
  draw(context, logicalSize)
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  return { data, width, height, pixelRatio }
}

function fillStationCover(context, centerX, centerY, radius, skyCover, color) {
  if (skyCover === 'clear') return

  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = color

  if (skyCover === 'ovc') {
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fill()
  } else {
    let endAngle = 0
    if (skyCover === 'few') endAngle = 0
    if (skyCover === 'sct') endAngle = Math.PI / 2
    if (skyCover === 'bkn') endAngle = Math.PI
    context.beginPath()
    context.moveTo(centerX, centerY)
    context.arc(centerX, centerY, radius, -Math.PI / 2, endAngle)
    context.closePath()
    context.fill()
  }

  context.restore()
}

function createStationImage(color, skyCover) {
  return createCanvasImage((context, size) => {
    const centerX = size / 2
    const centerY = size / 2
    const radius = 7

    context.lineCap = 'round'
    context.lineJoin = 'round'

    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.strokeStyle = '#ffffff'
    context.lineWidth = 4
    context.stroke()

    fillStationCover(context, centerX, centerY, radius, skyCover, color)

    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.strokeStyle = color
    context.lineWidth = 2
    context.stroke()
  }, 48)
}

function drawWindFlag(context, centerX, currentY, spacing, barbLength, angleRad, color) {
  const nextY = currentY + spacing
  const dx = barbLength * Math.sin(angleRad)
  const dy = barbLength * Math.cos(angleRad)
  context.fillStyle = color
  context.beginPath()
  context.moveTo(centerX, currentY)
  context.lineTo(centerX + dx, currentY + dy)
  context.lineTo(centerX, nextY)
  context.closePath()
  context.fill()
  return nextY
}

function drawWindLine(context, centerX, currentY, length, angleRad) {
  const dx = length * Math.sin(angleRad)
  const dy = length * Math.cos(angleRad)
  context.beginPath()
  context.moveTo(centerX, currentY)
  context.lineTo(centerX + dx, currentY + dy)
  context.stroke()
}

function createWindBarbImage(speedKt) {
  return createCanvasImage((context, size) => {
    const centerX = size / 2
    const centerY = size / 2
    const stemLength = 28
    const barbLength = 10
    const halfBarbLength = 6
    const barbSpacing = 5
    const angleRad = (60 * Math.PI) / 180
    const tipY = centerY - stemLength
    const bucket = Math.min(60, Math.max(5, Math.round(speedKt / 5) * 5))
    let remaining = bucket
    const flags = Math.floor(remaining / 50)
    remaining -= flags * 50
    const fullBarbs = Math.floor(remaining / 10)
    remaining -= fullBarbs * 10
    const halfBarbs = remaining >= 5 ? 1 : 0

    const drawPass = (strokeStyle, lineWidth) => {
      context.strokeStyle = strokeStyle
      context.lineWidth = lineWidth
      context.lineCap = 'round'
      context.lineJoin = 'round'

      context.beginPath()
      context.moveTo(centerX, centerY)
      context.lineTo(centerX, tipY)
      context.stroke()

      let currentY = tipY
      for (let index = 0; index < flags; index += 1) {
        currentY = drawWindFlag(context, centerX, currentY, barbSpacing, barbLength, angleRad, strokeStyle)
      }

      for (let index = 0; index < fullBarbs; index += 1) {
        drawWindLine(context, centerX, currentY, barbLength, angleRad)
        currentY += barbSpacing
      }

      if (halfBarbs > 0) {
        drawWindLine(context, centerX, currentY, halfBarbLength, angleRad)
      }
    }

    drawPass('#ffffff', 4)
    drawPass('#0f172a', 2)
  }, 72)
}

function ensureMapImage(map, imageId, image) {
  if (map.hasImage(imageId)) return
  map.addImage(imageId, image, { pixelRatio: image.pixelRatio })
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function createWeatherImage(iconId) {
  const image = await loadImageElement(getWeatherIconSrc(iconId))
  return createCanvasImage((context, size) => {
    context.clearRect(0, 0, size, size)
    context.drawImage(image, 2, 2, size - 4, size - 4)
  }, 40)
}

export function registerAirportStationImages(map) {
  STATION_CATEGORIES.forEach(([categoryKey, color]) => {
    STATION_SKY_COVERS.forEach((skyCover) => {
      const imageId = `airport-station-${categoryKey}-${skyCover}`
      ensureMapImage(map, imageId, createStationImage(color, skyCover))
    })
  })
}

export function registerAirportWindBarbImages(map) {
  WIND_BUCKETS.forEach((speedKt) => {
    const imageId = `airport-wind-${String(speedKt).padStart(3, '0')}`
    ensureMapImage(map, imageId, createWindBarbImage(speedKt))
  })
}

export async function registerAirportWeatherImages(map, imageIds = []) {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))]
  await Promise.all(uniqueIds.map(async (imageId) => {
    if (map.hasImage(imageId)) return
    const iconId = imageId.startsWith(WEATHER_ICON_PREFIX)
      ? imageId.slice(WEATHER_ICON_PREFIX.length)
      : imageId
    try {
      ensureMapImage(map, imageId, await createWeatherImage(iconId))
    } catch {
      ensureMapImage(map, imageId, await createWeatherImage('unknown'))
    }
  }))
}
