# Airport Station Plot Marker Review

- Status: manual focused capture complete
- Console missing-image warnings: none expected; see `console-missing-image-check.json`
- Mocking note: `/api/metar` was intercepted only to force `RKSS` calm wind for the required no-barb evidence. All other airport states used the current local METAR payload.

## Captures

- `map-overview-standard.png`: overview showing no-weather VFR, ceiling, present weather, and multiple wind directions
- `rksi-no-weather-vfr.png`: RKSI VFR clear marker
- `rkpc-ceiling-and-present-weather.png`: RKPC ceiling + weather marker
- `rkny-present-weather-second-wind-direction.png`: RKNY present weather + alternate wind direction
- `rkss-calm-wind-no-barb.png`: RKSS calm wind with no wind barb
- `selected-airport-highlight.png`: selected airport outer highlight
- `map-overview-dark.png`: post-basemap-switch overview

