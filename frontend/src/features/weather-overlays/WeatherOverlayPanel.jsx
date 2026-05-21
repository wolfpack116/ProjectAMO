function WeatherOverlayPanel({
  layers,
  visibility,
  blinkLightning,
  onToggle,
  onBlinkLightningChange,
  isLayerDisabled,
  getLayerBadge,
  showWind = true,
  windStatus = 'idle',
  windLowPower = false,
  windFlowOpacity = 0.8,
  windFlowTrail = 0.9,
  windFlowWidth = 1.5,
  tempStatus = 'idle',
  cloudStatus = 'idle',
  icingStatus = 'idle',
  onWindFlowOpacityChange,
  onWindFlowTrailChange,
  onWindFlowWidthChange,
}) {
  const groups = [
    { id: 'weather', title: '기상', ids: showWind ? ['radar', 'satellite', 'lightning', 'wind', 'temp', 'cloud', 'icing'] : ['radar', 'satellite', 'lightning'] },
    { id: 'hazards', title: '위험기상', ids: ['sigmet', 'airmet', 'sigwx'] },
    { id: 'traffic', title: '항적', ids: ['adsb'] },
  ]
  const layerLabels = {
    radar: '레이더',
    satellite: '위성',
    lightning: '낙뢰',
    wind: 'Wind',
    temp: 'Temp',
    cloud: 'Moisture',
    icing: 'Icing Potential',
    sigmet: 'SIGMET',
    airmet: 'AIRMET',
    sigwx: 'SIGWX',
    adsb: 'ADS-B',
  }
  const visibleLayers = layers.filter((layer) => showWind || !['wind', 'temp', 'cloud', 'icing'].includes(layer.id))
  const activeCount = visibleLayers.filter((layer) => visibility[layer.id] && !isLayerDisabled(layer.id)).length
  const layerById = new Map(visibleLayers.map((layer) => [layer.id, layer]))
  const activeCountForGroup = (group) => (
    group.ids.filter((id) => visibility[id] && !isLayerDisabled(id)).length
  )

  function renderWindControl(layer) {
    const disabled = isLayerDisabled(layer.id)
    const showLowPower = visibility.wind && windLowPower && !visibility.windFlow
    return (
      <div key={layer.id} className={`wind-toggle-block${disabled ? ' is-disabled' : ''}`}>
        <label className={`layer-toggle-row${disabled ? ' is-disabled' : ''}`}>
          <input
            className="layer-toggle-input"
            type="checkbox"
            checked={!!visibility.wind}
            disabled={disabled}
            onChange={() => onToggle('wind')}
          />
          <span className="layer-toggle-switch" aria-hidden="true" />
          <span className="layer-toggle-swatch" style={{ background: layer.color }} />
          <span className="layer-toggle-label">{layerLabels.wind}</span>
        </label>
        {visibility.wind && (
          <div className="wind-toggle-subcontrols">
            <label className="layer-toggle-row layer-toggle-row--sub">
              <input
                className="layer-toggle-input"
                type="checkbox"
                checked={!!visibility.windFlow}
                onChange={() => onToggle('windFlow')}
              />
              <span className="layer-toggle-switch" aria-hidden="true" />
              <span className="layer-toggle-label">Flow</span>
            </label>
            {visibility.windFlow && (
              <label className="wind-flow-control">
                <span className="wind-flow-control-label">Tone</span>
                <input
                  className="wind-flow-control-slider"
                  type="range"
                  min="0.35"
                  max="0.9"
                  step="0.01"
                  value={windFlowOpacity}
                  onChange={(event) => onWindFlowOpacityChange?.(Number(event.target.value))}
                  aria-label="Wind flow tone"
                />
                <span className="wind-flow-control-value">{Math.round(windFlowOpacity * 100)}%</span>
              </label>
            )}
            {visibility.windFlow && (
              <label className="wind-flow-control">
                <span className="wind-flow-control-label">Trail</span>
                <input
                  className="wind-flow-control-slider"
                  type="range"
                  min="0.55"
                  max="0.94"
                  step="0.01"
                  value={windFlowTrail}
                  onChange={(event) => onWindFlowTrailChange?.(Number(event.target.value))}
                  aria-label="Wind flow trail"
                />
                <span className="wind-flow-control-value">{Math.round(windFlowTrail * 100)}%</span>
              </label>
            )}
            {visibility.windFlow && (
              <label className="wind-flow-control">
                <span className="wind-flow-control-label">Width</span>
                <input
                  className="wind-flow-control-slider"
                  type="range"
                  min="0.6"
                  max="2.4"
                  step="0.1"
                  value={windFlowWidth}
                  onChange={(event) => onWindFlowWidthChange?.(Number(event.target.value))}
                  aria-label="Wind flow width"
                />
                <span className="wind-flow-control-value">{windFlowWidth.toFixed(1)}</span>
              </label>
            )}
            <label className="layer-toggle-row layer-toggle-row--sub">
              <input
                className="layer-toggle-input"
                type="checkbox"
                checked={!!visibility.windSpeed}
                onChange={() => onToggle('windSpeed')}
              />
              <span className="layer-toggle-switch" aria-hidden="true" />
              <span className="layer-toggle-label">Speed</span>
            </label>
            {windStatus === 'loading' && <div className="wind-toggle-meta">바람 자료 로딩 중</div>}
            {windStatus === 'error' && <div className="wind-toggle-meta">바람 자료 없음</div>}
            {showLowPower && <div className="wind-toggle-meta">저전력 모드</div>}
          </div>
        )}
      </div>
    )
  }

  function renderTempControl(layer) {
    const disabled = isLayerDisabled(layer.id)
    return (
      <div key={layer.id} className={`wind-toggle-block${disabled ? ' is-disabled' : ''}`}>
        <label className={`layer-toggle-row${disabled ? ' is-disabled' : ''}`}>
          <input
            className="layer-toggle-input"
            type="checkbox"
            checked={!!visibility.temp}
            disabled={disabled}
            onChange={() => onToggle('temp')}
          />
          <span className="layer-toggle-switch" aria-hidden="true" />
          <span className="layer-toggle-swatch" style={{ background: layer.color }} />
          <span className="layer-toggle-label">{layerLabels.temp}</span>
        </label>
        {visibility.temp && tempStatus === 'loading' && <div className="wind-toggle-meta">Temp loading</div>}
        {visibility.temp && (tempStatus === 'error' || tempStatus === 'unavailable') && <div className="wind-toggle-meta">Temp unavailable</div>}
      </div>
    )
  }

  function renderCloudControl(layer) {
    const disabled = isLayerDisabled(layer.id)
    return (
      <div key={layer.id} className={`wind-toggle-block${disabled ? ' is-disabled' : ''}`}>
        <label className={`layer-toggle-row${disabled ? ' is-disabled' : ''}`}>
          <input
            className="layer-toggle-input"
            type="checkbox"
            checked={!!visibility.cloud}
            disabled={disabled}
            onChange={() => onToggle('cloud')}
          />
          <span className="layer-toggle-switch" aria-hidden="true" />
          <span className="layer-toggle-swatch" style={{ background: layer.color }} />
          <span className="layer-toggle-label">{layerLabels.cloud}</span>
        </label>
        {visibility.cloud && cloudStatus === 'loading' && <div className="wind-toggle-meta">Moisture loading</div>}
        {visibility.cloud && (cloudStatus === 'error' || cloudStatus === 'unavailable') && <div className="wind-toggle-meta">Moisture unavailable</div>}
      </div>
    )
  }

  function renderIcingControl(layer) {
    const disabled = isLayerDisabled(layer.id)
    return (
      <div key={layer.id} className={`wind-toggle-block${disabled ? ' is-disabled' : ''}`}>
        <label className={`layer-toggle-row${disabled ? ' is-disabled' : ''}`}>
          <input
            className="layer-toggle-input"
            type="checkbox"
            checked={!!visibility.icing}
            disabled={disabled}
            onChange={() => onToggle('icing')}
          />
          <span className="layer-toggle-switch" aria-hidden="true" />
          <span className="layer-toggle-swatch" style={{ background: layer.color }} />
          <span className="layer-toggle-label">{layerLabels.icing}</span>
        </label>
        {visibility.icing && icingStatus === 'loading' && <div className="wind-toggle-meta">Icing loading</div>}
        {visibility.icing && (icingStatus === 'error' || icingStatus === 'unavailable') && <div className="wind-toggle-meta">Icing unavailable</div>}
      </div>
    )
  }

  const body = (
    <div className="layer-drawer-body">
      {groups.map((group) => (
        <details key={group.title} className="layer-drawer-group" open>
          <summary className="layer-drawer-group-title">
            <span>{group.title}</span>
            <span className="layer-drawer-group-count">{activeCountForGroup(group)}개 활성</span>
          </summary>
          <div className="layer-drawer-group-body">
            {group.ids.map((id) => {
              const layer = layerById.get(id)
              if (!layer) return null
              if (layer.id === 'wind') return renderWindControl(layer)
              if (layer.id === 'temp') return renderTempControl(layer)
              if (layer.id === 'cloud') return renderCloudControl(layer)
              if (layer.id === 'icing') return renderIcingControl(layer)
              const disabled = isLayerDisabled(layer.id)
              const badge = getLayerBadge(layer.id)
              return (
                <label key={layer.id} className={`layer-toggle-row${disabled ? ' is-disabled' : ''}`}>
                  <input
                    className="layer-toggle-input"
                    type="checkbox"
                    checked={!!visibility[layer.id]}
                    disabled={disabled}
                    onChange={() => onToggle(layer.id)}
                  />
                  <span className="layer-toggle-switch" aria-hidden="true" />
                  <span className="layer-toggle-swatch" style={{ background: layer.color }} />
                  <span className="layer-toggle-label">{layerLabels[layer.id] || layer.label}</span>
                  {badge != null && <span className="layer-toggle-badge">{badge}</span>}
                </label>
              )
            })}
            {group.id === 'weather' && visibility.lightning && !isLayerDisabled('lightning') && (
              <label className="layer-toggle-row layer-toggle-row--sub">
                <input
                  className="layer-toggle-input"
                  type="checkbox"
                  checked={blinkLightning}
                  onChange={() => onBlinkLightningChange((prev) => !prev)}
                />
                <span className="layer-toggle-switch" aria-hidden="true" />
                <span className="layer-toggle-label">낙뢰 깜빡임</span>
              </label>
            )}
          </div>
        </details>
      ))}
    </div>
  )

  return (
    <div className="dev-layer-panel layer-drawer" aria-label="기상 레이어 토글">
      <div className="layer-drawer-header">
        <div>
          <div className="layer-drawer-eyebrow">기상정보</div>
          <div className="layer-drawer-title">기상 레이어</div>
        </div>
        <span className="layer-drawer-status">{activeCount}개 켜짐</span>
      </div>
      {body}
    </div>
  )
}

export default WeatherOverlayPanel
