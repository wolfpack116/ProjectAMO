function WeatherLegends({
  radarLegendVisible,
  lightningLegendVisible,
  radarRainrateLegend,
  lightningLegendEntries,
  windSpeedLegendVisible,
  windSpeedLegendEntries = [],
  radarReferenceTimeMs,
  lightningReferenceTimeMs,
  formatReferenceTimeLabel,
}) {
  if (!radarLegendVisible && !lightningLegendVisible && !windSpeedLegendVisible) return null

  return (
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
        </div>
      )}
      {windSpeedLegendVisible && (
        <div className="wind-speed-legend" aria-label="Wind speed legend">
          <div className="wind-speed-legend-title">m/s</div>
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
    </div>
  )
}

export default WeatherLegends
