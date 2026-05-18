import { createWindFieldSampler, pickWindSpeedColor } from './windField.js'

const DEFAULTS = {
  desktopCap: 5000,
  mobileCap: 1800,
  lowPowerCap: 1000,
  maxAge: 80,
  speedFactor: 0.45,
  frameCap: 30,
  speedOpacity: 0.35,
  sampleStep: 3,
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function isMobileViewport(width) {
  return width < 720
}

function makeParticle(bounds, maxAge) {
  return {
    lon: bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest()),
    lat: bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth()),
    age: Math.floor(Math.random() * maxAge),
    maxAge,
    prevX: null,
    prevY: null,
  }
}

function createOverlayCanvas(role, zIndex) {
  const canvas = document.createElement('canvas')
  canvas.dataset.kimWindOverlay = role
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = zIndex
  return canvas
}

export class CanvasWindRenderer {
  constructor(map, options = {}) {
    this.type = 'canvas'
    this.map = map
    this.options = { ...DEFAULTS, ...options }
    this.container = map.getContainer()
    this.speedCanvas = createOverlayCanvas('speed', '3')
    this.flowCanvas = createOverlayCanvas('flow', '4')
    this.speedCtx = this.speedCanvas.getContext('2d')
    this.ctx = this.flowCanvas.getContext('2d')
    this.container.appendChild(this.speedCanvas)
    this.container.appendChild(this.flowCanvas)
    this.particles = []
    this.windField = null
    this.sampler = { sample: () => null }
    this.visibility = { flow: false, speed: false }
    this.frameId = null
    this.lastFrameAt = 0
    this.destroyed = false
    this.resize()
  }

  setData(windField) {
    this.windField = windField
    this.sampler = createWindFieldSampler(windField)
    this.ensureParticles()
    if (this.visibility.speed) this.drawSpeedLayer()
  }

  setVisibility({ flow = false, speed = false } = {}) {
    this.visibility = { flow, speed }
    this.flowCanvas.style.display = flow ? 'block' : 'none'
    this.speedCanvas.style.display = speed ? 'block' : 'none'
    if (speed) this.drawSpeedLayer()
    if (flow) this.start()
    else this.stop()
    if (!flow && this.ctx) this.ctx.clearRect(0, 0, this.width, this.height)
    if (!speed && this.speedCtx) this.speedCtx.clearRect(0, 0, this.width, this.height)
  }

  resize() {
    const rect = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    this.flowCanvas.width = Math.round(width * dpr)
    this.flowCanvas.height = Math.round(height * dpr)
    this.speedCanvas.width = Math.round(width * dpr)
    this.speedCanvas.height = Math.round(height * dpr)
    if (this.ctx?.setTransform) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (this.speedCtx?.setTransform) this.speedCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.width = width
    this.height = height
    this.ensureParticles()
    if (this.visibility.speed) this.drawSpeedLayer()
  }

  ensureParticles() {
    if (!this.windField) return
    const cap = isMobileViewport(this.width) ? this.options.mobileCap : this.options.desktopCap
    const count = clamp(Math.round((this.width * this.height) / 450), 1, cap)
    const bounds = this.map.getBounds()
    while (this.particles.length < count) {
      this.particles.push(makeParticle(bounds, this.options.maxAge))
    }
    if (this.particles.length > count) this.particles.length = count
  }

  start() {
    if (this.frameId || !this.windField) return
    this.frameId = window.requestAnimationFrame((time) => this.frame(time))
  }

  stop() {
    if (!this.frameId) return
    window.cancelAnimationFrame(this.frameId)
    this.frameId = null
  }

  destroy() {
    this.stop()
    this.destroyed = true
    if (this.flowCanvas.parentNode) this.flowCanvas.parentNode.removeChild(this.flowCanvas)
    if (this.speedCanvas.parentNode) this.speedCanvas.parentNode.removeChild(this.speedCanvas)
  }

  redraw() {
    if (this.visibility.speed) this.drawSpeedLayer()
  }

  frame(time) {
    this.frameId = null
    if (!this.visibility.flow) return
    const minFrameMs = 1000 / this.options.frameCap
    if (!this.lastFrameAt || time - this.lastFrameAt >= minFrameMs) {
      this.stepParticles()
      this.lastFrameAt = time
    }
    this.frameId = window.requestAnimationFrame((nextTime) => this.frame(nextTime))
  }

  stepParticles() {
    if (!this.ctx || !this.windField) return
    const bounds = this.map.getBounds()
    this.ctx.globalCompositeOperation = 'destination-in'
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.94)'
    this.ctx.fillRect(0, 0, this.width, this.height)
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.lineWidth = isMobileViewport(this.width) ? 1 : 1.2
    this.ctx.globalAlpha = 0.78

    for (const particle of this.particles) {
      const vector = this.sampler.sample(particle.lon, particle.lat)
      if (!vector || particle.age >= particle.maxAge) {
        Object.assign(particle, makeParticle(bounds, this.options.maxAge))
        continue
      }

      const from = this.map.project([particle.lon, particle.lat])
      particle.lon += vector.u * this.options.speedFactor * 0.002
      particle.lat += vector.v * this.options.speedFactor * 0.002
      const to = this.map.project([particle.lon, particle.lat])

      this.ctx.strokeStyle = pickWindSpeedColor(vector.speed).color.replace(/0\.\d+\)$/, '0.82)')
      this.ctx.beginPath()
      this.ctx.moveTo(from.x, from.y)
      this.ctx.lineTo(to.x, to.y)
      this.ctx.stroke()
      particle.prevX = to.x
      particle.prevY = to.y
      particle.age += 1
    }
    this.ctx.globalAlpha = 1
  }

  drawSpeedLayer() {
    if (!this.speedCtx || !this.windField || !this.visibility.speed) return
    const step = this.width > 1440 ? 2 : this.options.sampleStep
    this.speedCtx.clearRect(0, 0, this.width, this.height)
    this.speedCtx.save?.()
    this.speedCtx.globalAlpha = this.options.speedOpacity
    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        const lngLat = this.map.unproject ? this.map.unproject([x, y]) : null
        if (!lngLat) continue
        const lon = lngLat.lng ?? lngLat.lon
        const lat = lngLat.lat
        const vector = this.sampler.sample(lon, lat)
        if (!vector) continue
        this.speedCtx.fillStyle = pickWindSpeedColor(vector.speed).color
        this.speedCtx.fillRect(x, y, step, step)
      }
    }
    this.speedCtx.restore?.()
  }
}

export default CanvasWindRenderer
