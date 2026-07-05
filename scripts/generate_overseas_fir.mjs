// 해외 FIR 경계 생성 — VATSIM VAT-Spy Boundaries.geojson에서 아시아 대상 FIR만 필터.
// 출처: https://github.com/vatsimnetwork/vatspy-data-project (Boundaries.geojson)
// 라이선스: CC-BY-SA-4.0 — 상업 사용 가능, 단 출처 표기 필수(지도 attribution). 파생물 동일 라이선스.
// 출력: frontend/public/data/fir-overseas.geojson  (인천 FIR처럼 경계선+라벨로 표시)
// 재생성: node scripts/generate_overseas_fir.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SRC = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/Boundaries.geojson'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/public/data/fir-overseas.geojson')

// 대상 FIR(국내 RKRR 제외 — fir.geojson이 이미 인천 FIR을 그림). id → 표시명.
// ⚠️ 프놈펜 FIR 코드는 VDPF(공항코드 VDPP 아님). 일본은 도쿄 FIR 없음 — 전체가 후쿠오카(RJJJ) 하나.
// ZKKP=평양(북한), UHHH=하바롭스크(러시아 극동, 블라디보스토크 지역 포함) — 한반도 북측 인접 FIR.
const FIR_NAME = {
  RJJJ: 'FUKUOKA', RCAA: 'TAIPEI', VHHK: 'HONG KONG', ZMUB: 'ULAANBAATAR',
  ZBPE: 'BEIJING', ZSHA: 'SHANGHAI', ZGZU: 'GUANGZHOU', ZYSH: 'SHENYANG',
  ZHWH: 'WUHAN', ZJSA: 'SANYA', ZLHW: 'LANZHOU', VVHN: 'HANOI',
  VVHM: 'HO CHI MINH', VDPF: 'PHNOM PENH', VTBB: 'BANGKOK', WMFC: 'KUALA LUMPUR',
  WSJC: 'SINGAPORE', WIIF: 'JAKARTA', WAAF: 'UJUNG PANDANG', RPHI: 'MANILA',
  ZKKP: 'PYONGYANG', UHHH: 'KHABAROVSK',
}

const res = await fetch(SRC)
if (!res.ok) throw new Error(`VAT-Spy fetch failed: ${res.status}`)
const src = await res.json()

// FIR별 대표 폴리곤(정확 매칭)만 경계선으로 그린다 — 하위 섹터 조각은 넣지 않음(본토 내부 선 방지).
// ⚠️ 일본 후쿠오카 FIR(RJJJ)은 VAT-Spy 폴리곤이 태평양까지 뻗어 중심 라벨이 먼바다로 감 → 라벨은 여기서
//    안 붙이고 fir.geojson이 본토 위에 "RJJJ FUKUOKA FIR"로 표시(중복 방지).
const NO_LABEL = new Set(['RJJJ'])

const targets = new Set(Object.keys(FIR_NAME))
const features = src.features
  .filter((f) => targets.has(f.properties?.id))
  .map((f) => {
    const id = f.properties.id
    const name = FIR_NAME[id]
    return {
      type: 'Feature',
      properties: {
        id,
        role: 'overseas-fir',
        label: NO_LABEL.has(id) ? '' : `${id}\n${name} FIR`,
        fir_lbl_1: `${name} FIR`,
        label_lon: Number(f.properties.label_lon),
        label_lat: Number(f.properties.label_lat),
      },
      geometry: f.geometry,
    }
  })

const found = new Set(features.map((f) => f.properties.id))
const missing = [...targets].filter((id) => !found.has(id))
if (missing.length) console.warn('⚠️ VAT-Spy에 없는 FIR:', missing.join(','))

const out = {
  type: 'FeatureCollection',
  // 출처 표기(파일 자체에도 남김 — CC-BY-SA-4.0).
  _attribution: 'FIR boundaries © VATSIM VAT-Spy (CC-BY-SA-4.0)',
  _source: SRC,
  features,
}
fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`, 'utf8')
console.log(`wrote ${features.length} FIR → ${path.relative(process.cwd(), OUT)}`)
