# Route Briefing Phone Map Mode Review

- Phone 390x844 route form: pass. Route form remains unchanged and `지도 보기` is reachable without overlapping the Mapbox zoom control.
- Phone 390x844 route map mode: pass. Route panel is hidden, the existing live Mapbox viewport remains visible, and `입력 보기` is reachable near the top-left without covering the basemap switcher.
- Tablet 820x1180 sanity: pass. Route panel behavior remains unchanged and the phone-only map-mode control is hidden.
- Metrics: `bodyScrollWidth` and `documentScrollWidth` remain equal to viewport width in all captured states.
- Follow-up: verify with read-only UI QA/spec reviewers before final commit.
