# Visible planetshine approximation

Use the following **geometric albedos**, selected consistently from NASA/NSSDC fact sheets. The [fact-sheet definitions](https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html) explicitly specify **V band, 0.549 μm**, and distinguish geometric albedo from Bond albedo. These are representative brightness coefficients, not an albedo/weather snapshot for 1 January 2025.

| Parent | V-band geometric albedo | Primary source |
|---|---:|---|
| Earth | 0.434 | [NASA Earth fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) |
| Mars | 0.170 | [NASA Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Jupiter | 0.538 | [NASA Jupiter fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html) |
| Saturn | 0.499 | [NASA Saturn fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html) |
| Uranus | 0.488 | [NASA Uranus fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html) |
| Neptune | 0.442 | [NASA Neptune fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html) |
| Pluto | 0.52 | [NASA Pluto fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html) |

Machine-readable values, exact URLs, update dates and raw-response checksums are in `parent-geometric-albedos.json`; unchanged pages and `fetch_albedos.py` (reproducible extraction) are retained in the local research archive. The [older JPL physical-parameter table](https://ssd.jpl.nasa.gov/planets/phys_par.html) adopts different geometric values (for example Earth 0.367 and Mars 0.150). Do not average or silently interchange these independently adopted parameter sets.

## Formula

Let `P` be parent position, `M` the receiving moon position, `S` the Sun position, `R` the parent's spherical radius, `r=|S−P|`, and `d=|M−P|`, all in one frame and consistent length units. Phase is measured **at the parent**, not at the moon or camera:

```text
cosAlpha = clamp(dot(normalize(S-P), normalize(M-P)), -1, 1)
alpha = acos(cosAlpha)                       // radians
Phi = max(0, (sin(alpha)+(PI-alpha)*cos(alpha))/PI)

parentIrradiance / sunlightAt1AU =
    (AU/r)^2 * geometricAlbedoV * (R/d)^2 * Phi
```

For a receiving surface with outward unit normal `n`, multiply by `max(0,dot(n,normalize(P-M)))`. This is a small-source approximation; using a surface position instead of the moon centre improves direction and distance locally. Apply the receiving material's reflectance and any artistic exposure gain afterward. The usual reflected-light geometric scaling is described in [NASA/JPL's HabEx report](https://www.jpl.nasa.gov/habex/pdf/HabEx_Interim_Report.pdf); the normalized Lambert phase above follows from the analytic Lambert-sphere phase expression discussed in [NASA's archived Cuzzi et al. paper](https://ntrs.nasa.gov/api/citations/20170009831/downloads/20170009831.pdf?attachment=true), divided by its full-phase value.

Sanity checks: `Phi(0)=1`, `Phi(PI/2)=1/PI`, `Phi(PI)=0`. **Do not insert an additional factor of 2/3 or 1/π into the parent-irradiance formula**: geometric albedo already normalizes the full-phase disk brightness. A material BRDF may separately contain its own 1/π when converting incident irradiance into outgoing radiance.

To compare against *local unoccluded* direct sunlight at the moon, divide the result by `(AU/|S−M|)^2`. This cleanly preserves the same inverse-square solar normalization used by the main scene. The local research file `snapshot-planetshine-checks.json` evaluates all rendered moons from the actual fixed ephemeris as numerical reference cases.

## Accuracy limits

- A Lambert phase curve is an approximation. Real clouds, terrain, opposition effects and atmospheric scattering are not Lambertian; geometric albedo plus this phase law is not a measured phase curve. It does not recover the separate measured Bond albedo or total thermal energy balance.
- The coefficient is V-band, not a measured RGB spectrum. Neutral secondary light is defensible for this approximation; any colour tint derived from the retro planet palette is artistic.
- Earth varies with cloud cover and viewing geometry. Giant-planet cloud brightness, Mars dust and Pluto's bright/dark terrain also vary. A single average albedo cannot reproduce those variations.
- Parent radius and `(R/d)^2` treat the planet as a spherical unresolved reflector. Oblateness changes projected area. The approximation is weakest for very close moons: Mars has an angular radius of roughly twenty degrees from Phobos. Its extended disk can illuminate beyond a point-source terminator. A surface integral over the illuminated, visible parent disk is the next fidelity step.
- Planet/ring shadows, moon transits and occultations require independent visibility tests. Rings are not included in this spherical-parent term. Reflected light cannot replace eclipse handling for direct sunlight, and no isotropic ambient floor is implied by this calculation.
- This models reflected **visible** sunlight only. It does not add planetary thermal infrared, auroral emission or artificial light.


## Implemented eclipse and display model

Direct sunlight is reduced by the fraction of the solar disk visible past the spherical parent, using measured radii and fixed positions. Angular disk overlap includes approximate total/partial/annular cases. This uses uniform solar brightness and the moon centre, not a surface-resolved shadow: oblateness, solar limb darkening, ring/mutual moon shadows and atmospheric refraction are omitted. Parent-reflected light is zero inside total parent umbra. At this snapshot Tethys is centre-eclipsed and therefore has no direct Sun or parent-reflected term in this model.

The surface shader sums the direct and reflected directional terms, each with a nonnegative receiving cosine. Exposure multiplies this sum: zero incoming light remains zero. No arbitrary ambient illumination or visible thermal emission is added. Existing wireframe outlines are navigation overlays, not emitted light.

Planetary exposure is a **display adaptation**, not a calibrated all-sky camera or biological eye simulation. It meters the nearest body's visible illuminated fraction with a Lambert phase approximation, smooths changes in logarithmic exposure, and retains the existing Mars starting view as its reference. A bounded exposure ceiling prevents runaway gain on an unlit view. The star catalogue and Gaia backdrop keep their separate artistic brightness scale. Turn off “Adapt planetary exposure” for the previous fixed-gain mode; “Reflected planetlight on moons” independently disables the secondary illumination term. “Adaptation time” controls settling speed.

Bloom is evaluated from linear scene light; ACES exposure/tone mapping and sRGB conversion happen once; 32-level ordered display dithering and grain happen afterward. Dither thresholds are positive and preserve zero. Planet maps, retro palettes and schematic moon shapes are not measured spectral reflectance maps, so displayed RGB brightness should not be treated as calibrated photometry.
