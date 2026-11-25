/* Babyway voice logging.
   1) parseVoice(text, now, opts): plain local rules that turn a short phrase into a draft entry.
      No AI, no network. The draft is always shown in a confirm sheet before anything is saved.
   2) LDVoice: speech-to-text.
      iPhone app: Apple's speech recognizer through @capgo/capacitor-speech-recognition, on-device only
      (requiresOnDeviceRecognition). If this phone can't do it on the device, voice is not offered.
      Browser/PWA: the Web Speech API when the browser has it (on-device when the browser supports that);
      otherwise the mic button stays hidden. Audio is never stored, and never sent to Babyway. */
(function (root) {
  'use strict';
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  /* ---------------- text clean-up ---------------- */
  const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  function numify(s) {
    // "four" -> 4, "twenty five" -> 25, "one hundred twenty" -> 120; "one thirty" stays "1 30" (a clock time)
    const w = s.split(' '), out = [];
    for (let i = 0; i < w.length; i++) {
      const t = w[i];
      if (!(t in UNITS) && !(t in TENS) && !(t === 'a' && w[i + 1] === 'hundred')) { out.push(t); continue; }
      let cur = 0;
      const small = () => { // one word group under 100
        if (w[i] in TENS) { let v = TENS[w[i]]; if (UNITS[w[i + 1]] > 0 && UNITS[w[i + 1]] < 10) { v += UNITS[w[i + 1]]; i++; } return v; }
        if (w[i] in UNITS) return UNITS[w[i]];
        if (w[i] === 'a') return 1;
        return null;
      };
      cur = small();
      if (w[i + 1] === 'hundred') { i += 1; cur *= 100; if (w[i + 1] === 'and' && (w[i + 2] in UNITS || w[i + 2] in TENS)) i++; if (w[i + 1] in UNITS || w[i + 1] in TENS) { i++; cur += small(); } }
      out.push(String(cur));
    }
    return out.join(' ');
  }
  function clean(text) {
    let s = ' ' + String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/½/g, ' 1/2') + ' ';
    s = s.replace(/\bp\.?\s?m\.?(?=[\s,!?]|$)/g, 'pm').replace(/\ba\.?\s?m\.?(?=[\s,!?]|$)/g, 'am');
    s = s.replace(/(\d)\s*(am|pm)\b/g, '$1 $2');
    s = s.replace(/\boz\./g, 'oz').replace(/o'clock/g, 'oclock');
    s = s.replace(/[^a-z0-9:.\/' ]+/g, ' ').replace(/(\D)\.|\.(\D)/g, '$1 $2').replace(/\.$/, '');
    s = s.replace(/\s+/g, ' ');
    s = numify(s.trim());
    s = ' ' + s + ' ';
    s = s.replace(/ (\d+) and a half /g, (m, n) => ' ' + (+n + 0.5) + ' ').replace(/ (\d+) 1\/2 /g, (m, n) => ' ' + (+n + 0.5) + ' ');
    s = s.replace(/ (an?|1) hour and a half /g, ' 1.5 hours ').replace(/ (an?|1) and a half hours? /g, ' 1.5 hours ');
    s = s.replace(/ half an? hour /g, ' 30 minutes ').replace(/ (a|an) hour /g, ' 1 hour ').replace(/ (an?|1) hour and (\d+) min(ute)?s? /g, ' 1 hour $2 minutes ');
    s = s.replace(/ a half (oz|ounces?) /g, ' 0.5 oz ').replace(/ half an? (oz|ounce) /g, ' 0.5 oz ');
    // homophones right before a unit: "for ounces", "to ounces"
    s = s.replace(/ (for) (oz|ounces?) /g, ' 4 $2 ').replace(/ (to|too) (oz|ounces?) /g, ' 2 $2 ');
    s = s.replace(/ (an?|1) (drop) /g, ' 1 drop ');
    return s.replace(/\s+/g, ' ');
  }

  /* ---------------- times ---------------- */
  // h (0-23 or 1-12), m, meridiem: returns the most recent moment at that clock time that is not in the future
  function clockToTime(h, m, mer, now, dayShift) {
    const cands = [];
    if (mer === 'am') cands.push(h === 12 ? 0 : h);
    else if (mer === 'pm') cands.push(h === 12 ? 12 : h + 12);
    else if (h > 12) cands.push(h);
    else { cands.push(h === 12 ? 0 : h); cands.push(h === 12 ? 12 : h + 12); }
    let best = null;
    for (const hh of cands) for (let back = 0; back <= 1; back++) {
      const d = new Date(now); d.setHours(hh, m, 0, 0); let t = d.getTime() - back * DAY;
      if (dayShift) t -= dayShift * DAY;
      if (t <= now + MIN && (best === null || t > best)) best = t;
    }
    return best;
  }
  const MER = '(am|pm|in the morning|this morning|in the afternoon|this afternoon|in the evening|this evening|tonight|at night|last night)';
  function merOf(word, h) {
    if (!word) return null; if (word === 'am' || /morning/.test(word)) return 'am'; if (word === 'pm' || /afternoon|evening|tonight/.test(word)) return 'pm';
    if (/night/.test(word)) return h >= 6 && h <= 11 ? 'pm' : (h === 12 ? 'am' : 'am');
    return null;
  }
  const CLOCK = '(\\d{1,2})(?::(\\d{2})| (\\d{2})(?= |$))?(?: oclock)?(?: ' + MER + ')?';
  function readClock(mt, now, shift) {
    const h = +mt[1], m = +(mt[2] || mt[3] || 0), mw = mt[4];
    if (h > 23 || m > 59) return null;
    let sh = shift; if (mw === 'last night' && !shift && h >= 6 && h <= 11) sh = 0; // "11 last night" -> most recent 11 pm
    return clockToTime(h, m, merOf(mw, h), now, sh);
  }
  function takeTimes(s, now) {
    const res = { at: null, end: null, said: false, explicitNow: false };
    let shift = 0;
    if (/ yesterday /.test(s)) { shift = 1; s = s.replace(/ yesterday /g, ' '); }
    const special = (w) => (w === 'noon' ? [12, 0, 'pm'] : [0, 0, 'am']);
    // ranges: "from 1 to 2:30", "between 1 and 2"
    let mt = s.match(new RegExp(' (?:from|between) (' + CLOCK + '|noon|midnight) (?:to|till|until|and|-) (' + CLOCK + '|noon|midnight) '));
    if (mt) {
      const a = mt[1] === 'noon' || mt[1] === 'midnight' ? clockToTime(...special(mt[1]), now, shift) : readClock([null, mt[2], mt[3], mt[4], mt[5] || mt[11]], now, shift);
      let b = mt[6] === 'noon' || mt[6] === 'midnight' ? clockToTime(...special(mt[6]), now, shift) : readClock([null, mt[7], mt[8], mt[9], mt[10]], now, shift);
      let a2 = a;
      if (a != null && b != null) {
        // keep the start before the end: pick the most recent start not after the end
        if (!mt[5] && !mt[11]) { const h = +mt[2], m = +(mt[3] || mt[4] || 0); a2 = clockToTime(h, m, null, b, 0); }
        else if (a2 > b) a2 -= DAY;
        res.at = a2; res.end = b; res.said = true;
      }
      s = s.replace(mt[0], ' ');
    }
    // "1 hour 20 minutes ago", "20 minutes ago", "1.5 hours ago"
    mt = s.match(/ (?:about |around )?(\d+(?:\.\d+)?) (hours?|hrs?)(?: and)?(?: (\d+) (?:minutes?|mins?))? ago /) || s.match(/ (?:about |around )?(\d+(?:\.\d+)?) (minutes?|mins?) ago /);
    if (mt) {
      const n = +mt[1], mins = /^h/.test(mt[2]) ? n * 60 + (+mt[3] || 0) : n;
      res.at = Math.round((now - mins * MIN - shift * DAY) / MIN) * MIN; res.said = true; s = s.replace(mt[0], ' ');
    }
    if (res.at == null) {
      mt = s.match(/ (?:at |around |about )?(noon|midnight) /);
      if (mt) { res.at = clockToTime(...special(mt[1]), now, shift); res.said = true; s = s.replace(mt[0], ' '); }
    }
    if (res.at == null) {
      // "at 2", "at 2:30 pm", "around 3 in the morning"
      mt = s.match(new RegExp(' (?:at|around|about|@) ' + CLOCK + ' '));
      // "2:30", "2 pm" with no "at"
      if (!mt) mt = s.match(new RegExp(' (\\d{1,2})(?::(\\d{2}))()(?: ' + MER + ')? ')) || s.match(new RegExp(' (\\d{1,2})()() (am|pm) '));
      if (mt) { const t = readClock(mt, now, shift); if (t != null) { res.at = t; res.said = true; s = s.replace(mt[0], ' '); } }
    }
    if (res.at == null && / (just now|right now|now) /.test(s)) { res.explicitNow = true; s = s.replace(/ (just now|right now|now) /, ' '); }
    if (res.at == null && shift) { res.at = now - DAY; res.said = true; }
    res.rest = s.replace(/\s+/g, ' ');
    return res;
  }

  /* ---------------- amounts and lengths ---------------- */
  const OZ = '(oz|ounces?|ounce)', ML = '(ml|mls|milliliters?|millilitres?|mil|mils|cc|ccs)';
  function amountOf(s) {
    let mt = s.match(new RegExp(' (\\d+(?:\\.\\d+)?) ?' + OZ + ' ')); if (mt) return { amount: +mt[1], unit: 'oz', raw: mt[0] };
    mt = s.match(new RegExp(' (\\d+(?:\\.\\d+)?) ?' + ML + ' ')); if (mt) return { amount: +mt[1], unit: 'ml', raw: mt[0] };
    return null;
  }
  function minutesOf(s) {
    let mt = s.match(/ (\d+(?:\.\d+)?) (hours?|hrs?)(?: and)?(?: (\d+) (minutes?|mins?))? /);
    if (mt) return { minutes: Math.round(+mt[1] * 60 + (+mt[3] || 0)), raw: mt[0] };
    mt = s.match(/ (\d+(?:\.\d+)?) ?(minutes?|mins?|min) /);
    if (mt) return { minutes: Math.round(+mt[1]), raw: mt[0] };
    return null;
  }
  function sidesOf(s) {
    const r = { L: null, R: null, side: null, both: / both (sides|breasts|boobs) | each side /.test(s) };
    for (const [k, word] of [['L', 'left'], ['R', 'right']]) {
      let mt = s.match(new RegExp(' ' + word + '(?: side| breast| boob)?(?: for)? (\\d+)(?: ?(?:minutes?|mins?|min))? ')) ||
        s.match(new RegExp(' (\\d+) ?(?:minutes?|mins?|min)?(?: on)?(?: the)? ' + word + ' '));
      if (mt) r[k] = +mt[1];
      if (new RegExp(' ' + word + ' ').test(s) && !r.side) r.side = k;
    }
    if (/ left /.test(s) && / right /.test(s)) { const li = s.indexOf(' left '), ri = s.indexOf(' right '); r.side = li < ri ? 'L' : 'R'; r.last = li < ri ? 'R' : 'L'; }
    return r;
  }

  /* ---------------- medicines ---------------- */
  const MEDS = [['vitamin d', 'Vitamin D'], ['vit d', 'Vitamin D'], ['vitamin', 'Vitamin D'], ['tylenol', 'Tylenol'], ['acetaminophen', 'Acetaminophen'], ['paracetamol', 'Paracetamol'], ['motrin', 'Motrin'], ['advil', 'Advil'], ['ibuprofen', 'Ibuprofen'], ['gas drops', 'Gas drops'], ['simethicone', 'Simethicone'], ['mylicon', 'Mylicon'], ['gripe water', 'Gripe water'], ['probiotic', 'Probiotic'], ['probiotics', 'Probiotic'], ['iron', 'Iron'], ['amoxicillin', 'Amoxicillin'], ['antibiotic', 'Antibiotic'], ['antibiotics', 'Antibiotic'], ['pepcid', 'Pepcid'], ['famotidine', 'Famotidine'], ['omeprazole', 'Omeprazole'], ['nystatin', 'Nystatin']];
  const MED_WORDS = / (medicine|medication|meds|med|dose|dosed) /;
  function medOf(s, custom) {
    const list = (custom || []).map((n) => [String(n).toLowerCase(), String(n)]).concat(MEDS).sort((a, b) => b[0].length - a[0].length);
    for (const [k, name] of list) if (k && (' ' + s + ' ').includes(' ' + k + ' ')) return { name, raw: k };
    return null;
  }
  function doseOf(s) {
    const mt = s.match(/ (\d+(?:\.\d+)?) ?(ml|mls|milliliters?|millilitres?|drops?|mg|milligrams?|tsp|teaspoons?|squirts?|cc) /);
    if (!mt) return '';
    let u = mt[2]; if (/^(ml|mls|millil|cc)/.test(u)) u = 'ml'; else if (/^mill?igram|^mg/.test(u)) u = 'mg'; else if (/^drop/.test(u)) u = +mt[1] === 1 ? 'drop' : 'drops'; else if (/^t/.test(u)) u = 'tsp'; else if (/^squirt/.test(u)) u = +mt[1] === 1 ? 'squirt' : 'squirts';
    return mt[1] + ' ' + u;
  }

  /* ---------------- the parser ---------------- */
  const RX = {
    pump: / (pump|pumped|pumping|pumps|expressed) /,
    diaper: / (diaper|diapers|nappy|nappies|pee|peed|peeing|pees|wee|weed|wet|poop|pooped|pooping|poopy|poos?|pooed|dirty|bm|bowel movement|soiled|blowout|changed) /,
    wet: / (pee|peed|peeing|pees|wee|weed|wet) /, dirty: / (poop|pooped|pooping|poopy|poos?|pooed|dirty|bm|bowel movement|soiled|blowout) /, bothD: / (both|mixed) /,
    sleep: / (sleep|slept|sleeping|asleep|nap|napped|napping|naps|woke|wake|waking|awake|went down|down for|bedtime|bed time|to bed) /,
    wake: / (woke|wake|waking|awake|got up|up from|end(ed)? (the |her |his )?(sleep|nap)|stop(ped)? (the |her |his )?(sleep|nap)|done (sleeping|napping)|is up) /,
    sleepStart: / (fell asleep|asleep|went down|down for|going down|start(ed|ing)? (a |the |her |his )?(sleep|nap)|sleeping now|is sleeping|nap time|bedtime|bed time|to bed|put (her|him|them|baby|the baby) down) /,
    bottle: / (bottle|bottles|formula|breast ?milk|expressed milk|pumped milk|oz|ounces?|ml|mls|milliliters?) /,
    breast: / (breast ?fed|breast ?feed|breast ?feeding|breastfed|breastfeeding|nursed|nursing|nurse|left|right|boob|latched|on the breast) /,
    feed: / (fed|feed|feeding|feeds|ate|eat|eating|drank|meal) /,
    start: / (start|started|starting|begin|began|beginning) /,
    nowish: / (now|currently) /,
  };
  function parseVoice(text, now, opts) {
    opts = opts || {}; now = now == null ? Date.now() : now;
    const heard = String(text || '').trim();
    if (!heard) return { kind: null, reason: 'empty', heard };
    const T = takeTimes(clean(heard), now);
    let s = T.rest;
    const out = { heard, at: T.at, end: T.end, timeSaid: T.said };

    const med = medOf(s, opts.meds);
    if (med || MED_WORDS.test(s)) {
      const sNoName = med ? (' ' + s + ' ').replace(' ' + med.raw + ' ', ' ') : s;
      return Object.assign(out, { kind: 'medicine', action: 'log', name: med ? med.name : '', dose: doseOf(sNoName) });
    }
    const amt = amountOf(s), len = minutesOf(amt ? s.replace(amt.raw, ' ') : s);
    const is = (k) => RX[k].test(s);
    if (is('pump')) {
      const sd = sidesOf(s);
      return Object.assign(out, { kind: 'pump', action: 'log', amount: amt ? amt.amount : null, unit: amt ? amt.unit : null, minutes: len ? len.minutes : null, side: sd.both || (sd.L != null && sd.R != null) || (/ left /.test(s) && / right /.test(s)) ? 'both' : sd.side });
    }
    const hits = [];
    const diaper = is('diaper') && !(/ (wet|dirty) /.test(s) && !/ (diaper|nappy|pee|poop|poo|bm) /.test(s) && (is('bottle') || is('breast')));
    if (diaper) hits.push('diaper');
    const strongSleep = is('sleep') && !(/ (bedtime|bed time|to bed) /.test(s) && !/ (sleep|slept|asleep|nap|napped|woke|awake) /.test(s) && (amt || is('bottle')));
    if (strongSleep) hits.push('sleep');
    const feedish = amt || is('bottle') || is('breast') || is('feed');
    if (feedish && !(diaper && !amt && !is('breast') && !is('feed') && !is('bottle'))) hits.push('feed');
    if (hits.length > 1) {
      // "changed a wet diaper" + nothing else is fine; a real mix of two things is not
      return Object.assign(out, { kind: null, reason: 'multiple', found: hits });
    }
    if (!hits.length) return Object.assign(out, { kind: null, reason: 'unknown' });

    if (hits[0] === 'diaper') {
      const w = is('wet'), d = is('dirty');
      const sub = (w && d) || (is('bothD') && (w || d || / diaper | nappy /.test(s))) ? 'both' : d ? 'poop' : w ? 'pee' : null;
      return Object.assign(out, { kind: 'diaper', action: 'log', subtype: sub });
    }
    if (hits[0] === 'sleep') {
      const r = Object.assign(out, { kind: 'sleep', minutes: len ? len.minutes : null });
      if (T.end != null) { r.action = 'log'; r.minutes = Math.round((T.end - T.at) / MIN); return r; }
      if (len && len.minutes > 0) {
        r.action = 'log';
        if (T.at == null) { r.end = now; r.at = now - len.minutes * MIN; }
        else if (is('wake')) { r.end = T.at; r.at = T.at - len.minutes * MIN; }
        else { r.end = T.at + len.minutes * MIN; }
        if (r.end > now + MIN) { r.end = now; r.at = now - len.minutes * MIN; }
        return r;
      }
      if (is('wake')) { r.action = 'end'; r.end = T.at; r.at = null; return r; }
      r.action = 'start'; return r;
    }
    // feeds
    const sd = sidesOf(amt ? s.replace(amt.raw, ' ') : s);
    const bottleWords = / (bottle|bottles|formula|breast ?milk|expressed milk|pumped milk) /.test(s);
    const breastWords = / (breast ?fed|breast ?feed|breast ?feeding|breastfed|breastfeeding|nursed|nursing|nurse|boob|latched|on the breast) /.test(s) || sd.side;
    if (amt || (bottleWords && !breastWords)) {
      const milk = / (formula) /.test(s) ? 'Formula' : / (breast ?milk|expressed milk|pumped milk) /.test(s) ? 'Breast milk' : null;
      return Object.assign(out, { kind: 'bottle', action: 'log', amount: amt ? amt.amount : null, unit: amt ? amt.unit : null, milk });
    }
    if (breastWords || len) {
      const r = Object.assign(out, { kind: 'breast', side: sd.side, lastSide: sd.last || sd.side });
      let L = sd.L, R = sd.R;
      if (L == null && R == null && len) {
        if (sd.both) { L = Math.ceil(len.minutes / 2); R = Math.floor(len.minutes / 2); }
        else if (sd.side === 'R') R = len.minutes; else L = len.minutes;
      }
      if (L != null || R != null) {
        r.action = 'log'; r.left = L || 0; r.right = R || 0; r.minutes = r.left + r.right;
        if (T.end != null) { r.end = T.end; }
        else { if (r.at == null) r.at = now - r.minutes * MIN; r.end = r.at + r.minutes * MIN; if (r.end > now + MIN) { r.end = now; r.at = now - r.minutes * MIN; } }
        return r;
      }
      if (is('start') || is('nowish') || !T.said) { r.action = 'start'; return r; }
      r.action = 'log'; r.left = null; r.right = null; return r;
    }
    // "fed at 2" with nothing else: a feed, kind to be picked in the confirm sheet
    return Object.assign(out, { kind: 'feed', action: 'log' });
  }

  /* ---------------- speech to text ---------------- */
  const CONTEXT = ['Vitamin D', 'ounces', 'oz', 'ml', 'bottle', 'formula', 'breast milk', 'diaper', 'pee', 'poop', 'wet', 'dirty', 'nap', 'fell asleep', 'woke up', 'left side', 'right side', 'pumped', 'nursed', 'Tylenol'];
  const lang = () => { const l = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'; return /^en-(US|CA|AU|NZ|GB|IE)$/i.test(l) ? l : 'en-US'; };
  const isNative = () => { const C = root.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); };
  const nativeSR = () => { const C = root.Capacitor; return C && C.Plugins && C.Plugins.SpeechRecognition && (!C.isPluginAvailable || C.isPluginAvailable('SpeechRecognition')) ? C.Plugins.SpeechRecognition : null; };
  const WebSR = () => root.SpeechRecognition || root.webkitSpeechRecognition || null;
  const fail = (code, msg) => Object.assign(new Error(msg || code), { code });
  let webLocal = false;

  const LDVoice = {
    // 'native' | 'web' | null. Inside the iPhone app the browser engine is never used, so audio can't leave the phone.
    engine() { if (isNative()) return nativeSR() ? 'native' : null; return WebSR() ? 'web' : null; },
    get onDevice() { return this.engine() === 'native' || webLocal; },
    async supported() {
      const e = this.engine(); if (!e) return false;
      if (e === 'native') {
        try {
          const SR = nativeSR(); const a = await SR.available(); if (!a || !a.available) return false;
          const od = await SR.isOnDeviceRecognitionAvailable({ language: lang(), preferLegacyRecognizer: true });
          if (od && od.available) return true;
          const od2 = await SR.isOnDeviceRecognitionAvailable({ language: 'en-US', preferLegacyRecognizer: true });
          return !!(od2 && od2.available);
        } catch (x) { return false; }
      }
      try { const W = WebSR(); if (W && W.available) { const r = await W.available({ langs: [lang()], processLocally: true }); webLocal = r === 'available'; } } catch (x) { webLocal = false; }
      return true;
    },
    // listen once. Returns { result: Promise<string>, stop(), cancel() }. onPartial gets live text.
    listen(onPartial) { return this.engine() === 'native' ? listenNative(onPartial) : listenWeb(onPartial); },
  };

  function listenNative(onPartial) {
    const SR = nativeSR(); let latest = '', hs = [], done = false, settle, silence, cap, cancelled = false;
    const result = new Promise((res, rej) => { settle = { res, rej }; });
    const finish = (err) => { if (done) return; done = true; clearTimeout(silence); clearTimeout(cap); hs.forEach((h) => { try { h.remove(); } catch (x) {} }); if (err) settle.rej(err); else settle.res(cancelled ? '' : latest); };
    const stop = async () => { if (done) return; try { await SR.stop(); } catch (x) {} setTimeout(() => finish(), 700); };
    (async () => {
      try {
        let p = await SR.checkPermissions();
        if (p.speechRecognition !== 'granted') { if (p.speechRecognition === 'denied') throw fail('denied'); p = await SR.requestPermissions(); if (p.speechRecognition !== 'granted') throw fail('denied'); }
        let language = lang();
        const od = await SR.isOnDeviceRecognitionAvailable({ language, preferLegacyRecognizer: true });
        if (!od || !od.available) { language = 'en-US'; const od2 = await SR.isOnDeviceRecognitionAvailable({ language, preferLegacyRecognizer: true }); if (!od2 || !od2.available) throw fail('ondevice'); }
        hs.push(await SR.addListener('partialResults', (e) => {
          const m = (e && ((e.matches && e.matches[0]) || e.accumulatedText)) || ''; if (!m) return;
          latest = m; onPartial && onPartial(m);
          clearTimeout(silence); silence = setTimeout(stop, 1800); // a short pause ends the phrase
        }));
        hs.push(await SR.addListener('listeningState', (e) => { if (e && (e.status === 'stopped' || e.state === 'stopped')) setTimeout(() => finish(), 250); }));
        hs.push(await SR.addListener('error', (e) => { if (!latest) finish(fail(e && e.code === 'ON_DEVICE_RECOGNITION_UNAVAILABLE' ? 'ondevice' : 'error', e && e.message)); }));
        // on-device only: the plugin sets requiresOnDeviceRecognition and refuses if this phone can't do it locally
        await SR.start({ language, partialResults: true, maxResults: 1, useOnDeviceRecognition: true, preferLegacyRecognizer: true, addPunctuation: false, contextualStrings: CONTEXT });
        cap = setTimeout(stop, 12000);
        silence = setTimeout(stop, 6000); // nothing said at all
      } catch (x) {
        const code = x && x.code ? x.code : /ON_DEVICE/.test(String(x && x.message)) ? 'ondevice' : /denied|permission|not authorized/i.test(String(x && x.message)) ? 'denied' : 'error';
        finish(fail(code, x && x.message));
      }
    })();
    return { result, stop, cancel() { cancelled = true; latest = ''; try { SR.forceStop ? SR.forceStop() : SR.stop(); } catch (x) {} finish(); } };
  }

  function listenWeb(onPartial) {
    const W = WebSR(); const r = new W(); let latest = '', done = false, settle, cap;
    const result = new Promise((res, rej) => { settle = { res, rej }; });
    const finish = (err) => { if (done) return; done = true; clearTimeout(cap); if (err) settle.rej(err); else settle.res(latest); };
    r.lang = lang(); r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    if (webLocal && 'processLocally' in r) r.processLocally = true; // Chrome: on-device when the language pack is there
    r.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; latest = t.trim(); onPartial && onPartial(latest); };
    r.onerror = (e) => { const c = e && e.error; if (c === 'no-speech' || c === 'aborted') return finish(); finish(fail(c === 'not-allowed' || c === 'service-not-allowed' ? 'denied' : c === 'network' ? 'network' : c === 'audio-capture' ? 'nomic' : 'error', c)); };
    r.onend = () => finish();
    try { r.start(); } catch (x) { finish(fail('error', String(x))); }
    cap = setTimeout(() => { try { r.stop(); } catch (x) {} }, 12000);
    return { result, stop() { try { r.stop(); } catch (x) {} }, cancel() { latest = ''; try { r.abort(); } catch (x) {} finish(); } };
  }

  const api = { parseVoice, clean, LDVoice };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.parseVoice = parseVoice; root.LDVoice = LDVoice; }
})(typeof window !== 'undefined' ? window : globalThis);
