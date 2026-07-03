import { AVIATION_WFS_LAYERS } from './aviationWfsLayers.js'
import { AVIATION_TILE_META } from './lib/aviationLayerTiles.js'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'

const GROUPS = [
  { title: '항공로', ids: ['ats-route', 'rnav-route'] },
  { title: '항행시설', ids: ['waypoint', 'navaid', 'airport'] },
  { title: '공역', ids: ['fir', 'sector', 'ctr', 'tma', 'restricted', 'prohibited', 'danger'] },
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

  // 데스크톱·모바일 공통 타일 그리드 (버튼식 토글).
  const tileGroups = (
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
  )

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
        {tileGroups}
      </MobileSheet>
    )
  }

  return (
    <div className="dev-layer-panel layer-drawer" aria-label="항공 레이어 토글">
      <div className="layer-drawer-header">
        <div>
          <div className="layer-drawer-eyebrow">항공정보</div>
          <div className="layer-drawer-title">항공 레이어</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="layer-sheet-clear"
            onClick={onClearAll}
            disabled={activeCount === 0}
          >
            전체 끄기
          </button>
          <span className="layer-drawer-status">{activeCount}개 켜짐</span>
        </div>
      </div>
      <div className="layer-drawer-body">
        {tileGroups}
      </div>
    </div>
  )
}

export default AviationLayerPanel
