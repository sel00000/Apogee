import assert from 'node:assert/strict';
import { chromium } from '../../../apps/analysis/node_modules/@playwright/test/index.mjs';
const base = process.env.QA_PORTAL_URL || 'http://127.0.0.1:4175/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const deadline=setTimeout(()=>{void browser.close({reason:'Bounded embedded QA finished'});},90000);
try {
  const version = browser.version();
  const context = await browser.newContext({ viewport: {width: 1400, height: 950}, userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36` });
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.__experienceMessages=[]; window.addEventListener('message', event => { if(event.data?.type?.startsWith('spherex-experience')) window.__experienceMessages.push(event.data); }); });
  await page.goto(base+'#experience', { waitUntil: 'domcontentloaded' });
  await page.locator('.sg-skip').click({ timeout: 15000 }).catch(() => {});
  const frameElement=page.locator('iframe.experience-frame');
  await frameElement.waitFor({timeout:30000});
  const frame=await (await frameElement.elementHandle()).contentFrame();
  for (let i=0;i<8;i++) {
    await page.waitForTimeout(5000);
    const parent=await page.evaluate(()=>({hidden:document.hidden,dialogs:[...document.querySelectorAll('dialog[open]')].map(x=>x.id),messages:window.__experienceMessages.slice(-5)}));
    const child=await frame.evaluate(()=>({url:location.href,hidden:document.hidden,paused:globalThis.__spherexExperiencePaused,loading:document.getElementById('loading')?.className,story:document.body.dataset.story,buttons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length).map(x=>({id:x.id,text:x.textContent?.slice(0,90),label:x.getAttribute('aria-label')})).slice(-18),body:document.body.innerText.slice(-1800)}));
    console.log(JSON.stringify({step:i,parent,child,errors}));
    const wake=frame.getByRole('button',{name:/wake: start/i});
    if(await wake.count()) {
      await wake.click({timeout:5000});
      console.log('Clicked embedded wake gate');
      await page.waitForTimeout(4000);
    }
    const skip=frame.getByRole('button',{name:/skip opening/i});
    if(await skip.count() && await skip.isVisible()) {
      await skip.click({timeout:5000});
      console.log('Clicked embedded skip opening');
      await page.waitForTimeout(2000);
      console.log(JSON.stringify({afterSkip:await frame.evaluate(()=>({paused:globalThis.__spherexExperiencePaused,story:document.body.dataset.story,text:document.body.innerText.slice(-1500)}))}));
      await page.evaluate(()=>window.__spherexApp.setTutorialActive(true));
      await frame.waitForFunction(()=>globalThis.__spherexExperiencePaused===true);
      await page.evaluate(()=>window.__spherexApp.setTutorialActive(false));
      await frame.waitForFunction(()=>globalThis.__spherexExperiencePaused===false);
      console.log('Verified portal pause/resume');
      await frame.locator('#spherex-experience-info').click();
      await frame.waitForFunction(()=>document.getElementById('spherex-experience-info-dialog').open&&globalThis.__spherexExperiencePaused===true);
      await frame.getByRole('button',{name:'탐험으로 돌아가기'}).click();
      await frame.waitForFunction(()=>globalThis.__spherexExperiencePaused===false);
      console.log('Verified embedded Korean help pause/resume');
      await page.evaluate(()=>window.__spherexApp.navigate('home'));
      await page.waitForFunction(()=>!document.querySelector('iframe.experience-frame'));
      const exit=await page.evaluate(()=>window.__experienceMessages.findLast(x=>x.type==='spherex-experience-exit-ready'));
      assert.equal(exit?.saved,true);
      console.log(JSON.stringify({exit}));
      await page.evaluate(()=>window.__spherexApp.navigate('experience'));
      await page.locator('iframe.experience-frame').waitFor();
      const reopened=await (await page.locator('iframe.experience-frame').elementHandle()).contentFrame();
      await reopened.waitForFunction(()=>document.getElementById('loading').classList.contains('done'),{},{timeout:30000});
      const restored=await reopened.evaluate(()=>({story:document.body.dataset.story,paused:globalThis.__spherexExperiencePaused,savedFlights:Object.keys(localStorage).filter(x=>x.startsWith('odyssey-flight-')).length}));
      assert.equal(restored.paused,false);
      assert.ok(restored.savedFlights>0);
      console.log(JSON.stringify({restored,errors}));
      break;
    }
  }
  await context.close();
} finally { clearTimeout(deadline); await browser.close(); }
