/** Repeatable, narrow integration patch. Never rebuilds or relabels the original engine. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const runtime = fileURLToPath(new URL('../../../apps/experience/web/app.GFXWGZEC.js', import.meta.url));
const marker = '// SPHEREX_PORTAL_INTEGRATION_V1';
let source = await readFile(runtime, 'utf8');
if (source.includes(marker)) source = source.slice(0, source.indexOf(marker));
{
  const needle = 'if(document.hidden||Au){';
  if (source.split(needle).length !== 2 && !source.includes('if(document.hidden||Au||globalThis.__spherexExperiencePaused){')) throw new Error('Unexpected SOJOURNER render gate; review this runtime before patching.');
  source = source.replace(needle, 'if(document.hidden||Au||globalThis.__spherexExperiencePaused){');
  source += `\n${marker}
import { installExperienceIntegration } from './integration.js';
let spherexPortalActive = true, spherexInfoOpen = false;
function spherexApplyActivity() {
  globalThis.__spherexExperiencePaused = !spherexPortalActive || spherexInfoOpen;
  _i = 0;
  Xt.clear(); Ca = 0; Yt = null;
  gt?.setHidden(document.hidden || globalThis.__spherexExperiencePaused);
}
installExperienceIntegration({
  getState: () => ({ ready: !!ja, exporting: !!(Ka || ct?.exportController || ct?.exportNavigation), canSave: !!ja && !!Q?.canFly && !lt?.active && !Ka }),
  setActive(active) { spherexPortalActive = active; spherexApplyActivity(); },
  setInfoOpen(open) { spherexInfoOpen = open; spherexApplyActivity(); },
  save() {
    ee?.save(); ee?.saveJournal(); xe?.save();
    if (!ja || !Q?.canFly || lt?.active || Ka) return false;
    // Match the runtime's flight snapshot while allowing quota/storage errors to
    // reach the portal. The original periodic cr() intentionally swallows them.
    localStorage.setItem('odyssey-flight-' + Rs, JSON.stringify({
      position: (Xa?.position || te).toArray(), relative: Gt ? Vp((Xa?.position || te).toArray(), Gt) : null,
      yaw: Vt, pitch: ga, hold: Be?.body.id,
    }));
    xe.save();
    return true;
  },
});
document.addEventListener('visibilitychange', () => queueMicrotask(spherexApplyActivity));
`;
  await writeFile(runtime, source);
  console.log('Applied the portal lifecycle bridge to SOJOURNER.');
}
