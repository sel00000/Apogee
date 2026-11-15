# Odyssey route search: frozen geometry

Recommended snapshot: **12 June 2080, 00:00 TDB (JD 2480927.5)**.
Route: **Saturn → Jupiter → 951 Gaspra → Mars → Earth**.

The search evaluated every calendar day from 1900-01-01 through 2100-12-31 using JPL's long-interval approximate Keplerian elements, then retrieved exact Horizons geometric vectors for the short list and seven existing modeled main-belt bodies. The score favored shorter inward legs, moderate changes in direction, and an optional Venus continuation. These are straight routes in Odyssey's frozen snapshot, not real orbital-transfer trajectories.

| Date | Belt landmark | Leg distances, AU | Course changes | Total AU | Venus beyond Earth |
|---|---|---|---|---:|---|
| 2080-06-12 | Gaspra | 4.876, 3.503, 0.889, 0.458 | 24.7°, 38.1°, 30.0° | 9.727 | 2.82° from onward course; 1.72 AU beyond |
| 1982-05-05 | Ceres | 4.719, 2.875, 1.356, 0.717 | 25.0°, 51.8°, 74.4° | 9.666 | 0.31° from onward course; 0.94 AU beyond |
| 2020-05-08 | Ceres | 4.991, 2.965, 1.933, 1.178 | 48.4°, 82.1°, 15.9° | 11.067 | 65.1° from onward course; optional wrong turn |

The 2080 route through Gaspra adds only 0.154 AU versus Jupiter → Mars directly. Vesta is another real alternative on this date: total 9.649 AU, legs 4.876 / 2.941 / 1.373 / 0.458 AU and turns 10.2° / 23.2° / 74.3°. Gaspra is preferred for the more even steering rhythm. The 1980-01-28 planetary-only route initially scored best, but was rejected because its existing asteroid choices required turns exceeding 100°.

Venus is not literally struck by maintaining the Mars→Earth line in 2080: the nearest miss is 0.0846 AU (about 12.65 million km), so this supports a nearby detectable contact or modest wrong turn rather than an automatic crash. The straight Earth→Venus leg passes 0.112 AU from the Sun. All intended route legs remain at least 1.015 AU from the Sun.

The new asset refreshes all 42 geometric state vectors, Sun's barycentric offset/velocity, and 37 supported IAU orientation matrices. Five unsupported orientations remain honestly null: Hyperion, Hygiea, Psyche, Bennu and Ryugu. In particular, Hyperion's chaotic rotation is not manufactured. Radii and shape axes remain measured values from the existing source asset.

The new Saturn opening geometry puts Rhea about 651,352 km from the existing spawn, 53.3° off the initial Saturn-centred view. Titan is 1,293,182 km away and 63.6° off-axis. Hyperion is 1,462,877 km away and 96.2° off-axis. Jupiter is 729 million km away, 155.2° off-axis: a nudge to turn around is necessary after the opening moon encounter.

Reproducibility files: `search.py`, `horizons.py`, `analyze.py`, `refresh_snapshot.py`, `build_candidates.py`. Raw Horizons responses retain exact URLs and SHA-256 hashes. `snapshot-2080/pck00011.tpc` has SHA-256 `3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1`.

Sources:
- [JPL approximate elements and formulae](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- [NAIF generic PCK orientation kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc)
