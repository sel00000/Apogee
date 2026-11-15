# Experience service

This Node.js 22+ service has no package dependencies. It serves only the SOJOURNER runtime and its fixed-origin live-data/media bridge. The portal and the experience use separate origins; the experience and its internal Records iframe must use the same experience origin.

From the project root:

```text
node services/experience/scripts/serve.mjs --port 4174
node services/experience/scripts/serve.mjs --port 4174 --root dist/experience
node --test services/experience/scripts/server.test.mjs services/experience/scripts/integration.test.mjs
```

`SPHEREX_EXPERIENCE_ROOT` can select the web root. CLI `--root` takes precedence. `PORT` or `--port` sets the port. With no port the standalone service selects an available ephemeral port; the integrated launcher should use a stable configured port because browser flight records belong to an origin, including its port. The service binds to `127.0.0.1`. Public deployment requires an HTTPS reverse proxy at a stable dedicated origin.

The gateway can import `startServer({ webRoot, port })` from `scripts/serve.mjs`, which returns `{ server, port, url, close }`; or `createServer({ webRoot })`, which returns a Node HTTP server. `await close()` stops its connections and closes the server. Closing that server is the gateway's responsibility. `createSojournerServer` remains an alias-compatible export for existing tests. Production upstream is fixed to the original HTTPS site; the only alternate upstreams permitted are loopback test fixtures.

## Portal lifecycle protocol

Embed the root URL with `?embed=1&parentOrigin=<encoded portal origin>` and a referrer policy such as `strict-origin-when-cross-origin`. The bridge checks the exact parent window, exact origin and the supplied referrer when available. Records retains its independent existing same-origin protocol.

Messages from portal:

- `spherex-experience-status`: requests current state.
- `spherex-experience-set-active`, `active: boolean`: pauses/resumes rendering and audio without changing flight velocity or user sound settings. Pausing while a video is exporting returns `spherex-experience-pause-blocked`.
- `spherex-experience-exit`, `requestId: string`: saves available flight/discovery progress, pauses and replies before the portal removes the iframe.

Messages from experience:

- `spherex-experience-state`: `ready`, `exporting`, `active`, `canSave`, `canExit`. Initial state and changes are sent, checked every 500 ms.
- `spherex-experience-exit-ready`: same request ID and `saved: boolean`. During the opening or simulated flight, a normal exit may have `saved: false` because there is no resumable flight snapshot.
- `spherex-experience-exit-blocked`: same request ID and `reason: export_in_progress | save_failed`.

The portal must verify origin/source on every response. On blocked exit it keeps the frame alive. On accepted exit it can blank/remove the frame. The short bridge does not replace the original simulation or fake a successful archive connection. `patch-integration.mjs` applies the same audited render gate and callback block idempotently to the supplied bundle; a changed upstream bundle must be reviewed before patching.

The original acquisition/browser scripts were not included in this service because they contain historical machine paths and are not runtime dependencies. Original materials remain in the source backup. See `apps/experience/NOTICE.md` and its provenance directory for ownership and data scope.
