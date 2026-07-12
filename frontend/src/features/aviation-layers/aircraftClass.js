// Map ADS-B aircraft to a display class for icon selection.
// Primary: ICAO type designator (adsb.lol `t`). Fallback: ADS-B emitter category.
// Classification scheme adapted from the dump1090-fa / tar1090 taxonomy (facts, not assets).

const TYPE_CLASS = {
  // Narrowbody jets
  B731: 'jet', B732: 'jet', B733: 'jet', B734: 'jet', B735: 'jet', B736: 'jet',
  B737: 'jet', B738: 'jet', B739: 'jet', B37M: 'jet', B38M: 'jet', B39M: 'jet',
  A318: 'jet', A319: 'jet', A320: 'jet', A321: 'jet', A19N: 'jet', A20N: 'jet', A21N: 'jet',
  B752: 'jet', B753: 'jet', BCS1: 'jet', BCS3: 'jet',
  // Regional jets
  E135: 'regional', E145: 'regional', E170: 'regional', E75L: 'regional', E75S: 'regional',
  E190: 'regional', E195: 'regional', E290: 'regional', E295: 'regional',
  CRJ1: 'regional', CRJ2: 'regional', CRJ7: 'regional', CRJ9: 'regional', CRJX: 'regional',
  // Widebody / heavy
  A306: 'heavy', A30B: 'heavy', A310: 'heavy', A332: 'heavy', A333: 'heavy', A338: 'heavy',
  A339: 'heavy', A342: 'heavy', A343: 'heavy', A345: 'heavy', A346: 'heavy',
  A359: 'heavy', A35K: 'heavy', A388: 'heavy',
  B762: 'heavy', B763: 'heavy', B764: 'heavy', B772: 'heavy', B773: 'heavy', B77L: 'heavy',
  B77W: 'heavy', B788: 'heavy', B789: 'heavy', B78X: 'heavy',
  B741: 'heavy', B742: 'heavy', B743: 'heavy', B744: 'heavy', B748: 'heavy', BLCF: 'heavy',
  MD11: 'heavy', A124: 'heavy', A225: 'heavy',
  // Turboprops
  DH8A: 'turboprop', DH8B: 'turboprop', DH8C: 'turboprop', DH8D: 'turboprop',
  AT43: 'turboprop', AT45: 'turboprop', AT72: 'turboprop', AT73: 'turboprop', AT75: 'turboprop', AT76: 'turboprop',
  DHC6: 'turboprop', SF34: 'turboprop', SB20: 'turboprop', B190: 'turboprop', C208: 'turboprop', PC12: 'turboprop',
  // Piston / light
  C152: 'piston', C172: 'piston', C182: 'piston', C72R: 'piston', P28A: 'piston', PA28: 'piston',
  SR20: 'piston', SR22: 'piston', DA40: 'piston', DA42: 'piston', BE36: 'piston',
  // Helicopters
  H60: 'helicopter', EC30: 'helicopter', EC35: 'helicopter', EC45: 'helicopter', AS50: 'helicopter',
  B06: 'helicopter', B407: 'helicopter', B412: 'helicopter', B429: 'helicopter',
  H500: 'helicopter', R44: 'helicopter', R66: 'helicopter', S76: 'helicopter', A139: 'helicopter', AS65: 'helicopter',
}

// ADS-B emitter category fallback (A0..A7 / B*).
const CATEGORY_CLASS = {
  A1: 'piston', A2: 'jet', A3: 'jet', A4: 'heavy', A5: 'heavy', A6: 'jet', A7: 'helicopter',
  B1: 'piston', B2: 'unknown', B4: 'piston',
}

export const AIRCRAFT_CLASSES = ['heavy', 'jet', 'regional', 'turboprop', 'piston', 'helicopter', 'unknown']

export function aircraftClass(typeCode, category) {
  if (typeCode) {
    const key = String(typeCode).toUpperCase()
    if (TYPE_CLASS[key]) return TYPE_CLASS[key]
  }
  if (category && CATEGORY_CLASS[category]) return CATEGORY_CLASS[category]
  return 'unknown'
}

// Real wingspan (m) per ICAO type — drives icon size so footprints match reality.
const WINGSPAN_M = {
  // Narrowbody
  A318: 34.4, A319: 35.8, A320: 35.8, A321: 35.8, A19N: 35.8, A20N: 35.8, A21N: 35.8,
  B731: 28.9, B732: 28.9, B733: 28.9, B734: 28.9, B735: 28.9, B736: 35.8,
  B737: 35.8, B738: 34.3, B739: 34.3, B37M: 35.9, B38M: 35.9, B39M: 35.9,
  B752: 38.0, B753: 38.0, BCS1: 35.1, BCS3: 35.1,
  // Regional
  E135: 20.0, E145: 20.0, E170: 26.0, E75L: 26.0, E75S: 26.0, E190: 28.7, E195: 28.7,
  E290: 33.7, E295: 35.1, CRJ1: 21.2, CRJ2: 21.2, CRJ7: 23.2, CRJ9: 24.9, CRJX: 26.2,
  // Widebody / heavy
  A306: 44.8, A30B: 44.8, A310: 43.9, A332: 60.3, A333: 60.3, A338: 64.0, A339: 64.0,
  A342: 60.3, A343: 60.3, A345: 63.5, A346: 63.5, A359: 64.75, A35K: 64.75, A388: 79.75,
  B762: 47.6, B763: 47.6, B764: 51.9, B772: 60.9, B773: 60.9, B77L: 64.8, B77W: 64.8,
  B788: 60.1, B789: 60.1, B78X: 60.1, B741: 59.6, B742: 59.6, B743: 59.6, B744: 64.4,
  B748: 68.4, BLCF: 64.4, MD11: 51.7, A124: 73.3, A225: 88.4,
  // Turboprop
  DH8A: 25.9, DH8B: 25.9, DH8C: 25.9, DH8D: 28.4, AT43: 24.6, AT45: 24.6,
  AT72: 27.05, AT73: 27.05, AT75: 27.05, AT76: 27.05, DHC6: 19.8, SF34: 21.4,
  SB20: 25.0, B190: 16.6, C208: 15.9, PC12: 16.3,
  // Light / piston
  C152: 10.0, C172: 11.0, C182: 11.0, C72R: 11.0, P28A: 9.1, PA28: 9.1,
  SR20: 11.7, SR22: 11.7, DA40: 11.9, DA42: 13.4, BE36: 10.2,
  // Helicopters (rotor diameter)
  H60: 16.4, EC30: 10.7, EC35: 10.2, EC45: 11.0, AS50: 10.7, B06: 11.3, B407: 10.7,
  B412: 14.0, B429: 11.0, H500: 8.1, R44: 10.0, R66: 10.0, S76: 13.4, A139: 13.8, AS65: 11.9,
}

// Fallback wingspan by class when the exact type is unknown.
const CLASS_WINGSPAN_M = {
  heavy: 60, jet: 35, regional: 26, turboprop: 27, piston: 11, helicopter: 12, unknown: 35,
}

// Icon size multiplier. Real wingspan ratios (narrowbody:widebody ~1:1.8) are too
// jarring on a map, so — like Flightradar24 — we keep the size ordering but compress
// it into a tight, readable band: narrowbody ~1.0, widebody ~1.25, A380 ~1.3, light ~0.8.
export function aircraftSize(typeCode, cls) {
  let span = typeCode ? WINGSPAN_M[String(typeCode).toUpperCase()] : undefined
  if (!span) span = CLASS_WINGSPAN_M[cls] ?? 35
  return Math.min(1.3, Math.max(0.8, 0.62 + span / 95))
}
