import { msToKt, windBarbFeathers, windDirectionFromUV, isothermSegments, pressureToFallbackFt } from './lib/crossSectionGrid.js'

const M_TO_FT = 3.28084

function formatFt(value) {
  if (!Number.isFinite(value)) return '--'
  return `${Math.round(value).toLocaleString()} ft`
}

function formatNm(value) {
  if (!Number.isFinite(value)) return '--'
  return `${Math.abs(value).toFixed(1)}NM`
}

function buildPath(points) {
  if (points.length === 0) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

function fitMarkerLabel(label) {
  const value = String(label ?? '')
  return value.length > 10 ? `${value.slice(0, 9)}...` : value
}

function getAltitudeHeadroomFt(cruiseAltitudeFt) {
  return cruiseAltitudeFt <= 10000 ? 5000 : 10000
}

function assignMarkerLanes(markers, xFor) {
  return markers.map((marker, index) => {
    const x = xFor(marker.distanceNm)
    return { ...marker, x, lane: index % 2 }
  })
}

function icingColor(g) {
  return ['rgba(0,0,0,0)', 'rgba(120,180,255,0.35)', 'rgba(120,120,255,0.5)', 'rgba(150,80,220,0.6)'][Math.max(0, Math.min(3, Math.round(g)))]
}
function moistureColor(p) {
  if (!Number.isFinite(p)) return 'rgba(0,0,0,0)'
  const a = Math.max(0, Math.min(1, p / 100))
  return `rgba(60,140,90,${(0.15 + a * 0.45).toFixed(2)})`
}
function WindBarb({ cx, cy, u, v }) {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null
  const kt = msToKt(Math.hypot(u, v))
  if (kt < 2.5) return <circle cx={cx} cy={cy} r={2.5} className="cs-wind-calm" />
  const { pennants, full, half } = windBarbFeathers(kt)
  const dir = windDirectionFromUV(u, v)
  const fromRad = (dir * Math.PI) / 180
  const size = 18
  const tx = cx + Math.sin(fromRad) * size
  const ty = cy - Math.cos(fromRad) * size
  const sdx = (tx - cx) / size
  const sdy = (ty - cy) / size
  const px = -sdy; const py = sdx
  const barbLen = size * 0.7
  const STEP = size * 0.28
  const parts = [`M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`]
  let pos = 0
  for (let i = 0; i < pennants; i += 1) {
    const bx = tx - sdx * pos; const by = ty - sdy * pos
    const mx = bx - sdx * STEP; const my = by - sdy * STEP
    parts.push(`M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + px * barbLen).toFixed(1)} ${(by + py * barbLen).toFixed(1)} L ${mx.toFixed(1)} ${my.toFixed(1)} Z`)
    pos += STEP * 1.2
  }
  for (let i = 0; i < full; i += 1) {
    const bx = tx - sdx * pos; const by = ty - sdy * pos
    parts.push(`M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + px * barbLen).toFixed(1)} ${(by + py * barbLen).toFixed(1)}`)
    pos += STEP
  }
  if (half > 0) {
    const bx = tx - sdx * pos; const by = ty - sdy * pos
    parts.push(`M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + px * barbLen * 0.5).toFixed(1)} ${(by + py * barbLen * 0.5).toFixed(1)}`)
  }
  return <path d={parts.join(' ')} className="cs-wind-barb" />
}

export default function VerticalProfileChart({ profile, crossSection = null, layers = {} }) {
  const samples = profile?.axis?.samples ?? []
  const terrainValues = profile?.terrain?.values ?? []
  const cruiseAltitudeFt = profile?.flightPlan?.plannedCruiseAltitudeFt
  const markers = profile?.markers ?? []
  const flightProfile = profile?.flightPlan?.profile ?? null

  if (samples.length < 2) {
    return (
      <div className="vertical-profile-empty">
        {'\uc5f0\uc9c1\ub2e8\uba74\ub3c4 \uc0d8\ud50c\uc774 \ubd80\uc871\ud569\ub2c8\ub2e4.'}
      </div>
    )
  }

  const terrainByIndex = new Map(terrainValues.map((value) => [value.index, value.elevationM]))
  const terrainPoints = samples
    .map((sample) => ({
      distanceNm: sample.distanceNm,
      elevationFt: terrainByIndex.get(sample.index) == null ? null : terrainByIndex.get(sample.index) * M_TO_FT,
    }))
    .filter((point) => Number.isFinite(point.elevationFt))

  if (terrainPoints.length === 0) {
    return (
      <div className="vertical-profile-empty">
        {'\ud45c\uc2dc\ud560 \uc9c0\ud615\uace0\ub3c4 \uc0d8\ud50c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.'}
      </div>
    )
  }

  const width = 960
  const height = 380
  const padding = { top: 26, right: 26, bottom: 96, left: 58 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxDistance = Math.max(profile.axis.totalDistanceNm || 0, samples[samples.length - 1].distanceNm || 0.1)
  const terrainMaxFt = Math.max(...terrainPoints.map((point) => point.elevationFt), 0)
  const procedurePoints = (flightProfile?.points ?? [])
    .filter((point) => Number.isFinite(point.distanceNm) && Number.isFinite(point.altitudeFt))
  const procedureMaxFt = procedurePoints.length > 0 ? Math.max(...procedurePoints.map((point) => point.altitudeFt)) : 0
  const profileCeilingFt = Math.max(terrainMaxFt, cruiseAltitudeFt || 0, procedureMaxFt)
  const headroomFt = Number.isFinite(cruiseAltitudeFt) ? getAltitudeHeadroomFt(cruiseAltitudeFt) : 5000
  const yMax = Math.max(1000, Math.ceil((profileCeilingFt + headroomFt) / 1000) * 1000)
  const xFor = (distanceNm) => padding.left + (distanceNm / maxDistance) * plotWidth
  const yFor = (altitudeFt) => padding.top + plotHeight - (altitudeFt / yMax) * plotHeight
  const terrainSvgPoints = terrainPoints.map((point) => ({ x: xFor(point.distanceNm), y: yFor(point.elevationFt) }))
  const terrainLine = buildPath(terrainSvgPoints)
  const terrainArea = `${terrainLine} L ${xFor(terrainPoints[terrainPoints.length - 1].distanceNm).toFixed(1)} ${yFor(0).toFixed(1)} L ${xFor(terrainPoints[0].distanceNm).toFixed(1)} ${yFor(0).toFixed(1)} Z`
  const procedureLine = buildPath(procedurePoints.map((point) => ({ x: xFor(point.distanceNm), y: yFor(point.altitudeFt) })))
  const tod = flightProfile?.tod
  const todMarker = tod && Number.isFinite(tod.distanceNm) && tod.distanceNm >= 0 && tod.distanceNm <= maxDistance
    ? { ...tod, x: xFor(tod.distanceNm), y: yFor(cruiseAltitudeFt) }
    : null
  const todOffsetText = todMarker && Number.isFinite(todMarker.distanceFromEnrouteEndNm)
    ? `TOD: ${todMarker.referenceFixLabel ?? 'ENROUTE'} ${formatNm(todMarker.distanceFromEnrouteEndNm)} ${todMarker.distanceFromEnrouteEndNm >= 0 ? '\uc804' : '\ud6c4'}`
    : null
  const climbGradient = flightProfile?.model?.climbGradientFtPerNm
  const descentGradient = flightProfile?.model?.descentGradientFtPerNm
  const todLabelY = todMarker ? Math.max(padding.top + 14, todMarker.y - 30) : 0
  const todArrowTopY = todMarker ? Math.max(todLabelY + 7, todMarker.y - 21) : 0
  const todArrowTipY = todMarker ? Math.min(todMarker.y - 7, todArrowTopY + 10) : 0
  const yTicks = [0, yMax / 2, yMax]
  const cruiseTick = Number.isFinite(cruiseAltitudeFt) && cruiseAltitudeFt > 0 && cruiseAltitudeFt < yMax
    ? cruiseAltitudeFt
    : null
  const visibleMarkers = markers
    .filter((marker) => Number.isFinite(marker.distanceNm) && marker.distanceNm >= 0 && marker.distanceNm <= maxDistance)
    .map((marker, index) => ({ ...marker, key: `${marker.label}-${index}` }))
  const markerLabels = assignMarkerLanes(visibleMarkers, xFor)

  const csLevels = crossSection?.levels ?? []
  const altFor = (lvl) => Number.isFinite(lvl.altFt) ? lvl.altFt : pressureToFallbackFt(lvl.pressure)
  const shadingCells = (() => {
    if (!crossSection || (!layers.icing && !layers.moisture)) return []
    const cells = []
    for (let li = 0; li < csLevels.length - 1; li += 1) {
      const lvl = csLevels[li]
      const lvlNext = csLevels[li + 1]
      const yA = yFor(altFor(lvl))
      const yB = yFor(altFor(lvlNext))
      const yTop = Math.min(yA, yB)
      const yBot = Math.max(yA, yB)
      for (let vi = 0; vi < lvl.values.length - 1; vi += 1) {
        const v = lvl.values[vi]
        const vNext = lvl.values[vi + 1]
        const xLeft = xFor(v.distanceNm)
        const xRight = xFor(vNext.distanceNm)
        const fill = layers.icing && v.icing != null
          ? icingColor(v.icing)
          : layers.moisture && v.cloudPotential != null
            ? moistureColor(v.cloudPotential)
            : null
        if (fill && fill !== 'rgba(0,0,0,0)') {
          cells.push({ key: `${li}-${vi}`, x: xLeft, y: yTop, w: xRight - xLeft, h: yBot - yTop, fill })
        }
      }
    }
    return cells
  })()
  const tempIsotherms = (() => {
    if (!crossSection || !layers.temp || csLevels.length < 2) return []
    const sampleCount = csLevels[0]?.values?.length ?? 0
    if (sampleCount < 2) return []
    const xs = csLevels[0].values.map((v) => xFor(v.distanceNm))
    const ys = csLevels.map((lvl) => yFor(altFor(lvl)))
    const values = csLevels.flatMap((lvl) => lvl.values.map((v) => v.t))
    const cells = { nx: sampleCount, ny: csLevels.length, values, xs, ys }
    const finiteTs = values.filter(Number.isFinite)
    if (finiteTs.length === 0) return []
    const minT = Math.min(...finiteTs)
    const maxT = Math.max(...finiteTs)
    const result = []
    for (let t = Math.ceil(minT / 5) * 5; t <= maxT; t += 5) {
      result.push({ level: t, bold: t === 0, segments: isothermSegments(cells, t) })
    }
    return result
  })()
  const windBarbs = crossSection && layers.wind ? csLevels.flatMap((lvl) =>
    lvl.values.map((v) => ({ key: `w-${lvl.pressure}-${v.distanceNm}`, cx: xFor(v.distanceNm), cy: yFor(altFor(lvl)), u: v.u, v: v.v }))
  ) : []

  return (
    <div className="vertical-profile-chart">
      <div className="vertical-profile-meta">
        <span className="vertical-profile-meta-item">
          <span>{'\uc9c0\ud615\uace0\ub3c4'}</span>
          <strong>{formatFt(terrainMaxFt)}</strong>
        </span>
        <span className="vertical-profile-meta-item">
          <span>{'\uc21c\ud56d\uace0\ub3c4'}</span>
          <strong>{formatFt(cruiseAltitudeFt)}</strong>
        </span>
        {procedurePoints.length > 1 && (
          <span className="vertical-profile-procedure-badge">{flightProfile.label}</span>
        )}
        {todOffsetText && (
          <span className="vertical-profile-tod-summary">{todOffsetText}</span>
        )}
        {Number.isFinite(climbGradient) && Number.isFinite(descentGradient) && (
          <details className="vertical-profile-model-info">
            <summary aria-label="\uace0\ub3c4 \ud504\ub85c\ud30c\uc77c \uacc4\uc0b0 \uae30\uc900">i</summary>
            <div>
              <strong>{'\uacc4\uc0b0 \uae30\uc900'}</strong>
              <span>{`\uc0c1\uc2b9 ${climbGradient} ft/NM, \ud558\uac15 ${descentGradient} ft/NM \uae30\uc900\uc758 \ub2e8\uc21c \uc120\ud615 \ud504\ub85c\ud30c\uc77c\uc785\ub2c8\ub2e4.`}</span>
              <span>{'SID \uc0c1\ud55c\uace0\ub3c4\ub294 \ucd94\uac00 \uc0c1\uc2b9\uc744 \uc81c\ud55c\ud558\uace0, STAR/IAP \ud558\ud55c\uace0\ub3c4\ub294 \ucd94\uac00 \ud558\uac15\uc744 \uc81c\ud55c\ud569\ub2c8\ub2e4.'}</span>
              <span>{'\uc2e4\uc81c \ud56d\uacf5\uae30 \uc131\ub2a5, \uc911\ub7c9, ATC \uc9c0\uc2dc, \uae30\uc0c1\uc740 \ubc18\uc601\ud558\uc9c0 \uc54a\uc740 \uae30\uc220\uc2e4\uc99d\uc6a9 \uacc4\ud68d\uc120\uc785\ub2c8\ub2e4.'}</span>
            </div>
          </details>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Vertical profile">
        <defs>
          <clipPath id="cs-clip">
            <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>
        <rect className="vertical-profile-plot" x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} />
        <g clipPath="url(#cs-clip)">
          {shadingCells.map((cell) => (
            <rect key={cell.key} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={cell.fill} />
          ))}
          {tempIsotherms.flatMap(({ level, bold, segments }) =>
            segments.map((seg, si) => (
              <line key={`t${level}-${si}`} x1={seg[0].x.toFixed(1)} y1={seg[0].y.toFixed(1)} x2={seg[1].x.toFixed(1)} y2={seg[1].y.toFixed(1)} className={bold ? 'cs-isotherm cs-isotherm-zero' : 'cs-isotherm'} />
            ))
          )}
          {windBarbs.map((wb) => <WindBarb key={wb.key} cx={wb.cx} cy={wb.cy} u={wb.u} v={wb.v} />)}
        </g>
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="vertical-profile-grid" x1={padding.left} x2={padding.left + plotWidth} y1={yFor(tick)} y2={yFor(tick)} />
            <text className="vertical-profile-axis-label" x={padding.left - 8} y={yFor(tick) + 4} textAnchor="end">{Math.round(tick)}</text>
          </g>
        ))}
        {cruiseTick != null && (
          <g>
            <line className="vertical-profile-cruise-tick" x1={padding.left - 6} x2={padding.left} y1={yFor(cruiseTick)} y2={yFor(cruiseTick)} />
            <text className="vertical-profile-cruise-axis-label" x={padding.left - 8} y={yFor(cruiseTick) + 4} textAnchor="end">
              {formatFt(cruiseTick)}
            </text>
          </g>
        )}
        {markerLabels.map((marker, index) => (
          <g key={marker.key}>
            <line
              className="vertical-profile-marker-tick"
              x1={marker.x}
              x2={marker.x}
              y1={padding.top + plotHeight}
              y2={padding.top + plotHeight + 10 + marker.lane * 18}
            />
            <text
              className="vertical-profile-marker-label"
              x={marker.x}
              y={height - 34 + marker.lane * 22}
              textAnchor={index === 0 ? 'start' : index === visibleMarkers.length - 1 ? 'end' : 'middle'}
            >
              {fitMarkerLabel(marker.label)}
            </text>
          </g>
        ))}
        <path className="vertical-profile-terrain-area" d={terrainArea} />
        <path className="vertical-profile-terrain-line" d={terrainLine} />
        {procedureLine && <path className="vertical-profile-procedure-line" d={procedureLine} />}
        {todMarker && (
          <g>
            <text
              className="vertical-profile-tod-label"
              x={todMarker.x}
              y={todLabelY}
              textAnchor="middle"
            >
              TOD
            </text>
            <path
              className="vertical-profile-tod-arrow"
              d={`M ${todMarker.x.toFixed(1)} ${todArrowTopY.toFixed(1)} L ${todMarker.x.toFixed(1)} ${todArrowTipY.toFixed(1)} M ${(todMarker.x - 4).toFixed(1)} ${(todArrowTipY - 4).toFixed(1)} L ${todMarker.x.toFixed(1)} ${todArrowTipY.toFixed(1)} L ${(todMarker.x + 4).toFixed(1)} ${(todArrowTipY - 4).toFixed(1)}`}
            />
          </g>
        )}
      </svg>
    </div>
  )
}
