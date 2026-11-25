// Parser tests for voice logging. Run from the repo root: node --test tests/*.test.js
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseVoice } = require('../voice.js');
const NOW = new Date(2026, 10, 25, 14, 0).getTime(); // Wed Nov 25 2026, 2:00 PM local
const at = (h, m = 0, dayOffset = 0) => new Date(2026, 10, 25 + dayOffset, h, m).getTime();
const MIN = 60000;
const p = (t, o) => parseVoice(t, NOW, o);

test('bottle: ounces with a clock time', () => { const r = p('4 ounces at 2pm'); assert.equal(r.kind, 'bottle'); assert.equal(r.amount, 4); assert.equal(r.unit, 'oz'); assert.equal(r.at, at(14)); });
test('bottle: ml, formula, minutes ago', () => { const r = p('Fed 120 ml formula 20 minutes ago'); assert.equal(r.kind, 'bottle'); assert.equal(r.amount, 120); assert.equal(r.unit, 'ml'); assert.equal(r.milk, 'Formula'); assert.equal(r.at, NOW - 20 * MIN); });
test('bottle: number words and a half', () => { const r = p('bottle of four and a half ounces'); assert.equal(r.amount, 4.5); assert.equal(r.at, null); });
test('bottle: "oz." and breast milk', () => { const r = p('3.5 oz. of breast milk'); assert.equal(r.amount, 3.5); assert.equal(r.milk, 'Breast milk'); });
test('bottle: one hundred twenty milliliters', () => { const r = p('one hundred twenty milliliters'); assert.equal(r.kind, 'bottle'); assert.equal(r.amount, 120); assert.equal(r.unit, 'ml'); });
test('bottle: "for ounces" heard instead of four', () => { assert.equal(p('fed for ounces').amount, 4); });
test('bottle with no amount still a bottle', () => { const r = p('gave a bottle of formula'); assert.equal(r.kind, 'bottle'); assert.equal(r.amount, null); });
test('future clock time means yesterday', () => { assert.equal(p('4 oz at 3pm').at, at(15, 0, -1)); });
test('clock time without am/pm picks the most recent past one', () => { assert.equal(p('2 ounces at 11').at, at(11)); assert.equal(p('2 ounces at 1:30').at, at(13, 30)); });
test('clock time spoken as words', () => { assert.equal(p('fed 3 ounces at one thirty').at, at(13, 30)); });
test('half an hour ago / an hour ago', () => { assert.equal(p('4 oz half an hour ago').at, NOW - 30 * MIN); assert.equal(p('4 oz an hour ago').at, NOW - 60 * MIN); assert.equal(p('4 oz 1 hour and 15 minutes ago').at, NOW - 75 * MIN); });
test('noon and yesterday', () => { assert.equal(p('4 oz at noon').at, at(12)); assert.equal(p('4 oz yesterday at 9pm').at, at(21, 0, -1)); });

test('breast: minutes on one side', () => { const r = p('nursed 15 minutes on the left'); assert.equal(r.kind, 'breast'); assert.equal(r.action, 'log'); assert.equal(r.left, 15); assert.equal(r.right, 0); assert.equal(r.end, NOW); assert.equal(r.at, NOW - 15 * MIN); });
test('breast: both sides with minutes', () => { const r = p('breastfed left 10 right 5'); assert.equal(r.left, 10); assert.equal(r.right, 5); assert.equal(r.lastSide, 'R'); });
test('breast: start time given', () => { const r = p('left side 12 minutes at 1:30'); assert.equal(r.at, at(13, 30)); assert.equal(r.end, at(13, 42)); });
test('breast: start a timer', () => { const r = p('starting a feed on the right'); assert.equal(r.kind, 'breast'); assert.equal(r.action, 'start'); assert.equal(r.side, 'R'); });
test('breast: "both sides 20 minutes" splits', () => { const r = p('nursed both sides 20 minutes'); assert.equal(r.left + r.right, 20); });

test('diaper: wet', () => { const r = p('wet diaper'); assert.equal(r.kind, 'diaper'); assert.equal(r.subtype, 'pee'); });
test('diaper: dirty with time', () => { const r = p('poopy diaper at 11'); assert.equal(r.subtype, 'poop'); assert.equal(r.at, at(11)); });
test('diaper: both', () => { assert.equal(p('wet and dirty diaper').subtype, 'both'); assert.equal(p('diaper both').subtype, 'both'); assert.equal(p('she peed and pooped').subtype, 'both'); });
test('diaper: "she pooped"', () => { assert.equal(p('she pooped').subtype, 'poop'); });
test('diaper: no type said', () => { const r = p('changed her diaper'); assert.equal(r.kind, 'diaper'); assert.equal(r.subtype, null); });

