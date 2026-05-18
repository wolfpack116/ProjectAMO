import {
  WIND_SPEED_COLOR_RAMP,
  createWindFieldSampler,
  decodeWindComponent,
} from './windField.js'

const DEFAULTS = {
  desktopCap: 5000,
  mobileCap: 1800,
  maxAge: 80,
  speedFactor: 0.45,
  frameCap: 30,
  speedOpacity: 0.35,
  sampleStep: 4,
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function isMobileViewport(width) {
  return width < 720
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

function parseRampColor(color) {
  const match = color.match(/rgba\(([^)]+)\)/)
  if (!match) return [1, 1, 1, 1]
  const [r, g, b, a] = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
  return [r / 255, g / 255, b / 255, a]
}

function createSpeedFragmentShader() {
  const rampBranches = WIND_SPEED_COLOR_RAMP.map((entry, index) => {
    const color = parseRampColor(entry.color)
    const rgba = [color[0], color[1], color[2], color[3]]
    const condition = Number.isFinite(entry.max)
      ? `if (speed < ${entry.max.toFixed(1)}) return vec4(${rgba.join(', ')});`
      : `return vec4(${rgba.join(', ')});`
    if (index === 0) {
      return `  ${condition}`
    }
    return `  ${condition}`
  }).join('\n')

  return `
precision mediump float;
varying float v_speed;
uniform float u_opacity;

vec4 pickSpeedColor(float speed) {
${rampBranches}
}

void main() {
  vec4 color = pickSpeedColor(v_speed);
  gl_FragColor = vec4(color.rgb, color.a * u_opacity);
}
`
}

function createParticleFragmentShader() {
  const rampBranches = WIND_SPEED_COLOR_RAMP.map((entry) => {
    const color = parseRampColor(entry.color)
    const alpha = Math.min(0.9, Math.max(0.5, color[3] + 0.42))
    const rgba = [color[0], color[1], color[2], alpha]
    if (Number.isFinite(entry.max)) {
      return `  if (v_speed < ${entry.max.toFixed(1)}) return vec4(${rgba.join(', ')});`
    }
    return `  return vec4(${rgba.join(', ')});`
  }).join('\n')

  return `
precision mediump float;
varying float v_speed;

vec4 pickParticleColor(float speed) {
${rampBranches}
}

void main() {
  gl_FragColor = pickParticleColor(v_speed);
}
`
}

const FADE_FRAGMENT_SHADER = `
precision mediump float;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.94);
}
`

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog?.() || 'Shader compile failed'
    gl.deleteShader?.(shader)
    throw new Error(error)
  }
  return shader
}

function createProgram(gl, vertexSource, fragmentSource) {
  let vertexShader
  let fragmentShader
  let program
  try {
    vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
    fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog?.() || 'Program link failed')
    }
    return program
  } catch (error) {
    if (program) gl.deleteProgram?.(program)
    throw error
  } finally {
    if (vertexShader) gl.deleteShader?.(vertexShader)
    if (fragmentShader) gl.deleteShader?.(fragmentShader)
  }
}

function createVectorTextureData(windField) {
  const size = windField.grid.nx * windField.grid.ny * 4
  const data = new Uint8Array(size)
  for (let index = 0; index < windField.grid.nx * windField.grid.ny; index += 1) {
    const u = decodeWindComponent(windField.u[index], windField) ?? 0
    const v = decodeWindComponent(windField.v[index], windField) ?? 0
    const offset = index * 4
    data[offset] = Math.max(0, Math.min(255, Math.round(u * 8 + 128)))
    data[offset + 1] = Math.max(0, Math.min(255, Math.round(v * 8 + 128)))
    data[offset + 2] = 0
    data[offset + 3] = 255
  }
  return data
}

function makeParticle(bounds, maxAge) {
  return {
    lon: bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest()),
    lat: bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth()),
    age: Math.floor(Math.random() * maxAge),
    maxAge,
    prevLon: null,
    prevLat: null,
    speed: 0,
  }
}

const QUAD_VERTICES = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  1, 1,
])

