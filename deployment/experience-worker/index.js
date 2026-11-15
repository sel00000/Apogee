// Sojourner and its Records iframe share this Worker's root origin.
const PAGES_ROOT = 'https://jp-feynman.github.io/stellarium-web-preview/experience/';
const LIVE_ORIGIN = 'https://sojourner.artificialisabel.com';
const LIVE_FEEDS = new Set(['system', 'spacecraft', 'asteroids', 'satellites', 'solar']);
const OPTIONAL_MODELS = new Set([
  '/assets/spacecraft/juno.glb', '/assets/spacecraft/jwst-light.glb',
  '/assets/spacecraft/mars-odyssey.glb', '/assets/spacecraft/mro.glb',
]);
// Exact v5 inventory includes integration and attribution patches. Never fall
// back to original JS on a missing Pages file: mixing versions breaks lifecycle.
const STATIC_PATHS = new Set([
  "/app.GFXWGZEC.js",
  "/assets/audio/astra-recorded/astra-00004db5c9ce.mp3",
  "/assets/audio/astra-recorded/astra-03457cf78208.mp3",
  "/assets/audio/astra-recorded/astra-03f54c561b1f.mp3",
  "/assets/audio/astra-recorded/astra-052428d38406.mp3",
  "/assets/audio/astra-recorded/astra-06879baf7f7c.mp3",
  "/assets/audio/astra-recorded/astra-0728be6f78d1.mp3",
  "/assets/audio/astra-recorded/astra-08d08002cf0c.mp3",
  "/assets/audio/astra-recorded/astra-09e0092dd238.mp3",
  "/assets/audio/astra-recorded/astra-09e10e1d7475.mp3",
  "/assets/audio/astra-recorded/astra-0cc5e2a6d577.mp3",
  "/assets/audio/astra-recorded/astra-0d63b40b5e5f.mp3",
  "/assets/audio/astra-recorded/astra-10dcec03b2a9.mp3",
  "/assets/audio/astra-recorded/astra-11ee8b61e0de.mp3",
  "/assets/audio/astra-recorded/astra-13abb5f6ec44.mp3",
  "/assets/audio/astra-recorded/astra-14a3f74e0aec.mp3",
  "/assets/audio/astra-recorded/astra-14ca1a32c5db.mp3",
  "/assets/audio/astra-recorded/astra-1503541b1f04.mp3",
  "/assets/audio/astra-recorded/astra-15352f1f880a.mp3",
  "/assets/audio/astra-recorded/astra-15659b4e0583.mp3",
  "/assets/audio/astra-recorded/astra-15c0189312d4.mp3",
  "/assets/audio/astra-recorded/astra-173ebfa8ece8.mp3",
  "/assets/audio/astra-recorded/astra-18e826163d51.mp3",
  "/assets/audio/astra-recorded/astra-19ee37c7dd2b.mp3",
  "/assets/audio/astra-recorded/astra-19f9dfabe3f8.mp3",
  "/assets/audio/astra-recorded/astra-1a0d3252ea23.mp3",
  "/assets/audio/astra-recorded/astra-1a1059da7afa.mp3",
  "/assets/audio/astra-recorded/astra-1b41c26e798f.mp3",
  "/assets/audio/astra-recorded/astra-1ca4da72d3d9.mp3",
  "/assets/audio/astra-recorded/astra-1caeb921765e.mp3",
  "/assets/audio/astra-recorded/astra-1d32e9651caa.mp3",
  "/assets/audio/astra-recorded/astra-2072c86e3749.mp3",
  "/assets/audio/astra-recorded/astra-20ad85e846b5.mp3",
  "/assets/audio/astra-recorded/astra-20cce27d36a9.mp3",
  "/assets/audio/astra-recorded/astra-216c7cba1af1.mp3",
  "/assets/audio/astra-recorded/astra-22318f79886c.mp3",
  "/assets/audio/astra-recorded/astra-2283ca80ea8e.mp3",
  "/assets/audio/astra-recorded/astra-24710c07ed7e.mp3",
  "/assets/audio/astra-recorded/astra-28cdb307960a.mp3",
  "/assets/audio/astra-recorded/astra-2965802978b8.mp3",
  "/assets/audio/astra-recorded/astra-2ab07243335b.mp3",
  "/assets/audio/astra-recorded/astra-2bcf002886a5.mp3",
  "/assets/audio/astra-recorded/astra-2cef3a097126.mp3",
  "/assets/audio/astra-recorded/astra-2d4183e2babd.mp3",
  "/assets/audio/astra-recorded/astra-2d45d30f25d7.mp3",
  "/assets/audio/astra-recorded/astra-2dd73b281a62.mp3",
  "/assets/audio/astra-recorded/astra-2e1c59460479.mp3",
  "/assets/audio/astra-recorded/astra-2e94bbcc5eff.mp3",
  "/assets/audio/astra-recorded/astra-2eddecb92999.mp3",
  "/assets/audio/astra-recorded/astra-2f05f3cdc387.mp3",
  "/assets/audio/astra-recorded/astra-2fd833834e42.mp3",
  "/assets/audio/astra-recorded/astra-300aae321e47.mp3",
  "/assets/audio/astra-recorded/astra-3290b6d265a2.mp3",
  "/assets/audio/astra-recorded/astra-32a18cb1d223.mp3",
  "/assets/audio/astra-recorded/astra-3501cc78805a.mp3",
  "/assets/audio/astra-recorded/astra-36c789d3f4de.mp3",
  "/assets/audio/astra-recorded/astra-375b6e7551d0.mp3",
  "/assets/audio/astra-recorded/astra-378d5e09388a.mp3",
  "/assets/audio/astra-recorded/astra-3b94d51bdcec.mp3",
  "/assets/audio/astra-recorded/astra-3baa5fdef77b.mp3",
  "/assets/audio/astra-recorded/astra-3d696f375408.mp3",
  "/assets/audio/astra-recorded/astra-3d947788e86c.mp3",
  "/assets/audio/astra-recorded/astra-3d99bd74d8e3.mp3",
  "/assets/audio/astra-recorded/astra-3db5cd8094b7.mp3",
  "/assets/audio/astra-recorded/astra-3e4426810a5c.mp3",
  "/assets/audio/astra-recorded/astra-422113d02192.mp3",
  "/assets/audio/astra-recorded/astra-426d2310c28b.mp3",
  "/assets/audio/astra-recorded/astra-430dada9c067.mp3",
  "/assets/audio/astra-recorded/astra-443c8f2a92d2.mp3",
  "/assets/audio/astra-recorded/astra-458d0279f6eb.mp3",
  "/assets/audio/astra-recorded/astra-45a5b59129d0.mp3",
  "/assets/audio/astra-recorded/astra-45f51645ad82.mp3",
  "/assets/audio/astra-recorded/astra-4649ccd9bdc5.mp3",
  "/assets/audio/astra-recorded/astra-475271424a09.mp3",
  "/assets/audio/astra-recorded/astra-476e7c5213cc.mp3",
  "/assets/audio/astra-recorded/astra-4770530523a9.mp3",
  "/assets/audio/astra-recorded/astra-48dd44d7b12a.mp3",
  "/assets/audio/astra-recorded/astra-4908bb9d8624.mp3",
  "/assets/audio/astra-recorded/astra-4b90b7bcfc91.mp3",
  "/assets/audio/astra-recorded/astra-4bf79a3b3b1f.mp3",
  "/assets/audio/astra-recorded/astra-4dfb475f7b46.mp3",
  "/assets/audio/astra-recorded/astra-4ef72bb2d91e.mp3",
  "/assets/audio/astra-recorded/astra-4f8520e639e5.mp3",
  "/assets/audio/astra-recorded/astra-50655c548714.mp3",
  "/assets/audio/astra-recorded/astra-50e41e57f8ad.mp3",
  "/assets/audio/astra-recorded/astra-51c3cc53ace9.mp3",
  "/assets/audio/astra-recorded/astra-52920cd8c9d1.mp3",
  "/assets/audio/astra-recorded/astra-55a93c046fc4.mp3",
  "/assets/audio/astra-recorded/astra-5609585fa746.mp3",
  "/assets/audio/astra-recorded/astra-560c33566825.mp3",
  "/assets/audio/astra-recorded/astra-56c265c68746.mp3",
  "/assets/audio/astra-recorded/astra-57443a957eb9.mp3",
  "/assets/audio/astra-recorded/astra-59e0473c6724.mp3",
  "/assets/audio/astra-recorded/astra-5c4d0fd258a5.mp3",
  "/assets/audio/astra-recorded/astra-5cd02b7bdb34.mp3",
  "/assets/audio/astra-recorded/astra-5d6770a90fea.mp3",
  "/assets/audio/astra-recorded/astra-5d6bb9d255b1.mp3",
  "/assets/audio/astra-recorded/astra-5db0d792d0e0.mp3",
  "/assets/audio/astra-recorded/astra-5ee6d9f708b9.mp3",
  "/assets/audio/astra-recorded/astra-5fe5022388b2.mp3",
  "/assets/audio/astra-recorded/astra-608cce6a2370.mp3",
  "/assets/audio/astra-recorded/astra-60ebe76b395c.mp3",
  "/assets/audio/astra-recorded/astra-61e15fe99ba7.mp3",
  "/assets/audio/astra-recorded/astra-61fd32122563.mp3",
  "/assets/audio/astra-recorded/astra-62522898c3dc.mp3",
  "/assets/audio/astra-recorded/astra-62fa1d3fe2bd.mp3",
  "/assets/audio/astra-recorded/astra-635de5fd3464.mp3",
  "/assets/audio/astra-recorded/astra-63887827007c.mp3",
  "/assets/audio/astra-recorded/astra-63a886a35033.mp3",
  "/assets/audio/astra-recorded/astra-63f219251a03.mp3",
  "/assets/audio/astra-recorded/astra-642883b2d1bb.mp3",
  "/assets/audio/astra-recorded/astra-6434a9825c5f.mp3",
  "/assets/audio/astra-recorded/astra-64556a8c0270.mp3",
  "/assets/audio/astra-recorded/astra-68171b916296.mp3",
  "/assets/audio/astra-recorded/astra-6d70c2459b1e.mp3",
  "/assets/audio/astra-recorded/astra-6d71d07903c9.mp3",
  "/assets/audio/astra-recorded/astra-6eef0ae76b90.mp3",
  "/assets/audio/astra-recorded/astra-6fb7ab5dac2b.mp3",
  "/assets/audio/astra-recorded/astra-71ba0d3c1a6b.mp3",
  "/assets/audio/astra-recorded/astra-7241eaeadd3c.mp3",
  "/assets/audio/astra-recorded/astra-7266e6cea304.mp3",
  "/assets/audio/astra-recorded/astra-728df05d80e6.mp3",
  "/assets/audio/astra-recorded/astra-7427d613ae80.mp3",
  "/assets/audio/astra-recorded/astra-76bab0be5b56.mp3",
  "/assets/audio/astra-recorded/astra-7780f4a691f1.mp3",
  "/assets/audio/astra-recorded/astra-782d17610b1c.mp3",
  "/assets/audio/astra-recorded/astra-788446d59b5f.mp3",
  "/assets/audio/astra-recorded/astra-7ae34c96811e.mp3",
  "/assets/audio/astra-recorded/astra-7b58d1b1e769.mp3",
  "/assets/audio/astra-recorded/astra-7b92341ac485.mp3",
  "/assets/audio/astra-recorded/astra-7bcdabfa7213.mp3",
  "/assets/audio/astra-recorded/astra-7d83522c79f2.mp3",
  "/assets/audio/astra-recorded/astra-7dac8a9a13b9.mp3",
  "/assets/audio/astra-recorded/astra-7f486f150848.mp3",
  "/assets/audio/astra-recorded/astra-82006bfdf576.mp3",
  "/assets/audio/astra-recorded/astra-8245d0347c5a.mp3",
  "/assets/audio/astra-recorded/astra-8334ebcd7a41.mp3",
  "/assets/audio/astra-recorded/astra-838db97d483a.mp3",
  "/assets/audio/astra-recorded/astra-83a8ba44e119.mp3",
  "/assets/audio/astra-recorded/astra-85115abd3d69.mp3",
  "/assets/audio/astra-recorded/astra-86f1e9428200.mp3",
  "/assets/audio/astra-recorded/astra-870833c7d230.mp3",
  "/assets/audio/astra-recorded/astra-87349fdb18c9.mp3",
  "/assets/audio/astra-recorded/astra-8a586b7ace26.mp3",
  "/assets/audio/astra-recorded/astra-8afc1d377018.mp3",
  "/assets/audio/astra-recorded/astra-8bb72e2ecd4c.mp3",
  "/assets/audio/astra-recorded/astra-8bfa83df8c8c.mp3",
  "/assets/audio/astra-recorded/astra-8cde6b1c7d10.mp3",
  "/assets/audio/astra-recorded/astra-8ce2c990c838.mp3",
  "/assets/audio/astra-recorded/astra-8daaeff66112.mp3",
  "/assets/audio/astra-recorded/astra-8ddc7ce263af.mp3",
  "/assets/audio/astra-recorded/astra-91c3e7b5a2a5.mp3",
  "/assets/audio/astra-recorded/astra-92ebbe72c80b.mp3",
  "/assets/audio/astra-recorded/astra-95127c83afe5.mp3",
  "/assets/audio/astra-recorded/astra-951aeae730a1.mp3",
  "/assets/audio/astra-recorded/astra-967a33cc9c8a.mp3",
  "/assets/audio/astra-recorded/astra-980e5ae8171f.mp3",
  "/assets/audio/astra-recorded/astra-98ff48bd9bdc.mp3",
  "/assets/audio/astra-recorded/astra-99308241cb66.mp3",
  "/assets/audio/astra-recorded/astra-9a563d910ed5.mp3",
  "/assets/audio/astra-recorded/astra-9c6a4642a7fb.mp3",
  "/assets/audio/astra-recorded/astra-9edf4276b08f.mp3",
  "/assets/audio/astra-recorded/astra-9f2090e75ef7.mp3",
  "/assets/audio/astra-recorded/astra-a10b64c58a4f.mp3",
  "/assets/audio/astra-recorded/astra-a1e60b472832.mp3",
  "/assets/audio/astra-recorded/astra-a37994bf9926.mp3",
  "/assets/audio/astra-recorded/astra-a3bcc7462ad2.mp3",
  "/assets/audio/astra-recorded/astra-a4611cee95eb.mp3",
  "/assets/audio/astra-recorded/astra-a488350516f3.mp3",
  "/assets/audio/astra-recorded/astra-a5b981c2f07e.mp3",
  "/assets/audio/astra-recorded/astra-a68bbbbc7364.mp3",
  "/assets/audio/astra-recorded/astra-a83648873620.mp3",
  "/assets/audio/astra-recorded/astra-a9c860f36433.mp3",
  "/assets/audio/astra-recorded/astra-ad0224877f1f.mp3",
  "/assets/audio/astra-recorded/astra-ae485c4bdd81.mp3",
  "/assets/audio/astra-recorded/astra-aea7ef2ae17f.mp3",
  "/assets/audio/astra-recorded/astra-b0499122311c.mp3",
  "/assets/audio/astra-recorded/astra-b09138de80f3.mp3",
  "/assets/audio/astra-recorded/astra-b1fcd9ed6291.mp3",
  "/assets/audio/astra-recorded/astra-b42dd7b56607.mp3",
  "/assets/audio/astra-recorded/astra-b49de5169ac5.mp3",
  "/assets/audio/astra-recorded/astra-b53ea453aa27.mp3",
  "/assets/audio/astra-recorded/astra-b59520b16d57.mp3",
  "/assets/audio/astra-recorded/astra-b65935247b7d.mp3",
  "/assets/audio/astra-recorded/astra-b663f314030c.mp3",
  "/assets/audio/astra-recorded/astra-b7344e6d81d6.mp3",
  "/assets/audio/astra-recorded/astra-b76a322a1764.mp3",
  "/assets/audio/astra-recorded/astra-b7b6093472eb.mp3",
  "/assets/audio/astra-recorded/astra-b7d90d2f4a7f.mp3",
  "/assets/audio/astra-recorded/astra-b812261578ec.mp3",
  "/assets/audio/astra-recorded/astra-b8a1631a0fe7.mp3",
  "/assets/audio/astra-recorded/astra-b8a1cbf315a7.mp3",
  "/assets/audio/astra-recorded/astra-b93284edcb23.mp3",
  "/assets/audio/astra-recorded/astra-ba380d55436e.mp3",
  "/assets/audio/astra-recorded/astra-be0615844731.mp3",
  "/assets/audio/astra-recorded/astra-bedefe54f8dd.mp3",
  "/assets/audio/astra-recorded/astra-bff474eeac2a.mp3",
  "/assets/audio/astra-recorded/astra-c397e9c719e7.mp3",
  "/assets/audio/astra-recorded/astra-c4ed5fd0773d.mp3",
  "/assets/audio/astra-recorded/astra-c568f3dde057.mp3",
  "/assets/audio/astra-recorded/astra-c78534a3da97.mp3",
  "/assets/audio/astra-recorded/astra-c7c7be7a3f25.mp3",
  "/assets/audio/astra-recorded/astra-c8fc5095f2cd.mp3",
  "/assets/audio/astra-recorded/astra-c943aafabdc8.mp3",
  "/assets/audio/astra-recorded/astra-ce9de7c4fa52.mp3",
  "/assets/audio/astra-recorded/astra-d1aecb4905cf.mp3",
  "/assets/audio/astra-recorded/astra-d1d5a566ec7e.mp3",
  "/assets/audio/astra-recorded/astra-d3a50b98e750.mp3",
  "/assets/audio/astra-recorded/astra-d5c9278a5e99.mp3",
  "/assets/audio/astra-recorded/astra-d689483d522b.mp3",
  "/assets/audio/astra-recorded/astra-d75635bf0ba1.mp3",
  "/assets/audio/astra-recorded/astra-d8c9d4c5e2f7.mp3",
  "/assets/audio/astra-recorded/astra-dac981b6a29c.mp3",
  "/assets/audio/astra-recorded/astra-db42a376abd2.mp3",
  "/assets/audio/astra-recorded/astra-dbeea3f6118d.mp3",
  "/assets/audio/astra-recorded/astra-dc12b66cc6b2.mp3",
  "/assets/audio/astra-recorded/astra-dc94134f7e34.mp3",
  "/assets/audio/astra-recorded/astra-ddc932d24f29.mp3",
  "/assets/audio/astra-recorded/astra-df4dda5b39ba.mp3",
  "/assets/audio/astra-recorded/astra-e068cb144cad.mp3",
  "/assets/audio/astra-recorded/astra-e5503358b0bf.mp3",
  "/assets/audio/astra-recorded/astra-e6a69cfb1601.mp3",
  "/assets/audio/astra-recorded/astra-e754963e73c8.mp3",
  "/assets/audio/astra-recorded/astra-e7be3950d511.mp3",
  "/assets/audio/astra-recorded/astra-e90df5e964a5.mp3",
  "/assets/audio/astra-recorded/astra-ea0b73611eba.mp3",
  "/assets/audio/astra-recorded/astra-ea936939c35b.mp3",
  "/assets/audio/astra-recorded/astra-ec43437e5d37.mp3",
  "/assets/audio/astra-recorded/astra-ed90ff5160b3.mp3",
  "/assets/audio/astra-recorded/astra-eedfe2b8afc3.mp3",
  "/assets/audio/astra-recorded/astra-f107dcf7320b.mp3",
  "/assets/audio/astra-recorded/astra-f11dff824584.mp3",
  "/assets/audio/astra-recorded/astra-f1a1c551b3df.mp3",
  "/assets/audio/astra-recorded/astra-f40f8ff70c9b.mp3",
  "/assets/audio/astra-recorded/astra-f42f1296db71.mp3",
  "/assets/audio/astra-recorded/astra-f49085c3ea55.mp3",
  "/assets/audio/astra-recorded/astra-f56bef5202b2.mp3",
  "/assets/audio/astra-recorded/astra-f591ea60f24f.mp3",
  "/assets/audio/astra-recorded/astra-f59204c1f257.mp3",
  "/assets/audio/astra-recorded/astra-f6c8f4171a00.mp3",
  "/assets/audio/astra-recorded/astra-f738ce6c95ce.mp3",
  "/assets/audio/astra-recorded/astra-f73cd299f6ac.mp3",
  "/assets/audio/astra-recorded/astra-f761aa23bd86.mp3",
  "/assets/audio/astra-recorded/astra-f835877fe2b7.mp3",
  "/assets/audio/astra-recorded/astra-f9e8bac264c9.mp3",
  "/assets/audio/astra-recorded/astra-fad58858cab8.mp3",
  "/assets/audio/astra-recorded/astra-fd9fc13922be.mp3",
  "/assets/audio/astra-recorded/astra-fe3a8b9bb96d.mp3",
  "/assets/audio/astra-recorded/astra-fed5625a9b25.mp3",
  "/assets/audio/astra-recorded/astra-ff7784609093.mp3",
  "/assets/audio/astra-recorded/astra-ffe2a75c747c.mp3",
  "/assets/audio/elevenlabs-2026-10-02/01-soft-beep.mono.mp3",
  "/assets/audio/elevenlabs-2026-10-02/02-low-boop.mp3",
  "/assets/audio/elevenlabs-2026-10-02/03-double-chirp.mono.mp3",
  "/assets/audio/elevenlabs-2026-10-02/04-descending-boop.mono.mp3",
  "/assets/audio/elevenlabs-2026-10-02/05-propulsion-surge.mp3",
  "/assets/audio/elevenlabs-2026-10-02/08-deep-scan.mono.mp3",
  "/assets/audio/music/dark-was-the-night.mp3",
  "/assets/audio/sentry/ambience.mp3",
  "/assets/audio/sentry/discover.mp3",
  "/assets/audio/sentry/scan.mp3",
  "/assets/audio/sentry/select.mp3",
  "/assets/audio/sentry/travel.mp3",
  "/assets/audio/sentry/ui.mp3",
  "/assets/bennu.glb",
  "/assets/earth.jpg",
  "/assets/eros.glb",
  "/assets/fonts/font-0.ttf",
  "/assets/fonts/font-1.ttf",
  "/assets/fonts/font-2.ttf",
  "/assets/fonts/font-4.ttf",
  "/assets/fonts/imbue-variable.ttf",
  "/assets/fonts/instrument-serif-400-italic.ttf",
  "/assets/fonts/instrument-serif-400.ttf",
  "/assets/fonts/saira-condensed-400.ttf",
  "/assets/fonts/saira-condensed-500.ttf",
  "/assets/fonts/saira-condensed-600.ttf",
  "/assets/fonts/saira-condensed-700.ttf",
  "/assets/fonts/sojourner-glyphs-400.ttf",
  "/assets/fonts/sojourner-glyphs-700.ttf",
  "/assets/fonts/texgyreheroscn-bold.otf",
  "/assets/fonts/texgyreheroscn-regular.otf",
  "/assets/gaia-sky-2k.jpg",
  "/assets/gaia-sky.jpg",
  "/assets/jupiter.jpg",
  "/assets/mars.jpg",
  "/assets/mercury.jpg",
  "/assets/moon.jpg",
  "/assets/moons/ariel.jpg",
  "/assets/moons/callisto.jpg",
  "/assets/moons/charon.jpg",
  "/assets/moons/deimos.jpg",
  "/assets/moons/dione.jpg",
  "/assets/moons/enceladus.jpg",
  "/assets/moons/europa.jpg",
  "/assets/moons/ganymede.jpg",
  "/assets/moons/hyperion.jpg",
  "/assets/moons/iapetus.jpg",
  "/assets/moons/io.jpg",
  "/assets/moons/mimas.jpg",
  "/assets/moons/miranda.jpg",
  "/assets/moons/oberon.jpg",
  "/assets/moons/phobos.jpg",
  "/assets/moons/rhea.jpg",
  "/assets/moons/tethys.jpg",
  "/assets/moons/titan.jpg",
  "/assets/moons/titania.jpg",
  "/assets/moons/triton.jpg",
  "/assets/moons/umbriel.jpg",
  "/assets/neptune-coverage.png",
  "/assets/neptune.jpg",
  "/assets/phobos.glb",
  "/assets/procedural/bennu.jpg",
  "/assets/procedural/ceres.jpg",
  "/assets/procedural/eros.jpg",
  "/assets/procedural/gaspra-shape.glb",
  "/assets/procedural/gaspra.jpg",
  "/assets/procedural/hygiea.jpg",
  "/assets/procedural/ida-shape.glb",
  "/assets/procedural/ida.jpg",
  "/assets/procedural/pallas.jpg",
  "/assets/procedural/pluto.jpg",
  "/assets/procedural/psyche.jpg",
  "/assets/procedural/ryugu.jpg",
  "/assets/procedural/vesta.jpg",
  "/assets/ryugu.glb",
  "/assets/saturn-coverage.png",
  "/assets/saturn.jpg",
  "/assets/spacecraft/cassini.glb",
  "/assets/spacecraft/cassini.manifest.json",
  "/assets/spacecraft/dawn.glb",
  "/assets/spacecraft/iss.glb",
  "/assets/spacecraft/juice.glb",
  "/assets/spacecraft/manifest.json",
  "/assets/spacecraft/new-horizons.glb",
  "/assets/spacecraft/psyche.glb",
  "/assets/spacecraft/stereo.glb",
  "/assets/spacecraft/voyager.glb",
  "/assets/uranus-coverage.png",
  "/assets/uranus.jpg",
  "/assets/venus-coverage.png",
  "/assets/venus.jpg",
  "/audio.css",
  "/chunk.6FP2ZNOZ.js",
  "/chunk.73S35ZUP.js",
  "/chunk.FTD2J2V2.js",
  "/chunk.M3XMVLK2.js",
  "/chunk.MMA2UXXD.js",
  "/chunk.ZGWELGUG.js",
  "/cockpit.css",
  "/codex-ingame.LGTBWEYS.js",
  "/codex-ingame.css",
  "/codex-ingame.html",
  "/codex-overlay.css",
  "/codex.css",
  "/data/asset-sources.json",
  "/data/astra-science.json",
  "/data/bodies.json",
  "/data/codex-facts.json",
  "/data/journey-research.md",
  "/data/lighting.md",
  "/data/live/hipparcos-motion.f64",
  "/data/live/orientation-models.json",
  "/data/live/teme-gcrs-2025-2036.f32",
  "/data/live/teme-gcrs-metadata.json",
  "/data/moon-surfaces.json",
  "/data/parent-geometric-albedos.json",
  "/data/research.md",
  "/data/route-candidates.json",
  "/data/spacecraft.md",
  "/data/star-colours.md",
  "/data/star-identities.json",
  "/data/stars.json",
  "/home-type.css",
  "/homecoming.css",
  "/index.html",
  "/integration.css",
  "/integration.js",
  "/intro-art-direction.css",
  "/mobile.KRV3AYWI.js",
  "/mobile.css",
  "/phosphor.css",
  "/play-instructions.css",
  "/sentry-fonts.css",
  "/spacecraft.css",
  "/style.css",
  "/typography.css"
]);
const RESPONSE_HEADERS = [
  'content-type', 'content-length', 'content-encoding', 'content-range',
  'accept-ranges', 'cache-control', 'etag', 'last-modified', 'expires',
  'vary', 'retry-after', 'content-disposition',
];
const CONDITIONAL_HEADERS = ['range', 'if-range', 'if-none-match', 'if-modified-since'];
const NO_BODY_STATUSES = new Set([204, 205, 304]);

