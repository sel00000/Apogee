# Star colours and the observed Milky Way

The prototype's original star colours were deterministic bins of each Hipparcos star's recorded **B−V photometric colour index**, not random choices. B−V is a measured colour difference between passbands; it is not itself a catalogue spectral classification.

The new data joins actual **SpType (H76)** classifications from [ESA's Hipparcos Main Catalogue, CDS I/239/hip_main](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239?format=html&tex=true). These are compiled spectral classifications from the literature and other catalogues, not spectra measured by Hipparcos itself. The deployed data carries the broad class the game draws; the original classification text is kept in `research/live/hipparcos-spectral-types.json` (keyed by HIP ID), and the source flags in the local research archive. Broad classes use the leading reported O/B/A/F/G/K/M class, including explicit `sd` prefixes. Composite/uncertain classifications keep their original text in that archive; no class is inferred from B−V. Other reported types remain `other`; blank types remain `unknown`.

| Broad class | Stars |
|---|---:|
| O | 136 |
| B | 5,342 |
| A | 8,314 |
| F | 7,313 |
| G | 5,832 |
| K | 12,555 |
| M | 1,786 |
| Other reported spectral types | 99 |
| No reported spectral type | 17 |
| **Total** | **41,394** |

For the display legend, the familiar sequence runs from blue O/B stars through white A, pale yellow F/G, orange K and red M. These labels describe broad temperature-related colour tendencies; display RGB values and saturation are a chosen visual encoding. Do not call a saturated retro palette a calibrated reproduction of human vision. [NASA's explanation](https://science.nasa.gov/exoplanets/stars/)

The Gaia background is also based on observations: ESA's [EDR3 all-sky colour map](https://www.esa.int/ESA_Multimedia/Images/2020/12/The_colour_of_the_sky_from_Gaia_s_Early_Data_Release_32) combines the observed brightness and colour of over 1.8 billion stars. Bright regions show integrated starlight; dark lanes include foreground interstellar material obscuring that light. It is a distant sky map, **not a population of nearby floating dust particles**. Dithering, reduced brightness, colour grading and the term “stardust” describe the rendering treatment.

The deployed [stars.json](/data/stars.json) preserves every original row: HIP ID, brightness, B−V and distance unchanged, with the unit direction rounded to 6 decimals (at most 0.2″, `coordinateDecimals`). Column 7 (spectral type) ships empty to keep the download small, and column 8 holds the broad class; the full spectral-type text is in `research/live/hipparcos-spectral-types.json`. The local research archive additionally contains `star-types.json` (records keyed by HIP ID and original source flags), `fetch_star_types.py` (the reproducible join), and `raw/hipparcos-vmag8-spectral.tsv` (the original response). All 41,394 HIP IDs matched, and original positions, brightness, B−V and distances were verified unchanged. Spot checks include Vega A0Vvar, Betelgeuse M2Ib, Rigel B8Ia and Alpha Centauri A G2V.

Hipparcos credit/licence remains **Credit: ESA; CC BY-NC 3.0 IGO**. The separate Gaia sky image is credited to **ESA/Gaia/DPAC; acknowledgement A. Moitinho**, with the image page offering CC BY-SA 3.0 IGO or ESA Standard Licence.
