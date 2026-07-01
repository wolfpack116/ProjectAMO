import { useState } from 'react'
import useIsMobile from '../../shared/ui/useIsMobile.js'

function WeatherLegends({
  radarLegendVisible,
  lightningLegendVisible,
  blinkLightning = false,
  onBlinkLightningChange,
  radarRainrateLegend,
  lightningLegendEntries,
  windSpeedLegendVisible,
  windSpeedLegendEntries = [],
  temperatureLegendVisible,
  temperatureLegendEntries = [],
  cloudLegendVisible,
  cloudLegendEntries = [],
  icingLegendVisible,
  icingLegendEntries = [],
  turbulenceLegendVisible,
  turbulenceLegendEntries = [],
  radarReferenceTimeMs,
  lightningReferenceTimeMs,
  formatReferenceTimeLabel,
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  if (!radarLegendVisible && !lightningLegendVisible && !windSpeedLegendVisible && !temperatureLegendVisible && !cloudLegendVisible && !icingLegendVisible && !turbulenceLegendVisible) return null

  const panel = (
    <div className="map-right-legends">
      {radarLegendVisible && (
        <div className="rainrate-legend" aria-label="Radar rain rate legend">
          <div className="rainrate-legend-title">mm/h</div>
          <div className="rainrate-legend-scale">
            {radarRainrateLegend.map((entry) => (
              <div key={entry.label} className="rainrate-legend-row">
                <span className="rainrate-legend-label">{entry.label}</span>
                <span
                  className="rainrate-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {lightningLegendVisible && (
        <div className="lightning-time-legend" aria-label="Lightning time legend">
          <div className="lightning-time-legend-title">LIGHTNING</div>
          <div className="lightning-time-legend-sub">10 MIN</div>
          <div className="lightning-time-legend-current">
            {formatReferenceTimeLabel(radarLegendVisible ? radarReferenceTimeMs : lightningReferenceTimeMs)}
          </div>
          <div className="lightning-time-legend-scale">
            {lightningLegendEntries.map((entry) => (
              <div key={entry.iconId} className="lightning-time-legend-row">
                <span className="lightning-time-legend-label">{entry.label}</span>
                <span
                  className="lightning-time-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
          {isMobile && (
            <button
              type="button"
              className={`lightning-legend-blink${blinkLightning ? ' is-on' : ''}`}
              onClick={() => onBlinkLightningChange?.((prev) => !prev)}
              aria-pressed={blinkLightning}
            >
              깜빡임 {blinkLightning ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
      )}
      {windSpeedLegendVisible && (
        <div className="wind-speed-legend" aria-label="Wind speed legend">
          <div className="wind-speed-legend-title">kt</div>
          <div className="wind-speed-legend-scale">
            {windSpeedLegendEntries.map((entry) => (
              <div key={entry.label} className="wind-speed-legend-row">
                <span className="wind-speed-legend-label">{entry.label}</span>
                <span
                  className="wind-speed-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {temperatureLegendVisible && (
        <div className="temperature-legend" aria-label="Temperature legend">
          <div className="temperature-legend-title">C</div>
          <div className="temperature-legend-scale">
            {temperatureLegendEntries.map((entry) => (
              <div key={entry.label} className="temperature-legend-row">
                <span className="temperature-legend-label">{entry.label}</span>
                <span
                  className="temperature-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {cloudLegendVisible && (
        <div className="temperature-legend" aria-label="Dewpoint spread legend">
          <div className="temperature-legend-title">T-Td C</div>
          <div className="temperature-legend-scale">
            {cloudLegendEntries.map((entry) => (
              <div key={entry.label} className="temperature-legend-row">
                <span className="temperature-legend-label">{entry.label}</span>
                <span
                  className="temperature-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {icingLegendVisible && (
        <div className="temperature-legend" aria-label="Icing potential legend">
          <div className="temperature-legend-title">Icing Potential</div>
          <div className="temperature-legend-scale">
            {icingLegendEntries.map((entry) => (
              <div key={entry.label} className="temperature-legend-row">
                <span className="temperature-legend-label">{entry.label}</span>
                <span
                  className="temperature-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {turbulenceLegendVisible && (
        <div className="temperature-legend" aria-label="Turbulence legend">
          <div className="temperature-legend-title">Turbulence</div>
          <div className="temperature-legend-scale">
            {turbulenceLegendEntries.map((entry) => (
              <div key={entry.label} className="temperature-legend-row">
                <span className="temperature-legend-label">{entry.label}</span>
                <span
                  className="temperature-legend-swatch"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // 모바일: 범례를 상시 노출 대신 '범례' 토글 버튼 뒤로 접어 화면 절약. 데스크톱은 상시 노출.
  if (!isMobile) return panel
  return (
    <div className="map-legends-mobile">
      <button
        type="button"
        className={`map-legend-toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? '범례 ✕' : '범례'}
      </button>
      {open && panel}
    </div>
  )
}

export default WeatherLegends