test('sleep: fell asleep minutes ago', () => { const r = p('fell asleep 10 minutes ago'); assert.equal(r.kind, 'sleep'); assert.equal(r.action, 'start'); assert.equal(r.at, NOW - 10 * MIN); });
test('sleep: woke up (ends the timer)', () => { const r = p('woke up'); assert.equal(r.action, 'end'); assert.equal(r.end, null); assert.equal(p('woke up at 1:45').end, at(13, 45)); });
test('sleep: nap length', () => { const r = p('napped 45 minutes'); assert.equal(r.action, 'log'); assert.equal(r.end, NOW); assert.equal(r.at, NOW - 45 * MIN); });
test('sleep: an hour and a half', () => { const r = p('she slept for an hour and a half'); assert.equal(r.minutes, 90); });
test('sleep: range', () => { const r = p('nap from 11 to 12:30'); assert.equal(r.at, at(11)); assert.equal(r.end, at(12, 30)); });
test('sleep: overnight range', () => { const r = p('slept from 11 last night to 5 this morning'); assert.equal(r.at, at(23, 0, -1)); assert.equal(r.end, at(5)); });
test('sleep: down for a nap at noon', () => { const r = p('down for a nap at noon'); assert.equal(r.action, 'start'); assert.equal(r.at, at(12)); });
test('sleep: nap length that woke up a while ago', () => { const r = p('napped 40 minutes woke up 10 minutes ago'); assert.equal(r.end, NOW - 10 * MIN); assert.equal(r.at, NOW - 50 * MIN); });

test('medicine: vitamin D', () => { const r = p('gave Vitamin D'); assert.equal(r.kind, 'medicine'); assert.equal(r.name, 'Vitamin D'); assert.equal(r.dose, ''); });
test('medicine: vitamin D one drop', () => { assert.equal(p('vitamin d one drop').dose, '1 drop'); });
test('medicine: ml is a dose, not a bottle', () => { const r = p('Tylenol 2.5 ml at 9am'); assert.equal(r.kind, 'medicine'); assert.equal(r.dose, '2.5 ml'); assert.equal(r.at, at(9)); });
test('medicine: a name the family used before', () => { const r = p('gave Zyrtec half', { meds: ['Zyrtec'] }); assert.equal(r.kind, 'medicine'); assert.equal(r.name, 'Zyrtec'); });
test('medicine: generic word with no name', () => { const r = p('gave her medicine'); assert.equal(r.kind, 'medicine'); assert.equal(r.name, ''); });

test('pump: amount', () => { const r = p('pumped 3 ounces'); assert.equal(r.kind, 'pump'); assert.equal(r.amount, 3); });
test('pump: sides and minutes', () => { const r = p('pumped 4 oz both sides 15 minutes'); assert.equal(r.side, 'both'); assert.equal(r.minutes, 15); });

test('a feed with nothing else', () => { const r = p('fed at 2'); assert.equal(r.kind, 'feed'); assert.equal(r.at, at(14)); });
test('two things at once is not guessed', () => { const r = p('fed two ounces and changed a wet diaper'); assert.equal(r.kind, null); assert.equal(r.reason, 'multiple'); });
test('nonsense is not understood', () => { assert.equal(p('hello there').kind, null); assert.equal(p('hello there').reason, 'unknown'); });
test('empty text', () => { assert.equal(p('').reason, 'empty'); assert.equal(p('   ').reason, 'empty'); });
test('never returns a future time', () => {
  for (const t of ['4 oz at 11pm', 'nap at 9', 'woke up at 8pm', 'fed at 10 tonight', 'nursed 20 minutes at 1:55']) { const r = p(t); if (r.at != null) assert.ok(r.at <= NOW + MIN, t); if (r.end != null) assert.ok(r.end <= NOW + MIN, t); }
});
test('compound number words', () => { assert.equal(p('twenty five ml bottle').amount, 25); assert.equal(p('ninety milliliters of formula').amount, 90); });
test('am/pm spoken as "p.m."', () => { assert.equal(p('wet diaper at 11 a.m.').at, at(11)); assert.equal(p('4 oz at 1:15 p.m.').at, at(13, 15)); });
