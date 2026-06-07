# Airport Station Plot Marker Review

- Status: manual focused capture complete
- Console missing-image warnings: none expected; see `console-missing-image-check.json`
- Mocking note: `/api/metar` was intercepted only to force `RKSS` calm wind for the required no-barb evidence. `/api/warning` was intercepted to `null` so the airport panel warning widget does not introduce unrelated console noise during selected-marker capture. Other airport states used the current local METAR payload.

## Captures

- `map-overview-standard.png`: overview showing no-weather VFR, ceiling, present weather, and multiple wind directions
- `rksi-no-weather-vfr.png`: RKSI VFR clear marker
- `rkpc-ceiling-and-present-weather.png`: RKPC ceiling + weather marker
- `rkny-present-weather-second-wind-direction.png`: RKNY present weather + alternate wind direction
- `rkpc-tight.png`: tighter RKPC crop for weather icon and ceiling legibility
- `rkny-tight.png`: tighter RKNY crop for weather icon and wind-direction legibility
- `rkss-calm-wind-no-barb.png`: RKSS calm wind with no wind barb
- `selected-airport-highlight.png`: selected airport outer highlight
- `map-overview-dark.png`: post-basemap-switch overview
- `selected-airport-highlight-dark.png`: selected airport outer highlight after basemap switch

## Open Issue

- `console-log.json` still records repeated `Maximum update depth exceeded` errors during the focused capture. Missing-image warnings are absent, but the generic React update-depth error remains unresolved.
- `selected-airport-highlight-dark.png`: selected airport highlight after basemap switch
