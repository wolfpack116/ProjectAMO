import { AVIATION_WFS_LAYERS } from './aviationWfsLayers.js'
import { AVIATION_TILE_META } from './lib/aviationLayerTiles.js'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'

const GROUPS = [
  { title: '공역', ids: ['fir', 'sector', 'ctr', 'tma', 'restricted', 'prohibited', 'danger'] },
  { title: '항행시설', ids: ['waypoint', 'navaid', 'airport'] },
  { title: '항공로', ids: ['ats-route', 'rnav-route'] },
]
const LAYER_LABELS = {
  fir: '비행정보구역',
  sector: '관제섹터',
  ctr: '관제권',
  tma: '접근관제구역',
  restricted: '제한구역',
  prohibited: '금지구역',
  danger: '위험구역',
  waypoint: '웨이포인트',
  navaid: '항행안전시설',
  airport: '공항',
  'ats-route': 'ATS 항공로',
  'rnav-route': 'RNAV 항공로',
}

function AviationTileVisual({ id }) {
  const meta = AVIATION_TILE_META[id]
  if (!meta) return null
  if (meta.kind === 'symbol') {
    return <img className="layer-tile-symbol" src={meta.symbolUrl} alt="" aria-hidden="true" />
  }
  if (meta.kind === 'line') {
    return (
      <span
        className="layer-tile-line"
        style={{ borderTopColor: meta.color, borderTopStyle: meta.dashed ? 'dashed' : 'solid' }}
        aria-hidden="true"
      />
    )
  }
  return (
    <span
      className="layer-tile-square"
      style={{ borderColor: meta.color, background: `${meta.color}1f`, borderStyle: meta.dashed ? 'dashed' : 'solid' }}
      aria-hidden="true"
    />
  )
}

function AviationLayerPanel({ visibility, onToggle, onClose, onClearAll }) {
  const isMobile = useIsMobile()
  const layerById = new Map(AVIATION_WFS_LAYERS.map((layer) => [layer.id, layer]))
  const activeCount = AVIATION_WFS_LAYERS.filter((layer) => visibility[layer.id]).length

  if (isMobile) {
    return (
      <MobileSheet
        open
        eyebrow="항공정보"
        title="항공 레이어"
        onClose={onClose}
        headerExtra={(
          <>
            <button
              type="button"
              className="layer-sheet-clear"
              onClick={onClearAll}
              disabled={activeCount === 0}
            >
              전체 끄기
            </button>
            <span className="layer-drawer-status">{activeCount}개 켜짐</span>
          </>
        )}
      >
        <div className="layer-tile-groups">
          {GROUPS.map((group) => (
            <section key={group.title} className="layer-tile-group">
              <div className="layer-tile-group-title">{group.title}</div>
              <div className="layer-tile-grid">
                {group.ids.map((id) => {
                  if (!layerById.has(id)) return null
                  const active = !!visibility[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`layer-tile${active ? ' is-active' : ''}`}
                      onClick={() => onToggle(id)}
                      aria-pressed={active}
                    >
                      <span className="layer-tile-visual"><AviationTileVisual id={id} /></span>
                      <span className="layer-tile-label">{LAYER_LABELS[id]}</span>
                      {active && <span className="layer-tile-check" aria-hidden="true">✓</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </MobileSheet>
    )
  }

  const activeCountForGroup = (group) => group.ids.filter((id) => visibility[id]).length

  return (
    <div className="dev-layer-panel layer-drawer" aria-label="항공 레이어 토글">
      <div className="layer-drawer-header">
        <div>
          <div className="layer-drawer-eyebrow">항공정보</div>
          <div className="layer-drawer-title">항공 레이어</div>
        </div>
        <span className="layer-drawer-status">{activeCount}개 켜짐</span>
      </div>
      <div className="layer-drawer-body">
        {GROUPS.map((group) => (
          <details key={group.title} className="layer-drawer-group" open>
            <summary className="layer-drawer-group-title">
              <span>{group.title}</span>
              <span className="layer-drawer-group-count">{activeCountForGroup(group)}개 활성</span>
            </summary>
            <div className="layer-drawer-group-body">
              {group.ids.map((id) => {
                const layer = layerById.get(id)
                if (!layer) return null
                return (
                  <label key={layer.id} className="layer-toggle-row">
                    <input
                      className="layer-toggle-input"
                      type="checkbox"
                      checked={visibility[layer.id]}
                      onChange={() => onToggle(layer.id)}
                    />
                    <span className="layer-toggle-switch" aria-hidden="true" />
                    <span className="layer-toggle-swatch" style={{ background: layer.color }} />
                    <span className="layer-toggle-label">{LAYER_LABELS[layer.id] || layer.nameEn}</span>
                  </label>
                )
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

export default AviationLayerPanel
