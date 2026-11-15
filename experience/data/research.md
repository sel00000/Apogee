# RETURN — astronomy data and accuracy decisions

Snapshot refreshed 24 September 2026. The astronomical scene is frozen at **12 June 2080, 00:00:00 TDB** (JD 2480927.5). This is a defined dynamical-time snapshot, not midnight UTC. No positions were taken from the earlier SENTRY/ASTRA projects.

## The selected sources

| Need | Selected source | Why it fits |
|---|---|---|
| Planet, moon and asteroid positions | [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Direct Cartesian state vectors at the requested instant, avoiding hand-built Kepler orbits. |
| Reproducible local ephemeris alternative | [NASA/JPL NAIF SPICE](https://naif.jpl.nasa.gov/naif/) | Kernel-based geometry for later time evolution or offline preprocessing. |
| Measured body size and orientation | [NASA NAIF PCK 00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) and [JPL planetary physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) | Published ellipsoid radii, mean radii and IAU rotation models. |
| Asteroid diameter | [JPL Small-Body Database API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html) | Physical properties, uncertainties and source references; absent properties remain absent. |
| Recognizable bright-star sky | [ESA Hipparcos catalogue](https://www.cosmos.esa.int/web/hipparcos/catalogues), distributed by [CDS VizieR I/239](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239?format=html&tex=true) | Includes very bright constellation stars; measured positions, V magnitudes, B−V colours, parallax and proper motion. |
| Future deeper sky | [ESA Gaia DR3](https://www.cosmos.esa.int/web/gaia/dr3) | Much deeper and denser, but its approximate bright limit G≈3 means it should supplement the bright-star catalogue rather than replace it. |
| Observed diffuse Milky Way | [ESA Gaia EDR3 equirectangular sky map](https://www.esa.int/ESA_Multimedia/Images/2020/12/The_colour_of_the_sky_from_Gaia_s_Early_Data_Release_32) | A real, measured brightness and colour map, suitable for a later dithered background. It must be aligned in Galactic coordinates, not arbitrarily rotated. |

NASA's generic open API portal is not itself an ephemeris dataset. Earth-close-approach feeds and orbital elements are also not the right primary representation for this frozen three-dimensional scene. Horizons is the direct source.

## Delivered files

- `bodies.json`: **42 bodies** — Sun, eight planets, Earth's Moon, Phobos, Deimos, four Galilean moons, eight major Saturnian moons, five major Uranian moons, Triton, Pluto, Charon, Ceres, Vesta, Pallas, Hygiea, Psyche, Eros, Gaspra, Ida, Bennu and Ryugu.
- `stars-compact.json`: **41,394 Hipparcos entries with V≤8**, 2.6 MB. Columns are `hip,x,y,z,magnitude,bv,distancePc`.
- `stars.json`: fuller provenance/measurement records, including original coordinates and parallax uncertainties.
- `raw/`: unchanged NASA Horizons replies, SBDB replies, Hipparcos query output and NASA PCK file, retained for auditing.
- `fetch_data.py`: repeatable downloader and catalogue conversion. `add_orientations.py`: optional SPICE preprocessing, already run for this snapshot.

Existing raw downloads are reused. The original downloader produced the historical 2025 dataset. Reproduce the shipped 2080 data with `research/journey-2080/refresh_snapshot.py --input dist/data/bodies.json --output-dir out` and `research/journey-2080/propagate-stars.py --input dist/data/stars.json --patterns dist/data/star-identities.json --output-dir out`. Python with SpiceyPy is required for body orientations. The raw 2080 Horizons replies and ESA astrometry query are retained under `research/journey-2080/`. See [journey research](journey-research.md) for the date search and route comparison. A newer fresh query may legitimately yield refined asteroid or satellite solutions. Each body records the returned ephemeris solution and SHA-256 of its raw reply. The downloader follows [JPL's fair-use rule](https://ssd-api.jpl.nasa.gov/index.php) by making only one API request at a time.

## Coordinate contract

The planet file contains **Sun-centred, geometric ICRF vectors in kilometres**. Horizons settings are `CENTER=500@10`, `REF_SYSTEM=ICRF`, `REF_PLANE=FRAME`, `EPHEM_TYPE=VECTORS`, `VEC_CORR=NONE`, `OUT_UNITS=KM-S`, `TIME_TYPE=TDB`. The functioning endpoint at retrieval was `https://ssd.jpl.nasa.gov/api/horizons.api`.

ICRF +X points towards right ascension 0°, +Y towards 90°, and +Z towards the celestial north pole. This is an equatorial frame. Do not apply an additional ecliptic tilt to only the stars or only the planets. The [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) distinguishes geometric vectors from light-time-corrected observations: these delivered vectors are positions at one simultaneous coordinate time, not the exact delayed image reaching a particular camera.

Keep navigation positions in double-precision kilometres. For rendering, subtract the camera position on the CPU before converting to GPU float coordinates. Apply one common scale and axis mapping to both bodies and stars. This avoids centimetre-to-kilometre jitter caused by placing small moons directly at billion-kilometre GPU coordinates.

`bodyFixedToICRF` contains three rows of three numbers. Multiply a body-fixed column vector by this matrix. Local +Z is the pole, and +X crosses the prime meridian. These were computed with SPICE `pxform(IAU_BODY,J2000,et)` using NASA's PCK. For these sources SPICE's J2000 label represents ICRF; see [NAIF's frame documentation](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/FORTRAN/req/frames.html). The matrix includes tilt and rotation phase, not just an obliquity.

The standard IAU model is not the highest-precision Earth orientation or lunar libration solution. Hyperion, Hygiea, Psyche, Bennu and Ryugu have no usable orientation in this kernel; their values are `null`. Hyperion is chaotically rotating. A texture map's epoch and changing giant-planet weather cannot be inferred from a fixed rotation matrix. Shapes rendered as spheres or ellipsoids must be described as such, not as measured terrain.

## Star treatment

Hipparcos coordinates are ICRS at J1991.25. The downloader propagates the measured proper motion to the requested epoch using a normalized tangent-vector update. It preserves catalogue V magnitude and B−V. This is a first-order propagation: radial velocity/perspective acceleration, unresolved binary orbits and variable-star light curves are not included.

Distances are `1000/parallaxMas` parsecs only when the measured parallax is positive with signal-to-noise at least five. **25,553 stars** meet that criterion. Remaining distances are `null`; their measured direction can still be rendered on the celestial sphere. Do not fabricate distances for them or scatter extra stars randomly and call them catalogue data.

For measured-distance stars, an approximate heliocentric position is `direction × distancePc × 3.0856775814913673e13 − sunBarycentricPositionKm`. The extra Sun barycentric vector is provided in `bodies.json` to reconcile the star catalogue's barycentric origin with the planet scene. Camera parallax can then be computed from its heliocentric position. This is useful within the Solar System; this catalogue and propagation are not a complete precision interstellar-flight model.

The real density, direction and brightness hierarchy should drive the stars. A dust-like pixel halo around a measured star is a visual treatment. Freely invented nebulae or dense nearby star clouds would violate the requested data fidelity. Constellation lines are optional human annotations; recognizable star patterns need no invented connecting lines.

**Credit/licence:** ESA's Hipparcos page states CC BY-NC 3.0 IGO and requires `Credit: ESA`. This is a material constraint for a future commercial game. The separate Gaia EDR3 sky image offers CC BY-SA 3.0 IGO or ESA Standard Licence and credits ESA/Gaia/DPAC, with acknowledgement to A. Moitinho. These are different assets with different terms.

## The starting view near Mars

Computed from the downloaded snapshot:

| Quantity | Value |
|---|---:|
| Mars distance from the Sun | 1.612606499 AU |
| Mars–Earth centre distance | 98,246,441.768 km |
| Sun angular diameter at Mars | 0.330462° |
| Direct solar irradiance relative to 1 AU | 0.3845415 |

Yes, the Sun should be visible from near Mars when in the field of view and not occulted. Sun-facing terrain is lit; the night side remains dark. Use the actual Sun position to compute each body's light direction and inverse-square relative irradiance. This is distinct from the display exposure required to make the scene legible.

A strong star field and a bright sunlit planetary surface together, bloom, stylized colour, dithering, line art, lens distortion and warp streaks are presentation choices. A one-million-kilometre jump is tiny compared with stellar distances: nearby stars do not physically rush past the viewer. Treat the requested colourful trails as an explicit fast-travel effect, while preserving the actual catalogue directions before and after the jump.

## Validation performed

All 42 Horizons responses were parsed at the exact requested epoch. All body positions and radii are finite, IDs are unique, and each moon's parent exists. All 41,394 star direction vectors are unit-length to better than 1e-9. The magnitude range is −1.44 to 8.0; Sirius, Vega and Alpha Centauri were checked by HIP identifier. Thirty-seven body orientation matrices were successfully computed from the downloaded IAU kernel. Raw data, provenance and limitations are retained instead of presenting the rendering as a complete physical simulator.


---

# Observation-based solar-system assets

All assets were retrieved from NASA, the NASA Planetary Data System, USGS, ISAS/JAXA, ESA, or STScI on 2026-09-23. No images were generated. Every surface/cloud mosaic, sky map, and shape comes from spacecraft, telescope, or radar observations. See `manifest.json` for exact URLs, attribution, usage policies, source-product limitations, byte sizes, and checksums. Untouched downloads remain in `originals/`.

## Web-ready files

| Asset | File | Description |
|---|---|---|
| Mars | `web/mars.jpg` | 2048×1024 Viking MDIM2.1 + NASA Ames colorization |
| Earth | `web/earth.jpg` | 2048×1024 MODIS Blue Marble July 2004 composite |
| Jupiter | `web/jupiter.jpg` | 2048×1024 Cassini cloud map from Dec 2000 |
| Moon | `web/moon.jpg` | 2048×1024 NASA SVS LROC color visualization |
| Mercury | `web/mercury.jpg` | 1024×512 MESSENGER multispectral color mosaic |
| Venus | `web/venus.jpg` | 2048×1024 Magellan C3-MDIR grayscale radar backscatter |
| Saturn | `web/saturn.jpg` | 2048×1024 Hubble OPAL August 2025 clouds |
| Uranus | `web/uranus.jpg` | 2048×1024 Hubble OPAL November 2014 clouds |
| Neptune | `web/neptune.jpg` | 2048×1024 Hubble OPAL August 2025 clouds |
| Galactic sky | `web/gaia-sky.jpg` | 4000×2000 ESA Gaia EDR3 equirectangular sky |
| Bennu | `web/bennu.glb` | OSIRIS-REx SPC shape, 196,608 triangles |
| Eros | `web/eros.glb` | NEAR / Gaskell Q=64, 49,152 triangles |
| Ryugu | `web/ryugu.glb` | Hayabusa2 / Watanabe et al., 49,152 triangles |
| Phobos | `web/phobos.glb` | Viking / Phobos 2 / Gaskell, 49,152 triangles |
| Bennu radar | `web/bennu-radar.glb` | Older radar model, 2,692 triangles |
| Lunar elevation | `web/moon-elevation-km.f32` | 720×360 sampled LOLA elevation, kilometers above 1737.4 km radius |

## Rendering conventions

- Texture images are rectangular latitude/longitude maps. Their appearance is processed observation data, not live photography. See each manifest entry before labeling them.
- For retro dots/edges, derive intensity/edge locations from the supplied map rather than adding random terrain marks. A texture's luminance is reflectance/illumination, **not measured altitude**. Do not displace geometry from it and call that real topography.
- Shape GLBs retain source body-fixed axes, typically Z north, and use **meters**. Topology and relative proportions are preserved. Scale uniformly for presentation; normalize by measured bounding box/radius only for visual display and disclose enlarged body sizes if combined with orbits.
- `*-points.json` files are optional flat XYZ arrays, in **kilometers**. They retain every Nth original vertex (sampling interval recorded in each file), so dots lie on measured source geometry. They are not arbitrary surface particles.
- Source body-fixed axes were not transformed into an epoch-correct celestial attitude. Doing that requires an ephemeris/orientation model.
- Lunar elevation is a float32 little-endian grid, row-major, north to south. First sample is longitude −179.875°, latitude +89.875°; subsequent columns/rows advance +0.5° / −0.5°. Every second original LOLA pixel was retained, without interpolation.
- Saturn, Uranus, and Neptune have been reprojected from planetographic to planetocentric latitude using the source ellipsoid radii. Output longitude is −180° to +180° east, left to right; latitude is +90° to −90°, top to bottom. Source interpolation seams and photometric processing remain. The 2K output does not add observed resolution to the smaller original Hubble maps.
- Each Hubble map has a `web/NAME-coverage.png` mask: white is valid RGB coverage, black is absent. All three source color channels must be present in all four bilinear neighbors. Do not fill these gaps with procedural clouds, and do not interpret their boundaries as atmospheric features.
- Gaia sky is **Galactic**, not ecliptic: with image coordinates u rightward and v downward, Galactic longitude `l = 180 − 360u`, latitude `b = 90 − 180v` (degrees). The Galactic-to-ICRS matrix and official ESA reference are in `manifest.json`. Then apply the app's ICRS-to-scene convention. The Galactic center is at the image center and the Magellanic Clouds are lower right. ESA explicitly identifies this rectangular product as equirectangular.

## Scientific caveats that belong in accessible source details

- Mars is an official artistically colorized image mosaic, not a literal natural-color photograph.
- Mercury's channels are 1000/750/430 nm. Describe it as multispectral color.
- Jupiter's imagery represents clouds; it is not a rocky terrain. Its atmosphere changes with time.
- NASA's lunar visualization includes photometric adjustments, monochrome polar albedo fill, and source-side inpainting of small high-latitude gaps. The actual LOLA elevation grid is also supplied if strict measured relief is needed.
- Blue Marble is a monthly cloud-screened composite. The source product uses a uniform deep-ocean color.
- The small Bennu radar model predates the spacecraft model and must be labeled separately.
- Venus is radar backscatter through its cloud cover, not visible-light surface color or height. Missing source strips remain dark.
- Hubble RGB maps are filter composites with contrast enhancement, not exact naked-eye colors. Unobserved polar regions and Saturn's ring-obscured region stay blank. Clouds change with time.
- Gaia integrates brightness and color from observed sources; it is not a single photograph. Credit **ESA/Gaia/DPAC; Acknowledgement: A. Moitinho.** The JPEG and further adaptations of that image are under **CC BY-SA 3.0 IGO**.
- Saturn ring radii in the manifest support a schematic annulus display. No ring texture was invented.

## Verification

All texture dimensions were verified. Shapes were parsed, checked for finite coordinates and valid face indices, and converted to glTF 2 binary with normals computed from source triangles. Each GLB retains original triangulation and uses float32 coordinates after exact unit scaling. The PDS catalog's Eros OBJ conversion omitted one triangle; `eros.glb` was therefore built directly from the complete original PDS vertex-facet table. The unused downloaded OBJ is retained for provenance.

`convert_shapes.py` reproduces the geometry format conversion; `write_manifest.py` reproduces the catalog and numerical lunar grid extraction. No network code is executed by these scripts.

`convert_outer_planets.py` performs the Hubble reprojection and Gaia format conversion. Run `append_outer_manifest.py` after `write_manifest.py` to retain the supplemental provenance. Use the bundled Python runtime with NumPy and Pillow for the reprojection.

## Hubble OPAL acknowledgment

This work used data acquired from the NASA/ESA HST Space Telescope, associated with OPAL program (PI: Simon, GO13937), and archived by the Space Telescope Science Institute, which is operated by the Association of Universities for Research in Astronomy, Inc., under NASA contract NAS 5-26555. All maps are available at http://dx.doi.org/10.17909/T9G593.


## Prototype rendering notes

Solar-system centres, radii, orientations and star directions are sourced data. Surface maps represent their observation dates, not 2025 weather. Jupiter cloud longitude registration remains provisional. Bennu and Ryugu use reference attitudes, with no claimed epoch orientation. Ellipsoid geometry preserves planetocentric latitude. Grain, glow, contour treatment, screen-space focal softening and travel streaks are stylistic. Planet markers have a minimum visible pixel size. No eclipse shadows or atmospheric scattering are simulated.

## Moon surface extension — 25 September 2026

The current game supplements the original export above with mission mosaics for previously unmapped moons and eight reference-guided artistic reconstructions. The latter approximate both mapped and unseen geology; they do not claim measured feature positions or elevations. Titan uses a representative haze concept. The [moon surface manifest](moon-surfaces.json) records official imagery, exact generation prompts and credits. All surfaces use the same contour/stipple treatment without displacing the measured geometry.