function errorResponse(request, status, message, extra = {}) {
  return new Response(request.method === 'HEAD' ? null : `${message}\n`, {
    status, headers: { 'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra },
  });
}

function routeRequest(request) {
  const url = new URL(request.url);
  if (url.username || url.password || url.search.length > 4096 || url.hash) return null;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return null; }
  if (/%(?:2f|5c)/iu.test(url.pathname) || /[\\%:#\u0000-\u001f\u007f]/u.test(path)
      || !path.startsWith('/') || path.startsWith('//')
      || path.split('/').some(segment => segment.startsWith('.'))) return null;
  if (path === '/') path = '/index.html';
  if (STATIC_PATHS.has(path)) {
    return { url: PAGES_ROOT + path.slice(1), live: false, path };
  }
  if (OPTIONAL_MODELS.has(path)) {
    return { url: LIVE_ORIGIN + path, live: false, path };
  }
  let live = path.startsWith('/api/live/') && LIVE_FEEDS.has(path.slice(10));
  if (path.startsWith('/api/live/body/')) {
    const id = path.slice(15);
    live = id.length > 0 && id.length <= 160
      && (/^[A-Za-z0-9_+;.-]+$/u.test(id) || /^DES=[A-Za-z0-9_+ .-]+;$/u.test(id));
  }
  if (!live) return null;
  // Preserve encoded body IDs; never resolve a query parameter as a proxy URL.
  return { url: LIVE_ORIGIN + url.pathname + url.search, live: true, path };
}

/** Test injection does not make the upstream origins configurable. */
export function createHandler({ fetcher = (...args) => fetch(...args), timeoutMs = 180000 } = {}) {
  return async function handle(request) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return errorResponse(request, 405, 'Only GET and HEAD are supported.', { allow: 'GET, HEAD' });
    }
    const route = routeRequest(request);
    if (!route) return errorResponse(request, 404, 'Unknown experience resource.');
    if (request.signal.aborted) return errorResponse(request, 499, 'Request cancelled.');
    const headers = new Headers();
    headers.set('accept', request.headers.get('accept') || '*/*');
    // Preserve the ORIGINAL stream and its Content-Encoding. Cloudflare performs
    // compressed passthrough/negotiation. Never read/text/arrayBuffer this body.
    if (request.headers.has('accept-encoding')) {
      headers.set('accept-encoding', request.headers.get('accept-encoding'));
    }
    if (!route.live) {
      for (const name of CONDITIONAL_HEADERS) {
        if (request.headers.has(name)) headers.set(name, request.headers.get(name));
      }
    }
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(request.signal.reason);
    request.signal.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', onAbort);
    };
    // Bounds headers AND streaming. After headers, timeout fails the stream;
    // it cannot change an already sent HTTP status. Original stream is essential
    // to compressed passthrough. The request context ends when delivery ends.
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Experience upstream timeout'));
      cleanup();
    }, timeoutMs);
    timer.unref?.(); // Node tests only; Workers timers are numeric.
    try {
      const upstream = await fetcher(route.url, {
        method: route.live ? 'GET' : request.method, headers, redirect: 'manual',
        signal: controller.signal, ...(route.live ? { cache: 'no-store' } : {}),
      });
      // Never redirect the iframe to the original site, nor follow an upstream
      // redirect into an arbitrary origin. Changed origins require a code update.
      if (upstream.status >= 300 && upstream.status < 400 && upstream.status !== 304) {
        await upstream.body?.cancel();
        cleanup();
        return errorResponse(request, 502, 'Experience upstream redirected unexpectedly.');
      }
      const responseHeaders = new Headers();
      for (const name of RESPONSE_HEADERS) {
        if (upstream.headers.has(name)) responseHeaders.set(name, upstream.headers.get(name));
      }
      responseHeaders.set('x-content-type-options', 'nosniff');
      if (route.live) responseHeaders.set('cache-control', 'no-store');
      else if (route.path.endsWith('.html')) responseHeaders.set('cache-control', 'no-cache');
      if (request.method === 'HEAD' || NO_BODY_STATUSES.has(upstream.status) || !upstream.body) {
        await upstream.body?.cancel();
        cleanup();
        return new Response(null, { status: upstream.status, statusText: upstream.statusText,
          headers: responseHeaders });
      }
      return new Response(upstream.body, {
        status: upstream.status, statusText: upstream.statusText, headers: responseHeaders,
      });
    } catch {
      cleanup();
      if (timedOut) return errorResponse(request, 504, 'Experience upstream timed out. Try again.');
      if (request.signal.aborted) return errorResponse(request, 499, 'Request cancelled.');
      return errorResponse(request, 502, 'Experience upstream is temporarily unavailable.');
    }
  };
}
export default { fetch: createHandler() };
