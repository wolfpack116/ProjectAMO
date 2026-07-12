// NOTAM 장애물 종류별 심볼. E)본문의 OBST(...) 키워드로 분류 → 종류별 SVG 아이콘.
// aircraftIconImages.js 패턴(SVG data URL → Image → map.addImage) 재사용. 색은 시간상태 3색.

const TIME_COLORS = { active: '#c0291f', soon: '#92400e', upcoming: '#475569' } // --level-red/amber/gray

// 종류 키 → 종류 글리프(색 토큰 %C%, viewBox 0 0 24 24). 배경 원반 없음 — 그냥 심볼만.
// buildIconData가 흰색 테두리(halo)만 얇게 둘러 지도 위 대비 확보.
const G = 'stroke="%C%" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const ICON_GLYPH = {
  crane: `<g ${G}><path d="M8 20V6"/><path d="M4 6h12"/><path d="M15 6v3.5"/></g>`, // 마스트+지브+후크
  tower: `<g ${G}><path d="M12 4v4"/><path d="M7 20 12 8 17 20"/><path d="M9.3 15h5.4"/></g>`, // 안테나+삼각격자
  mast: `<g ${G}><path d="M12 20V5"/><path d="M12 7 7 20M12 7l5 13"/></g>`, // 주탑+가이선
  turbine: `<g ${G}><path d="M12 20v-8"/><path d="M12 11V5M12 11l5 3M12 11 7 14"/></g><circle cx="12" cy="11" r="1.5" fill="%C%"/>`, // 기둥+3날개
  chimney: `<path d="M9 20 10 6h4l1 14z" fill="%C%"/>`, // 연돌
  building: `<g ${G}><path d="M6 20V9h12v11z"/><path d="M6 9 12 5l6 4"/></g>`, // 건물
  other: `<path d="M12 5 19 19H5z" fill="%C%"/>`, // 일반 장애물 △
}
export const OBSTACLE_TYPES = Object.keys(ICON_GLYPH)

// E)본문 텍스트 → 종류 키. 여러 키워드 포함 시 우선순위(터빈>크레인>타워>마스트>굴뚝>건물).
export function obstacleType(text) {
  const t = String(text || '').toUpperCase()
  if (/WIND\s*TURBINE|WINDMILL|\bWTG\b|\bWEC\b/.test(t)) return 'turbine'
  if (/CRANE/.test(t)) return 'crane'
  if (/TOWER|ANTENNA|MAST\s*ANTENNA|AERIAL/.test(t)) return 'tower'
  if (/\bMAST\b|PYLON/.test(t)) return 'mast'
  if (/CHIMNEY|STACK|FLARE/.test(t)) return 'chimney'
  if (/BUILDING|\bBLDG\b|STRUCTURE/.test(t)) return 'building'
  return 'other'
}

// E)본문 HGT에서 실제 장애물 높이 → "74FT AMSL" 형태. (altitude 필드는 Q밴드라 /000/999/=무제한 플레이스홀더 → 못 씀)
// 형식 예: "HGT:22.60M(74.14FT) AMSL", "HGT: 28M AGL", "HGT : 406FT AMSL", "HGT : 26M(85FT) AGL"
export function parseObstacleHeight(text) {
  const seg = String(text || '').match(/HGT\s*:?\s*([^\n]{0,50})/i)
  if (!seg) return ''
  const s = seg[1]
  const ref = (s.match(/\b(AMSL|AGL)\b/i) || [])[1]
  let ft = null
  const ftM = s.match(/([\d.]+)\s*FT/i)          // 괄호 안 등 FT값 우선
  if (ftM) ft = Math.round(parseFloat(ftM[1]))
  else {
    const mM = s.match(/([\d.]+)\s*M\b/i)         // FT 없으면 M→FT 환산
    if (mM) ft = Math.round(parseFloat(mM[1]) * 3.28084)
  }
  if (ft == null || !Number.isFinite(ft)) return ''
  return `${ft.toLocaleString('en-US')}FT${ref ? ' ' + ref.toUpperCase() : ''}`
}

const ICON_SIZE = 30
function loadGlyphImage(glyph, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24">${glyph.replace(/%C%/g, color)}</svg>`
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

// 배경 원반 없이 심볼만. 흰색 halo(테두리)를 심볼 둘레에 스탬프해 지도 위 대비 확보(aircraftIconImages 방식).
// SVG data-URL Image를 addImage에 바로 넘기면 크기가 0으로 잡히는 이슈도 캔버스 경유로 회피.
async function buildIconData(glyph, color, pixelRatio) {
  const [colorImg, whiteImg] = await Promise.all([loadGlyphImage(glyph, color), loadGlyphImage(glyph, '#ffffff')])
  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE * pixelRatio
  canvas.height = ICON_SIZE * pixelRatio
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.scale(pixelRatio, pixelRatio)
  const halo = 1.4
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) ctx.drawImage(whiteImg, Math.cos(a) * halo, Math.sin(a) * halo, ICON_SIZE, ICON_SIZE)
  ctx.drawImage(colorImg, 0, 0, ICON_SIZE, ICON_SIZE)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

// notam-obst-<type>-<timeState> 이미지들을 지도에 등록(스타일 로드마다 1회). icon-image가 이 id를 참조.
export async function registerNotamObstacleImages(map) {
  if (typeof document === 'undefined') return
  const pixelRatio = Math.max(1, Math.round((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1))
  const jobs = []
  for (const [type, glyph] of Object.entries(ICON_GLYPH)) {
    for (const [state, color] of Object.entries(TIME_COLORS)) {
      const id = `notam-obst-${type}-${state}`
      if (map.hasImage(id)) continue
      jobs.push(buildIconData(glyph, color, pixelRatio).then((data) => {
        if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio })
      }).catch(() => {}))
    }
  }
  await Promise.all(jobs)
}

export default { OBSTACLE_TYPES, obstacleType, parseObstacleHeight, registerNotamObstacleImages }
