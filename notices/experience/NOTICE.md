# SOJOURNER source and integration

This experience embeds the recovered public deployment of **SOJOURNER by artificial.isabel**, originally at <https://sojourner.artificialisabel.com/>. It is not a newly authored SPHEREx analysis engine. The source supplied for this integration was `v5.0.0/추가/경보/sojourner/web`; the original application development repository and private backend were not included.

The integration preserves the supplied runtime, bundled license notices, source data and asset attribution. It adds a Korean experience/help dialog with original-author attribution and a narrowly scoped portal lifecycle bridge. Original publication and asset manifests are preserved in `provenance/`. Those manifests describe the incoming files; the modified integration bundle has a new hash and is listed in `integration-manifest.json`.

The incoming publication record documents earlier removal of creator/social labels. That record is retained as provenance, not as permission to remove attribution. The integrated help dialog identifies the original work and author.

Component notices remain in their files, including Three.js MIT, the video component MPL-2.0, Gaia dataset CC BY-SA 3.0 IGO, and constellation data CC BY-SA 4.0. Asset-specific sources are in `web/data/asset-sources.json` and `web/data/star-identities.json`. No blanket license grant for the complete application or all audio was supplied. Confirm the appropriate reuse/distribution basis and preserve component attribution before public distribution.

The fixed-origin relay uses the original public service for `/api/live/*` and missing allowed assets. Four optional spacecraft models remain streamed. This integration does not recover or replace that backend, and does not turn archived API snapshots into live data.

Positions inform an educational flight experience; scans, travel and story are simulations. This screen does not measure SPHEREx spectra, reconstruct asteroid surfaces or assess collision risk.