const FULLSCREEN_VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const SPEED_VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_speed;
uniform vec2 u_resolution;
varying float v_speed;
void main() {
  vec2 clip = ((a_position / u_resolution) * 2.0) - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_speed = a_speed;
}
`

const PARTICLE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_speed;
uniform vec2 u_resolution;
varying float v_speed;
void main() {
  vec2 clip = ((a_position / u_resolution) * 2.0) - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = 1.8;
  v_speed = a_speed;
}
`

export class WebGLWindRenderer {
  constructor(map, options = {}) {
    this.type = 'webgl'
    this.map = map
    this.options = { ...DEFAULTS, ...options }
    this.onFailure = options.onFailure
    this.container = map.getContainer()
    this.speedCanvas = createOverlayCanvas('webgl-speed', '3')
    this.flowCanvas = createOverlayCanvas('webgl', '4')
    this.canvas = this.flowCanvas
    this.visibility = { flow: false, speed: false }
    this.windField = null
    this.sampler = { sample: () => null }
    this.particles = []
    this.segmentVertexCount = 0
    this.pointVertexCount = 0
    this.frameId = null
    this.lastFrameAt = 0
    this.destroyed = false
    this.failed = false
    this.activeUploadVersion = 0
    this.handleContextLost = (event) => {
      event.preventDefault?.()
      this.failed = true
      this.stop()
      this.onFailure?.()
    }

    try {
      this.container.appendChild(this.speedCanvas)
      this.container.appendChild(this.flowCanvas)
      const contextOptions = { alpha: true, preserveDrawingBuffer: true }
      this.speedGl = this.speedCanvas.getContext('webgl', contextOptions) || this.speedCanvas.getContext('experimental-webgl', contextOptions)
      this.gl = this.flowCanvas.getContext('webgl', contextOptions) || this.flowCanvas.getContext('experimental-webgl', contextOptions)
      if (!this.speedGl || !this.gl) throw new Error('WebGL unavailable')
      this.speedCanvas.addEventListener('webglcontextlost', this.handleContextLost)
      this.flowCanvas.addEventListener('webglcontextlost', this.handleContextLost)
      this.initResources()
      this.resize()
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  initResources() {
    const gl = this.gl
    this.particleProgram = createProgram(gl, PARTICLE_VERTEX_SHADER, createParticleFragmentShader())
    this.fadeProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, FADE_FRAGMENT_SHADER)
    this.quadBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)
    this.particleBuffer = gl.createBuffer()
    this.windTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture)
    gl.texParameteri(gl.TEXTURE_2D, 0x2801, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, 0x2800, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, 0x2802, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, 0x2803, gl.CLAMP_TO_EDGE)
    gl.enable?.(gl.BLEND)
    gl.blendFunc?.(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const speedGl = this.speedGl
    this.speedProgram = createProgram(speedGl, SPEED_VERTEX_SHADER, createSpeedFragmentShader())
    this.speedBuffer = speedGl.createBuffer()
    speedGl.enable?.(speedGl.BLEND)
    speedGl.blendFunc?.(speedGl.SRC_ALPHA, speedGl.ONE_MINUS_SRC_ALPHA)
  }

