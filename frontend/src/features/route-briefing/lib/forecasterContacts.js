// #6 예보관 있는 7개 공항 + 기상대 전화번호. 전화번호는 자리표시자(032-XXX-XXXX) — 실번호 확인 후 교체.
export const FORECASTER_CONTACTS = [
  { icao: 'RKSI', ko: '인천', phone: '032-XXX-XXXX' },
  { icao: 'RKSS', ko: '김포', phone: '02-XXXX-XXXX' },
  { icao: 'RKPC', ko: '제주', phone: '064-XXX-XXXX' },
  { icao: 'RKJB', ko: '무안', phone: '061-XXX-XXXX' },
  { icao: 'RKNY', ko: '양양', phone: '033-XXX-XXXX' },
  { icao: 'RKJY', ko: '여수', phone: '061-XXX-XXXX' },
  { icao: 'RKPU', ko: '울산', phone: '052-XXX-XXXX' },
]

export const FORECASTER_AIRPORTS = FORECASTER_CONTACTS.map((c) => c.icao)
