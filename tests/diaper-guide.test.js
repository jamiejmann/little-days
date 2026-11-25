// Age-to-range tests for the typical diaper guide. Run: node --test tests/
// The table lives inline in index.html between DIAPER_GUIDE_START and DIAPER_GUIDE_END; this loads that block in a sandbox.
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\* DIAPER_GUIDE_START[\s\S]*?\*\/([\s\S]*?)\/\* DIAPER_GUIDE_END \*\//);
assert.ok(m, 'guide block found in index.html');
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[1] + '\nthis.diaperGuide=diaperGuide;this.DIAPER_GUIDE=DIAPER_GUIDE;', ctx);
const g = ctx.diaperGuide;
// goalTargets is defined right after the block and uses it
const gt = html.match(/function goalTargets\(n\)\{[\s\S]*?\n\}/)[0]; vm.runInContext(gt + '\nthis.goalTargets=goalTargets;', ctx);

test('day 1 and day 2: 1-2 wet, 1-2 dirty', () => { for (const d of [1, 2]) { const r = g(d); assert.equal(r.wet, '1–2'); assert.equal(r.dirty, '1–2'); } });
test('days 3 and 4: 3-5 wet, 2-3 dirty', () => { for (const d of [3, 4]) { const r = g(d); assert.equal(r.wet, '3–5'); assert.equal(r.dirty, '2–3'); } });
test('day 4 line reads exactly as specced', () => { assert.equal(g(4).text, 'Typical at day 4: 3–5 wet, 2–3 dirty'); });
test('day 5: 5-6 wet, 2-4 dirty (reconciled with AAP/NHS/LLL)', () => { const r = g(5); assert.equal(r.wet, '5–6'); assert.equal(r.dirty, '2–4'); });
test('day 6 through day 42: 6-8 wet, 2-5 dirty', () => { for (const d of [6, 7, 14, 15, 30, 42]) { const r = g(d); assert.equal(r.wet, '6–8', 'day ' + d); assert.equal(r.dirty, '2–5', 'day ' + d); } });
test('day 43 (6 weeks, the demo age) and later: 6+ wet, dirty varies', () => { for (const d of [43, 60, 120, 182]) { const r = g(d); assert.equal(r.wet, '6+'); assert.equal(r.dirty, null); assert.equal(r.dirtyMin, null); } });
test('day 43 line text', () => { assert.equal(g(43).text, 'Typical at day 43: 6+ wet, dirty varies'); });
test('nothing after about 6 months (solids change the pattern)', () => { assert.equal(g(183), null); assert.equal(g(400), null); });
test('no range without a usable day', () => { for (const d of [0, -1, null, undefined, NaN, 2.5, '4']) assert.equal(g(d), null); });
test('every day 1-182 maps to exactly one band, bands are contiguous', () => {
  const B = ctx.DIAPER_GUIDE; assert.equal(B[0].from, 1);
  for (let i = 1; i < B.length; i++) assert.equal(B[i].from, B[i - 1].to + 1);
  for (let d = 1; d <= 182; d++) assert.equal(B.filter(b => d >= b.from && d <= b.to).length, 1, 'day ' + d);
});
test('ranges never go down from one band to the next for wet diapers', () => { let prev = 0; for (const b of ctx.DIAPER_GUIDE) { assert.ok(b.wet[0] >= prev); prev = b.wet[0]; } });
test('min is never above max', () => { for (const b of ctx.DIAPER_GUIDE) for (const k of ['wet', 'dirty']) if (b[k] && b[k][1]) assert.ok(b[k][0] <= b[k][1]); });
test('wording stays neutral: no alarm or diagnosis words in the guide text', () => {
  const bad = /dehydrat|warning|danger|alert|abnormal|too (few|low|many)|not enough|urgent|diagnos|emergency/i;
  for (let d = 1; d <= 182; d++) assert.doesNotMatch(g(d).text, bad);
  const sheet = html.slice(html.indexOf('function openDiaperGuideInfo'), html.indexOf('function renderToday'));
  assert.doesNotMatch(sheet, bad); assert.match(sheet, /call your pediatrician/); assert.match(sheet, /Every baby is different/);
  assert.doesNotMatch(html, /Zoaks/i);
});
test("Today's goals use the same wet and dirty ranges", () => {
  for (const d of [1, 2, 3, 4, 5, 6, 30, 42]) { const t = ctx.goalTargets(d), r = g(d);
    assert.equal(t.wet.min, r.wetMin); assert.equal(t.wet.max, r.wetMax || undefined); assert.equal(t.stool.min, r.dirtyMin); assert.equal(t.stool.max, r.dirtyMax); }
  const t43 = ctx.goalTargets(43); assert.equal(t43.wet.min, 6); assert.equal(t43.wet.plus, 1); assert.equal(t43.stool.varies, 1);
  assert.equal(ctx.goalTargets(57), null);
});
test('feeds goals unchanged', () => { assert.deepEqual({ ...ctx.goalTargets(1).feeds }, { min: 6, plus: 1 }); assert.deepEqual({ ...ctx.goalTargets(3).feeds }, { min: 10, max: 12 }); assert.deepEqual({ ...ctx.goalTargets(20).feeds }, { min: 8, plus: 1 }); });
