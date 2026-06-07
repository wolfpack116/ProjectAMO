# Review Issues

- No blocking layout issue found in the captured no-warning `RKSI` state.
- Verified visually: `현재날씨` is the active default tab, section order is warning -> METAR -> TAF, and the compact METAR cards keep rainfall/gust/RVR secondary text inside parent cards only.
- Verified visually: TAF uses timeline rows only in the compact tab and remained readable at `1365x768`, `1920x1080`, and `390x844`.
- Limitation: active-warning visual parity could not be validated from the local snapshot because no airport had an active warning at capture time.
