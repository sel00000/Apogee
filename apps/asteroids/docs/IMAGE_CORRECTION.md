# Reproducible image correction — 2026-11-15

The selected method is conservative relative photometric correction, not a universal
noise remover: native quality masking plus variance-weighted robust gain/background
fitting, protecting the target's entire predicted track. Original calibrated FITS files
and existing images are unchanged. A new 4-panel atlas contains registered original,
corrected image, original model, and gain-adjusted model. Both photo panels use exactly
the same display stretch and WCS. Purple means unavailable, not a reconstructed pixel.

## Rationale and sources

Alard & Lupton's least-squares framework models an image as a transformed reference plus
background: https://arxiv.org/abs/astro-ph/9712287 . Full difference imaging additionally
requires a justified PSF-matching kernel and compatible passbands. SPHEREx has spatially
varying wavelength: https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/ .
Our small, sometimes two-frame, mixed-local-wavelength sequences do not justify fitting
a flexible kernel and claiming calibrated difference detections. We implement the
restricted gain + background-plane subproblem, with conservative rejection; this is
NOT a complete Alard-Lupton or ZOGY implementation. No PSF matching, deconvolution,
extra astrometric registration, temporal median subtraction, or AI denoising is done.

Official variance-based fitting example:
https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html
Related flag handling:
https://github.com/cucuradu/skyshift/blob/main/core/src/skyshift_core/flags.py
https://github.com/ahmedatta3322/ghostshift/blob/main/diff.py

## Algorithm

1. Verify each cached FITS SHA256 against original provenance. Read IMAGE, VARIANCE,
   FLAGS and celestial WCS. Use header-defined masks for OVERFLOW, SUR_ERROR, NONFUNC,
   MISSING, HOT, COLD, NONLINEAR. Do not blindly reject SOURCE or OUTLIER.
2. Resample onto the existing grid. Bilinear intensity weights are w; marginal variance
   uses sum(w² variance). Every contributing hard-bad pixel invalidates the output.
   This variance does not include resampling covariance or calibration uncertainty.
3. Select the frame with most valid pixels as reference. Remove each frame's median
   level. Exclude radius 8 pixels about EVERY predicted target position from fitting
   and validation. This protects the moving source, including sub-pixel motion.
4. Fit reference ≈ gain * frame + b0 + bx*x + by*y using 12 Huber IRLS iterations.
   Weights include reference variance + gain² frame variance. Huber tuning is 1.345,
   with robust residual scale floored at one. Coordinates x/y are normalized.
5. Withhold one third of 8x8 spatial blocks from the fit. Require >=300 training and
   >=150 validation pixels, gain between .5 and 2, and >=2% decrease in held-out
   median absolute residual / sqrt(original variance + reference variance).
   Same denominator before/after prevents gain-dependent score manipulation.
   These thresholds are engineering guards, not false-positive probabilities.
6. Reject unsuccessful fits: retain original intensities, only hard-mask pixels.
   Reference and standalone photos likewise receive mask-only treatment.
7. Corrected variance = gain² marginal variance. Fit-parameter uncertainty and
   cross-pixel covariance are NOT included; not a detection-significance map.
   Model amplitudes receive the identical gain; position and WCS never change.

## Products and UI

Run from workspace root:
`.venv/bin/python S/한결/한결소행성/scripts/correct_images.py`

`public/data/corrections.json` records accepted/rejected/reference/single-frame status,
fit parameters, holdout residuals, mask fraction, source hash, and common stretch.
Every prepared image is covered, including standalone photos not selected for replay.
For each atlas an NPZ stores original, corrected, variance, valid arrays in FITS-style
bottom-up orientation. PNGs are flipped for screen coordinates. Intensity arrays are
MJy/sr after median-level removal and relative photometric scaling; not new absolute
calibration. The original FITS link remains available.

UI: original / corrected / split. Changes update both sidebar and 3D photo texture
without recomputing geometry or resetting the camera. At most 8 atlases are cached;
all pixel processing happens offline. The displayed residual is the candidate fit's
score even if rejected; rejection and mask-only fallback are explicitly labeled.

## Validation and limitations

Synthetic known-gain/background tests add a protected subpixel Gaussian source and
verify no source subtraction, correct gain recovery, and variance scaling. All
prepared products are checked for dimensions, provenance, finite valid pixels and
acceptance criteria. This is a conservation check, not completeness/false-positive
calibration across the mission. Wavelength-dependent stars, PSF differences, unflagged
cosmic rays, ghosts, and genuine variables may remain. A smaller residual is not proof
that every changed pixel is noise, or that a candidate is an asteroid.