  setData(windField, commit = {}) {
    const version = commit.version ?? this.activeUploadVersion + 1
    this.activeUploadVersion = version
    this.pendingWindField = windField
    if (this.failed || this.destroyed) return Promise.resolve(false)
    if (commit.isCurrent && !commit.isCurrent()) return Promise.resolve(false)

    const gl = this.gl
    const textureData = createVectorTextureData(windField)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture)
    if (commit.isCurrent && !commit.isCurrent()) return Promise.resolve(false)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      windField.grid.nx,
      windField.grid.ny,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      textureData,
    )
    if (commit.isCurrent && !commit.isCurrent()) return Promise.resolve(false)

    this.windField = windField
    this.pendingWindField = null
    this.sampler = createWindFieldSampler(windField)
    this.ensureParticles()
    this.buildParticleGeometry()
    this.buildSpeedGeometry()
    this.redraw()
    return Promise.resolve(true)
  }

  setVisibility({ flow = false, speed = false } = {}) {
    this.visibility = { flow, speed }
    this.flowCanvas.style.display = flow ? 'block' : 'none'
    this.speedCanvas.style.display = speed ? 'block' : 'none'
    if (flow) this.start()
    else this.stop()
    this.redraw()
  }

  resize() {
    const rect = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.width = Math.max(1, Math.round(rect.width))
    this.height = Math.max(1, Math.round(rect.height))
    this.flowCanvas.width = Math.round(this.width * dpr)
    this.flowCanvas.height = Math.round(this.height * dpr)
    this.speedCanvas.width = this.flowCanvas.width
    this.speedCanvas.height = this.flowCanvas.height
    this.gl.viewport(0, 0, this.flowCanvas.width, this.flowCanvas.height)
    this.speedGl.viewport(0, 0, this.speedCanvas.width, this.speedCanvas.height)
    this.ensureParticles()
    this.buildParticleGeometry()
    this.buildSpeedGeometry()
    this.redraw()
  }

  ensureParticles() {
    if (!this.windField || !this.width || !this.height) return
    const cap = isMobileViewport(this.width) ? this.options.mobileCap : this.options.desktopCap
    const count = clamp(Math.round((this.width * this.height) / 450), 64, cap)
    const bounds = this.map.getBounds()
    while (this.particles.length < count) {
      this.particles.push(makeParticle(bounds, this.options.maxAge))
    }
    if (this.particles.length > count) this.particles.length = count
  }

  start() {
    if (this.frameId || !this.visibility.flow || this.failed || !this.windField) return
    this.frameId = window.requestAnimationFrame((time) => this.frame(time))
  }

  stop() {
    if (!this.frameId) return
    window.cancelAnimationFrame(this.frameId)
    this.frameId = null
  }

  frame(time) {
    this.frameId = null
    if (!this.visibility.flow || this.failed || this.destroyed) return
    const minFrameMs = 1000 / this.options.frameCap
    if (!this.lastFrameAt || time - this.lastFrameAt >= minFrameMs) {
      this.stepParticles()
      this.lastFrameAt = time
    }
    this.drawFrame()
    this.start()
  }

  reseedParticle(particle, bounds) {
    Object.assign(particle, makeParticle(bounds, this.options.maxAge))
  }

  stepParticles() {
    if (!this.windField) return
    const bounds = this.map.getBounds()
    for (const particle of this.particles) {
      const vector = this.sampler.sample(particle.lon, particle.lat)
      if (
        !vector
        || particle.age >= particle.maxAge
        || particle.lon < bounds.getWest()
        || particle.lon > bounds.getEast()
        || particle.lat < bounds.getSouth()
        || particle.lat > bounds.getNorth()
      ) {
        this.reseedParticle(particle, bounds)
        continue
      }

      particle.prevLon = particle.lon
      particle.prevLat = particle.lat
      particle.speed = vector.speed
      particle.lon += vector.u * this.options.speedFactor * 0.002
      particle.lat += vector.v * this.options.speedFactor * 0.002
      particle.age += 1
    }
    this.buildParticleGeometry()
  }

  buildParticleGeometry() {
    if (!this.windField || !this.width || !this.height) return
    const segmentData = []
    for (const particle of this.particles) {
      const from = this.map.project([
        Number.isFinite(particle.prevLon) ? particle.prevLon : particle.lon,
        Number.isFinite(particle.prevLat) ? particle.prevLat : particle.lat,
      ])
      const to = this.map.project([particle.lon, particle.lat])
      const speed = particle.speed ?? 0
      segmentData.push(from.x, from.y, speed)
      segmentData.push(to.x, to.y, speed)
    }

    this.particleVertexData = new Float32Array(segmentData)
    this.segmentVertexCount = this.particleVertexData.length / 3
    this.pointVertexCount = this.segmentVertexCount

    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.particleVertexData, gl.STATIC_DRAW)
  }

  buildSpeedGeometry() {
    if (!this.windField || !this.width || !this.height || !this.map.unproject) return
    const step = this.width > 1440 ? 2 : this.options.sampleStep
    const speedData = []
    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        const lngLat = this.map.unproject([x, y])
        const lon = lngLat.lng ?? lngLat.lon
        const vector = this.sampler.sample(lon, lngLat.lat)
        if (!vector) continue
        const x1 = Math.min(this.width, x + step)
        const y1 = Math.min(this.height, y + step)
        speedData.push(x, y, vector.speed)
        speedData.push(x1, y, vector.speed)
        speedData.push(x, y1, vector.speed)
        speedData.push(x1, y, vector.speed)
        speedData.push(x1, y1, vector.speed)
        speedData.push(x, y1, vector.speed)
      }
    }

    this.speedVertexData = new Float32Array(speedData)
    this.speedVertexCount = this.speedVertexData.length / 3
    const gl = this.speedGl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.speedBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.speedVertexData, gl.STATIC_DRAW)
  }

  redraw() {
    if (this.failed || this.destroyed) return
    if (this.visibility.speed) this.drawSpeedLayer()
    else this.clearSpeedLayer()
    if (!this.visibility.flow) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
      return
    }
    this.drawFrame()
  }

  drawFrame() {
    if (!this.windField || this.failed || this.destroyed) return
    const gl = this.gl
    if (this.visibility.flow) {
      this.drawFadePass()
      this.drawParticles()
    } else if (!this.visibility.speed) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  drawSpeedLayer() {
    if (!this.speedVertexCount) return
    const gl = this.speedGl
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.speedProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.speedBuffer)
    const positionLocation = gl.getAttribLocation(this.speedProgram, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 12, 0)
    const speedLocation = gl.getAttribLocation(this.speedProgram, 'a_speed')
    gl.enableVertexAttribArray(speedLocation)
    gl.vertexAttribPointer(speedLocation, 1, gl.FLOAT, false, 12, 8)
    const resolutionLocation = gl.getUniformLocation(this.speedProgram, 'u_resolution')
    gl.uniform2f(resolutionLocation, this.width, this.height)
    const opacityLocation = gl.getUniformLocation(this.speedProgram, 'u_opacity')
    gl.uniform1f(opacityLocation, this.options.speedOpacity ?? 1)
    gl.drawArrays(gl.TRIANGLES, 0, this.speedVertexCount)
  }

  clearSpeedLayer() {
    const gl = this.speedGl
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  drawFadePass() {
    const gl = this.gl
    gl.blendFunc?.(gl.ZERO ?? 0, gl.SRC_ALPHA)
    gl.useProgram(this.fadeProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    const positionLocation = gl.getAttribLocation(this.fadeProgram, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.blendFunc?.(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  drawParticles() {
    const gl = this.gl
    gl.useProgram(this.particleProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    const positionLocation = gl.getAttribLocation(this.particleProgram, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 12, 0)
    const speedLocation = gl.getAttribLocation(this.particleProgram, 'a_speed')
    gl.enableVertexAttribArray(speedLocation)
    gl.vertexAttribPointer(speedLocation, 1, gl.FLOAT, false, 12, 8)
    const resolutionLocation = gl.getUniformLocation(this.particleProgram, 'u_resolution')
    gl.uniform2f(resolutionLocation, this.width, this.height)
    gl.drawArrays(gl.LINES, 0, this.segmentVertexCount)
    gl.drawArrays(gl.POINTS, 0, this.pointVertexCount)
  }

  destroy() {
    this.stop()
    this.destroyed = true
    this.speedCanvas?.removeEventListener?.('webglcontextlost', this.handleContextLost)
    this.flowCanvas?.removeEventListener?.('webglcontextlost', this.handleContextLost)
    this.gl?.deleteProgram?.(this.particleProgram)
    this.gl?.deleteProgram?.(this.fadeProgram)
    this.gl?.deleteBuffer?.(this.quadBuffer)
    this.gl?.deleteBuffer?.(this.particleBuffer)
    this.gl?.deleteTexture?.(this.windTexture)
    this.speedGl?.deleteProgram?.(this.speedProgram)
    this.speedGl?.deleteBuffer?.(this.speedBuffer)
    if (this.flowCanvas?.parentNode) this.flowCanvas.parentNode.removeChild(this.flowCanvas)
    if (this.speedCanvas?.parentNode) this.speedCanvas.parentNode.removeChild(this.speedCanvas)
  }
}

export default WebGLWindRenderer
