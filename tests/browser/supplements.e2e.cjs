// Browser check for supplements in demo mode (no account, no network to Supabase).
// Serve the repo root (python3 -m http.server 18502) and run: APP_URL=http://127.0.0.1:18502/index.html node tests/browser/supplements.e2e.cjs
// Needs playwright (PLAYWRIGHT=/path/to/node_modules/playwright if it isn't resolvable).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.APP_URL || 'http://127.0.0.1:18502/index.html';
let fails = 0, passes = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? passes++ : fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'], ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) }); const errs = [], remote = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  p.on('request', (r) => { if (/supabase\.co/.test(r.url())) remote.push(r.method() + ' ' + r.url()); });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.click('#tryDemo'); await p.waitForSelector('#app:not(.hidden)');
  const D = () => p.evaluate(() => window.__littledays.data);
  const supps = () => p.$$eval('.suppChip', (a) => a.map((x) => ({ n: x.dataset.supp, done: x.classList.contains('done'), h: x.getBoundingClientRect().height, label: x.getAttribute('aria-label') })));
  const close = async () => { await p.click('#scrim', { position: { x: 20, y: 20 } }); await p.waitForTimeout(250); };

  // Today: one compact row, shared with the medicine button
  ok(await p.$eval('#suppChips', (el) => !!el.closest('.medRow') && !el.classList.contains('hidden')), 'supplement chips live inside the existing medicine row');
  ok(await p.$$eval('#v-today .medRow', (a) => a.length) === 1, 'still exactly one medicine row on Today');
  let s = await supps(); ok(s.map((x) => x.n).join() === 'Vitamin D,Iron,Probiotic', 'demo shows Vitamin D, Iron, Probiotic: ' + s.map((x) => x.n + (x.done ? '✓' : '')).join(', '));
  ok(s.find((x) => x.n === 'Vitamin D').done, 'Vitamin D shows as given today');
  ok(!s.find((x) => x.n === 'Probiotic').done, 'Probiotic shows as not yet today');
  ok(s.every((x) => x.h >= 44), 'every chip is at least 44px tall: ' + s.map((x) => Math.round(x.h)).join(','));
  ok(await p.$eval('#addMed', (x) => x.getBoundingClientRect().height >= 44 && x.getBoundingClientRect().width >= 44 && !!x.getAttribute('aria-label')), 'medicine button is 44px+ and has a VoiceOver label');
  ok(s.every((x) => x.label && (/given today at .+ by /.test(x.label) || /not yet today/.test(x.label))), 'chips have VoiceOver labels with status, time and who');
  ok(await p.$eval('#lastMed', (x) => x.classList.contains('hidden')), 'the "Last: Vitamin D · Again" pill gives its place to the chips');

  // one tap logs a not-yet supplement, as the current caregiver, with Undo
  const before = (await D()).entries.length;
  await p.click('.suppChip[data-supp="Probiotic"]'); await p.waitForTimeout(300);
  let d = await D(); const ne = d.entries[d.entries.length - 1];
  ok(d.entries.length === before + 1 && ne.type === 'medicine' && ne.details.supp === true && ne.details.name === 'Probiotic', 'one tap logs Probiotic as a supplement entry');
  ok(ne.by === d.me, 'logged by the current caregiver (' + ne.by + ')');
  ok(!ne.details.dose, 'one tap adds no dose the family never typed');
  ok((await supps()).find((x) => x.n === 'Probiotic').done, 'Probiotic chip turns to given');
  await p.click('#undoBtn'); await p.waitForTimeout(300);
  ok((await D()).entries.length === before && !(await supps()).find((x) => x.n === 'Probiotic').done, 'Undo removes it');

  // tapping a given chip opens details instead of double-logging
  await p.click('.suppChip[data-supp="Vitamin D"]'); await p.waitForSelector('#sdLog:visible');
  ok((await D()).entries.length === before, 'tapping a given chip does not log again');
  const sheet = await p.textContent('#sheet');
  ok(/Given at .+ by Mom/.test(sheet), 'details show time and who gave it');
  ok(/Last 7 days: given \d+ of \d+ days \(\d+%\)/.test(sheet) && /Last 30 days: given 28 of 30 days \(93%\)/.test(sheet), 'details show days given (7 and 30 days)');
  ok(/pediatrician directs/.test(sheet) && /doesn’t suggest doses/.test(sheet), 'neutral pediatrician note in details');
  await close();

  // press and hold opens details for a not-yet chip
  const chip = p.locator('.suppChip[data-supp="Probiotic"]'); await chip.scrollIntoViewIfNeeded(); const bb = await chip.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(200);
  ok(/Probiotic/.test(await p.textContent('#sheet h2')) && /Not yet today/.test(await p.textContent('#sheet')) && await p.isVisible('#sdLog'), 'press and hold opens details');
  ok((await D()).entries.length === before, 'press and hold does not log');
  ok(/given 6 of 7 days \(86%\)/.test(await p.textContent('#sheet')) && /given 8 of 9 days \(89%\) · since/.test(await p.textContent('#sheet')), 'started 9 days ago: "given 8 of 9 days (89%)" with the start date');

  // More options: added to a bottle, linked to a feed
  await p.click('#sdMore'); await p.waitForSelector('#mSave:visible');
  ok(await p.$eval('#mSupp', (x) => x.checked), 'supplement switch is on');
  ok(!(await p.isVisible('#mBottle')), 'bottle options stay hidden until "Added to a bottle" is picked');
  await p.click('[data-mh=bottle]'); await p.click('[data-mk=Formula]');
  const feedBtn = await p.$('[data-mf]');
  let linkId = null; if (feedBtn) { linkId = await feedBtn.getAttribute('data-mf'); await feedBtn.click(); }
  else { // no bottle in the last 6 hours in today's random demo: add one and reopen
    await close(); await p.evaluate(() => { const D = window.__littledays.data; D.entries.push({ id: 'bt-test', type: 'feed', subtype: 'bottle', start: Date.now() - 20 * 6e4, end: Date.now() - 20 * 6e4, amount: 3, unit: 'oz', details: { milk: 'Formula' }, by: D.me }); });
    await p.click('#addMed'); await p.fill('#mName', 'Probiotic'); await p.dispatchEvent('#mName', 'input'); await p.click('[data-mh=bottle]'); await p.click('[data-mk=Formula]'); linkId = 'bt-test'; await p.click('[data-mf="bt-test"]'); }
  ok(/pediatrician directed/.test(await p.getAttribute('#mDose', 'placeholder')), 'dose stays free text, pointing to the pediatrician');
  await p.click('#mSave'); await p.waitForTimeout(300);
  d = await D(); const be = d.entries[d.entries.length - 1];
  ok(be.details.how === 'bottle' && be.details.milk === 'Formula' && be.details.feed === linkId && be.details.supp === true, 'saved as added to formula and linked to the bottle');
  const fe = await p.evaluate((id) => { const li = [...document.querySelectorAll('#timeline li')].map((x) => x.textContent); return li.find((t) => /Bottle/.test(t) && /with Probiotic/.test(t)) || ''; }, linkId);
  ok(!!fe, 'the linked bottle in the timeline says "with Probiotic"');

  // edit: how it was given
  await p.evaluate((id) => { window.__lastId = id; }, be.id);
  // Remove from Today, then bring back by logging
  await p.click('.suppChip[data-supp="Probiotic"]'); await p.waitForSelector('#sdHide:visible'); await p.click('#sdHide'); await p.waitForTimeout(300);
  ok(!(await supps()).some((x) => x.n === 'Probiotic'), 'Remove from Today hides it on this phone');
  await p.click('#addMed'); await p.click('[data-mn="Vitamin D"]'); await p.fill('#mName', 'Probiotic'); await p.dispatchEvent('#mName', 'input'); await p.click('#mSave'); await p.waitForTimeout(300);
  ok((await supps()).some((x) => x.n === 'Probiotic'), 'logging it as a supplement brings it back');

  // custom supplement, then plain medicine
  await p.click('#addMed'); await p.fill('#mName', 'Elderberry'); await p.dispatchEvent('#mName', 'input');
  ok(!(await p.$eval('#mSupp', (x) => x.checked)), 'an unknown name starts as medicine');
  await p.check('#mSupp'); await p.click('#mSave'); await p.waitForTimeout(300);
  ok((await supps()).some((x) => x.n === 'Elderberry'), 'custom supplement saved and shown on Today');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('littledays.supps')).demo.saved.includes('Elderberry')), 'saved list is remembered on this device');
  await p.click('#addMed'); await p.fill('#mName', 'Tylenol'); await p.dispatchEvent('#mName', 'input');
  ok(!(await p.$eval('#mSupp', (x) => x.checked)) && !(await p.isVisible('#mSuppBox')), 'Tylenol is medicine: no supplement options shown');
  await p.click('#mSave'); await p.waitForTimeout(300);
  ok(!(await supps()).some((x) => x.n === 'Tylenol') && !(await p.$eval('#lastMed', (x) => x.classList.contains('hidden'))), 'Tylenol is not a chip; the "Last … Again" pill shows for it');

  // edit sheet: how it was given
  const vid = await p.evaluate(() => window.__littledays.data.entries.filter((e) => e.type === 'medicine' && e.details.name === 'Vitamin D').sort((a, b) => b.start - a.start)[0].id);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.click('.suppChip[data-supp="Vitamin D"]'); await p.waitForSelector('#sdEdit:visible'); await p.click('#sdEdit'); await p.waitForSelector('#eMHow');
  await p.selectOption('#eMHow', 'bottle:Breast milk'); await p.click('#eSave'); await p.waitForTimeout(300);
  const ve = (await D()).entries.find((e) => e.id === vid);
  ok(ve.details.how === 'bottle' && ve.details.milk === 'Breast milk', 'edit changes how it was given');

  // Pediatrician summary and text export
  await p.click('nav button[data-v=reports]'); await p.waitForTimeout(300); await p.click('#docBtn'); await p.waitForSelector('#docView.on');
  const doc = await p.textContent('#docSupp');
  ok(/Vitamin D/.test(doc) && /Last 30 days: given 28 of 30 days \(93%\)/.test(doc) && /Iron/.test(doc), 'pediatrician summary has days given per supplement');
  ok(!/(poor|good|great|bad|missed|compliance|non-?compliant|grade)/i.test(doc), 'summary wording is neutral (no grades or judgment)');
  ok(await p.$eval('#docSupp', (el) => !el.querySelector('[style*="red"],[style*="#F00"],.flag')), 'no warning colors on the supplement section');
  ok(await p.$eval('#docSupp', (el) => [el, ...el.querySelectorAll('*')].every((x) => x.getBoundingClientRect().right <= 391)), 'supplement section fits 390px (the older day-by-day table overflows by ~23px; not part of this change)');
  const txt = await p.evaluate(() => window.__littledays.docText());
  ok(/SUPPLEMENTS, LAST 30 DAYS/.test(txt) && /\nVitamin D: given 28 of 30 days \(93%\)/.test(txt), 'text export uses "Vitamin D: given 28 of 30 days (93%)"');
  ok(!/Vitamin D/.test((txt.split('MEDICINE (last 7 days)')[1] || '').split('\n\n')[0]), 'medicine list in the export no longer repeats daily supplements');
  await p.click('#docClose'); await p.click('nav button[data-v=today]');

  // Larger Text (24px root): no sideways scroll; chips still 44px+
  await p.evaluate(() => { document.documentElement.style.fontSize = '24px'; }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 391), 'no sideways page scroll at 24px text');
  ok((await supps()).every((x) => x.h >= 44), 'chips still 44px+ at 24px text');
  await p.evaluate(() => { document.documentElement.style.fontSize = ''; });

  // demo regeneration keeps supplements recent
  const fresh = await p.evaluate(() => { const L = window.__littledays; const people = L.data.people; const e = L.sampleEntries(people, Date.now()); return { n: e.filter((x) => x.type === 'medicine' && x.details.supp).length, names: [...new Set(e.filter((x) => x.details && x.details.supp).map((x) => x.details.name))].join(), doses: e.filter((x) => x.details && x.details.supp && x.details.dose && x.details.name !== 'Vitamin D').length }; });
  ok(fresh.names === 'Vitamin D,Iron,Probiotic' && fresh.n > 50, 'fresh demo data has Vitamin D, Iron and Probiotic (' + fresh.n + ' entries)');
  ok(fresh.doses === 0, 'new demo supplements carry no dose (Vitamin D keeps the sample family\'s "1 drop" from before)');

  // voice (voice-mic): a fake Web Speech API says the phrase; the confirm sheet should be a supplement entry
  const FAKE = `window.__say='';class FakeSR{start(){const t=window.__say;setTimeout(()=>{this.onresult&&this.onresult({results:[[{transcript:t}]]});setTimeout(()=>this.onend&&this.onend(),150)},200)}stop(){setTimeout(()=>this.onend&&this.onend(),50)}abort(){this.onend&&this.onend()}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;`;
  const vc = await b.newContext({ viewport: { width: 390, height: 844 } }); await vc.addInitScript(FAKE); const vp = await vc.newPage(); vp.on('pageerror', (e) => errs.push('voice: ' + e.message));
  await vp.goto(URL); await vp.evaluate(() => localStorage.clear()); await vp.reload(); await vp.click('#tryDemo'); await vp.waitForSelector('#app:not(.hidden)'); await vp.waitForTimeout(400);
  const hasMic = await vp.$('#micBtn');
  if (!hasMic || !(await vp.isVisible('#micBtn'))) console.log('SKIP voice checks (no mic button on this branch)');
  else {
    const say = async (t) => { await vp.evaluate((t) => { window.__say = t; }, t); await vp.click('#micBtn'); await vp.waitForSelector('#vSave:visible', { timeout: 8000 }); };
    const lastE = () => vp.evaluate(() => { const e = window.__littledays.data.entries; return e[e.length - 1]; });
    await say('gave iron in her bottle');
    ok(/Supplement/.test(await vp.textContent('#sheet h2')) && await vp.inputValue('#vMName') === 'Iron', 'voice: "gave iron in her bottle" opens a supplement confirm for Iron');
    ok(await vp.$eval('[data-vhow="bottle"]', (x) => x.classList.contains('on')), 'voice: "in her bottle" picks Added to a bottle');
    await vp.click('#vSave'); await vp.waitForTimeout(300); let le = await lastE();
    ok(le.type === 'medicine' && le.details.supp === true && le.details.how === 'bottle' && le.details.name === 'Iron', 'voice: saved as an Iron supplement added to a bottle');
    await say('vitamin D');
    ok(/Supplement/.test(await vp.textContent('#sheet h2')) && await vp.$eval('[data-vhow="dropper"]', (x) => x.classList.contains('on')), 'voice: "vitamin D" is a supplement, by dropper like the last log');
    await vp.click('#vSave'); await vp.waitForTimeout(300); le = await lastE();
    ok(le.details.supp === true && le.details.name === 'Vitamin D', 'voice: Vitamin D saved as a supplement');
    await say('gave tylenol');
    ok(/Medicine/.test(await vp.textContent('#sheet h2')) && !(await vp.$('[data-vhow]')), 'voice: Tylenol stays a plain medicine');
  }
  await vc.close();

  ok(remote.length === 0, 'demo made no requests to Supabase' + (remote.length ? ': ' + remote[0] : ''));
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(`\n${passes} passed, ${fails} failed`); await b.close(); process.exit(fails ? 1 : 0);
})();
