// Unit tests for supplement tracking. Run from the repo root: node --test
// The helpers live inline in index.html between SUPP-LIB-START and SUPP-LIB-END; this file evaluates that block on its own.
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = html.slice(html.indexOf('/* SUPP-LIB-START'), html.indexOf('/* SUPP-LIB-END */'));
const L = new Function(block + '\nreturn {SUPP_RX,suppKey,isSuppName,isSuppEntry,suppEntries,activeSupps,loggedSupps,lastGiven,suppDefaults,suppAdherence,adherenceText,suppHowText,suppFromVoice};')();

const H = 36e5, DAY = 864e5;
const NOW = new Date(2026, 10, 25, 14, 0).getTime(); // Wed Nov 25 2026, 2:00 PM local
const midnight = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
const birthDay = (h, m) => (t) => { const d = new Date(t); d.setHours(h, m, 0, 0); if (d.getTime() > +t) d.setDate(d.getDate() - 1); return d; };
const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const day0 = midnight(NOW).getTime();
const med = (name, t, extra) => ({ id: Math.random().toString(36).slice(2), type: 'medicine', start: t, end: t, details: Object.assign({ name }, extra), by: 'u1' });
const daily = (name, days, skip = [], hour = 9, extra) => { const out = []; for (let d = 0; d < days; d++) if (!skip.includes(d)) out.push(med(name, day0 - d * DAY + hour * H, extra)); return out; };
const adh = (entries, name, days, dayStart = midnight) => L.suppAdherence(entries, name, { now: NOW, days, dayStart, shift });

