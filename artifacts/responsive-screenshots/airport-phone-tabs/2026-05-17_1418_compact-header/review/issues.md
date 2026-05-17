# Airport Phone Compact Header Issues

| Severity | Viewport | State | Screenshot | Problem | Proposal direction | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P2 | 390x844 | METAR | `../phone-metar.png` | Previous capture showed the photo header consuming too much first-read space. | Apply phone-only `max-height: 112px; overflow: hidden;` in the existing phone media block. | fixed: core METAR visible sooner, overflow 0 |
| P3 | 390x844 | all airport tabs | `../phone-taf-table.png`, `../phone-taf-grid.png`, `../phone-amos.png`, `../phone-airport-info.png` | Confirm compact header does not clip identity or reintroduce horizontal overflow. | Keep top tabs and compact header only if readable. | verified: identity readable, overflow 0 |
| P3 | 820x1180 | tablet METAR sanity | `../tablet-portrait-metar.png` | Confirm phone header cap does not affect tablet drawer. | Preserve tablet drawer/header behavior. | verified: tablet rail/header unchanged, overflow 0 |