test('supplement names: vitamin D, iron, probiotic, fortifier are supplements; Tylenol is not', () => {
  for (const n of ['Vitamin D', 'vitamin d drops', 'Iron', 'Probiotic', 'Probiotics', 'Human milk fortifier', 'Multivitamin', 'DHA']) assert.equal(L.isSuppName(n), true, n);
  for (const n of ['Tylenol', 'Motrin', 'Gas drops', 'Amoxicillin', '', null, 'Ironside']) assert.equal(L.isSuppName(n), false, String(n));
});
test('a custom saved name counts as a supplement (case and spaces ignored)', () => {
  assert.equal(L.isSuppName('Elderberry', ['elderberry']), true);
  assert.equal(L.isSuppName('  BioGaia   drops', ['biogaia drops']), true);
});
test('entries: supp flag wins, supp:false opts out, other types never count', () => {
  assert.equal(L.isSuppEntry(med('Tylenol', 1, { supp: true })), true);
  assert.equal(L.isSuppEntry(med('Vitamin D', 1, { supp: false })), false);
  assert.equal(L.isSuppEntry(med('Vitamin D', 1)), true); // old Vitamin D logs from the Medicine button still count
  assert.equal(L.isSuppEntry({ type: 'feed', start: 1, details: { name: 'Iron' } }), false);
  assert.equal(L.isSuppEntry(null), false);
});
test('active list: saved first, then logged in the last 14 days, minus hidden', () => {
  const e = [med('Iron', NOW - 2 * DAY), med('Vitamin D', NOW - 3 * DAY), med('Probiotic', NOW - 20 * DAY), med('Tylenol', NOW - H)];
  assert.deepEqual(L.activeSupps(e, { now: NOW, saved: ['Fortifier'] }), ['Fortifier', 'Vitamin D', 'Iron']);
  assert.deepEqual(L.activeSupps(e, { now: NOW, saved: [], hidden: ['iron'] }), ['Vitamin D']);
  assert.deepEqual(L.activeSupps([], { now: NOW }), []);
});
test('active list de-duplicates names that differ only in case', () => {
  assert.deepEqual(L.activeSupps([med('vitamin D', NOW - DAY), med('Vitamin D', NOW - H)], { now: NOW, saved: ['VITAMIN D'] }), ['VITAMIN D']);
});
test('lastGiven finds the newest dose inside a day window', () => {
  const e = [med('Iron', day0 + 8 * H), med('Iron', day0 + 11 * H), med('Iron', day0 - 2 * H)];
  assert.equal(L.lastGiven(e, 'iron', day0, day0 + DAY).start, day0 + 11 * H);
  assert.equal(L.lastGiven(e, 'Vitamin D', day0, day0 + DAY), null);
});
test('one-tap defaults copy how, milk and dose from the last log, and never invent a dose', () => {
  const e = [med('Iron', NOW - 2 * DAY, { supp: true, how: 'dropper' }), med('Iron', NOW - DAY, { supp: true, how: 'bottle', milk: 'Formula', dose: '1 mL', feed: 'f1' })];
  assert.deepEqual(L.suppDefaults(e, 'iron'), { name: 'Iron', supp: true, dose: '1 mL', how: 'bottle', milk: 'Formula' }); // no feed link copied
  assert.deepEqual(L.suppDefaults([], 'Probiotic'), { name: 'Probiotic', supp: true });
});
test('adherence: 26 of 30 days → "Vitamin D: given 26 of 30 days (87%)"', () => {
  const e = daily('Vitamin D', 40, [3, 8, 15, 22]);
  const a = adh(e, 'Vitamin D', 30);
  assert.equal(a.given, 26); assert.equal(a.total, 30); assert.equal(a.pct, 87); assert.equal(a.partial, false);
  assert.equal(L.adherenceText('Vitamin D', a), 'Vitamin D: given 26 of 30 days (87%)');
});
test('adherence: 7-day window', () => {
  const a = adh(daily('Iron', 30, [2]), 'Iron', 7);
  assert.equal(L.adherenceText('Iron', a), 'Iron: given 6 of 7 days (86%)');
});
test('adherence: today not given yet does not count as missed (range ends yesterday)', () => {
  const e = daily('Iron', 30, [0]); // every day except today
  const a = adh(e, 'Iron', 7); assert.equal(a.given, 7); assert.equal(a.total, 7);
});
test('adherence: today given counts today', () => {
  const e = daily('Iron', 7, [6]); // today..5 days ago; not 6 days ago
  const a = adh(e, 'Iron', 7); assert.equal(a.total, 6); assert.equal(a.given, 6); // started 5 days ago → only 6 days count
});
test('adherence: shorter than the range when it started recently, with the start day', () => {
  const e = daily('Probiotic', 10, [0, 4]).filter((x) => x.start >= day0 - 9 * DAY);
  const a = adh(e, 'Probiotic', 30);
  assert.equal(a.total, 9); assert.equal(a.given, 8); assert.equal(a.partial, true); assert.equal(a.since, day0 - 9 * DAY);
  assert.equal(L.adherenceText('Probiotic', a), 'Probiotic: given 8 of 9 days (89%)');
});
test('adherence: first dose today → 1 of 1 day', () => {
  const a = adh([med('Iron', day0 + 10 * H)], 'Iron', 30);
  assert.equal(L.adherenceText('Iron', a), 'Iron: given 1 of 1 day (100%)');
});
test('adherence: two doses in one day still count as one day', () => {
  const e = daily('Vitamin D', 7).concat([med('Vitamin D', day0 - 2 * DAY + 20 * H)]);
  assert.equal(adh(e, 'Vitamin D', 7).given, 7);
});
test('adherence: no logs → null and empty text', () => {
  assert.equal(adh([], 'Iron', 7), null); assert.equal(L.adherenceText('Iron', null), '');
});
test('adherence uses birth-time days, not midnight', () => {
  // birth time 3:12 PM. Doses at 4 PM yesterday and 10 AM today fall in the SAME birth-time day (yesterday 3:12 PM – today 3:12 PM).
  const bd = birthDay(15, 12);
  const e = [med('Iron', day0 - DAY + 16 * H), med('Iron', day0 + 10 * H)];
  const byMidnight = adh(e, 'Iron', 7), byBirth = adh(e, 'Iron', 7, bd);
  assert.equal(byMidnight.given, 2); assert.equal(byMidnight.total, 2);
  assert.equal(byBirth.given, 1); assert.equal(byBirth.total, 1);
});
test('adherence ignores future-dated entries', () => {
  const e = daily('Iron', 7).concat([med('Iron', NOW + 3 * DAY)]);
  assert.equal(adh(e, 'Iron', 7).total, 7);
});
test('loggedSupps lists every supplement logged in the range, oldest first, not medicine', () => {
  const e = [med('Iron', NOW - 3 * DAY), med('Tylenol', NOW - 2 * DAY), med('Vitamin D', NOW - 10 * DAY), med('Probiotic', NOW - 40 * DAY)];
  assert.deepEqual(L.loggedSupps(e, NOW - 31 * DAY, NOW), ['Vitamin D', 'Iron']);
});
test('how-it-was-given wording', () => {
  assert.equal(L.suppHowText({ how: 'bottle', milk: 'Formula' }), 'added to formula');
  assert.equal(L.suppHowText({ how: 'bottle', milk: 'Breast milk' }), 'added to pumped milk');
  assert.equal(L.suppHowText({ how: 'bottle' }), 'added to a bottle');
  assert.equal(L.suppHowText({ how: 'dropper' }), 'by dropper');
  assert.equal(L.suppHowText({}), '');
});
test('voice: "gave iron" and "vitamin D" map to supplement entries', () => {
  const r1 = L.suppFromVoice({ kind: 'medicine', name: 'Iron', dose: '', at: null }, 'gave iron');
  assert.deepEqual(r1, { type: 'medicine', start: null, details: { name: 'Iron', supp: true } });
  const r2 = L.suppFromVoice({ kind: 'medicine', name: 'Vitamin D', dose: '1 drop', at: 123 }, 'vitamin D one drop');
  assert.equal(r2.details.name, 'Vitamin D'); assert.equal(r2.details.dose, '1 drop'); assert.equal(r2.start, 123);
});
test('voice: "in her bottle" / "in formula" / "in breast milk" → added to a bottle', () => {
  assert.deepEqual(L.suppFromVoice({ kind: 'medicine', name: 'Iron' }, 'put iron in her bottle').details, { name: 'Iron', supp: true, how: 'bottle' });
  assert.equal(L.suppFromVoice({ kind: 'medicine', name: 'Iron' }, 'iron in the formula').details.milk, 'Formula');
  assert.equal(L.suppFromVoice({ kind: 'medicine', name: 'Probiotic' }, 'probiotic in breast milk').details.milk, 'Breast milk');
  assert.equal(L.suppFromVoice({ kind: 'medicine', name: 'Vitamin D' }, 'vitamin d with the dropper').details.how, 'dropper');
});
test('voice: plain medicine and non-medicine results are left alone', () => {
  assert.equal(L.suppFromVoice({ kind: 'medicine', name: 'Tylenol' }, 'gave tylenol'), null);
  assert.equal(L.suppFromVoice({ kind: 'diaper', subtype: 'pee' }, 'wet diaper'), null);
  assert.equal(L.suppFromVoice({ kind: 'medicine', name: 'Elderberry' }, 'elderberry', ['Elderberry']).details.supp, true);
});
test('voice parser on the voice-mic branch: "gave iron" / "vitamin D" are medicine results the mapper accepts', { skip: !fs.existsSync(path.join(__dirname, '..', 'voice.js')) && 'voice.js not on this branch yet (voice-mic)' }, () => {
  const { parseVoice } = require('../voice.js');
  for (const [t, n] of [['gave iron', 'Iron'], ['vitamin D', 'Vitamin D'], ['gave her iron in the bottle', 'Iron'], ['probiotic', 'Probiotic']]) {
    const r = parseVoice(t, NOW); assert.equal(r.kind, 'medicine', t); assert.equal(r.name, n, t);
    assert.equal(L.suppFromVoice(r, t).details.supp, true, t);
  }
});
test('no dose is ever suggested: the helpers only copy what the family typed', () => {
  assert.doesNotMatch(block, /\b\d+(\.\d+)?\s?(mg|ml|mL|IU|drops?)\b/); // no hard-coded amounts in the supplement code
});
