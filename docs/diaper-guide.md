# Typical diaper ranges (Today > Last 24 hours)

One quiet line of secondary text under the last-24-hour counts, e.g. `Typical at day 4: 3–5 wet, 2–3 dirty`, plus a small ⓘ that opens a sheet with the full table and the disclaimer. Day 1 is the day of birth (same `lifeDay()` the app already uses for "Day N" and Today's goals). Shown only when a birthdate is set, for days 1–182, and when "Show today's goals" is on. The table lives inline in index.html between `DIAPER_GUIDE_START` and `DIAPER_GUIDE_END`; Today's goals take their wet and dirty numbers from the same table so the two never disagree.

## Final ranges (per 24 hours)
| Day of life | Wet | Dirty |
|---|---|---|
| 1–2 | 1–2 | 1–2 |
| 3–4 | 3–5 | 2–3 |
| 5 | 5–6 | 2–4 |
| 6–42 (to 6 weeks) | 6–8 | 2–5 |
| 43–182 (6 weeks to ~6 months) | 6+ | varies (every 2–3 days up to 5 a day) |
| 183+ | not shown | not shown |

## Starting point
General guidelines a physician friend of the founder shared (not named in the app, and not presented as an endorsement):
Day 1–2: 1–2 stools, 1–2 wet. Day 3–5: 2–3 stools, 3–5 wet. Day 6–14+: 2–5 stools, 6–8 wet. 6 weeks+: a stool every 2–3 days up to 5 a day; 6+ wet.

## Cross-check (read Nov 25, 2026)
- AAP, HealthyChildren.org, "How Often and How Much Should Your Baby Eat?" (updated 4/2/2024): first few days 2–3 wet; after day 4–5 at least 5–6 wet; by day 4 at least 4 stools (depends on breast vs formula). "Warning Signs of Breastfeeding Problems": after day 7, fewer than 6 wet and 4 stools is a reason to call.
- NHS, "Breastfeeding: is my baby getting enough milk?": first 48 h 2–3 wet; from day 4 at least 2 poos a day for the first few weeks; from day 5 at least 6 heavy wet. NHS trust charts (UNICEF UK based, e.g. Cambridge, Sussex, South West London): day 1–2 1–2 wet / 1+ dirty; day 3–4 3+ wet / 2+ dirty; day 5–6 5+ wet / 2+ dirty; day 7–28 6+ wet / 2+ dirty; after 4–6 weeks some babies go days without a poo.
- La Leche League Canada ("Poops and Pees") and LLL GB: day 1–2 1–2 wet and 1–2 dirty; day 3–4 3–4+ wet, 3+ stools; day 5–7 6+ wet, 3+ stools (3–5 by day 6); after 5–6 weeks stools can become much less frequent, even once every several days.
- CDC, "Newborn Breastfeeding Basics": minimums day 1 1/1, day 2 2/3, day 3 5/3, day 4–7 6/3; after ~6 weeks fewer poops.

## Differences and what we did
- Day 1–2: all sources agree with 1–2 / 1–2. Kept.
- Day 3–4: NHS 3+ wet / 2+ dirty matches the 3–5 / 2–3 starting point; LLL and CDC put stools a little higher (3+). Kept 3–5 / 2–3.
- Day 5: the starting point groups day 5 with days 3–4 (3–5 wet), but AAP (5–6 after day 4–5), NHS (5+ on day 5, 6 from day 5) and LLL (6 by day 5) are all higher. Split day 5 out as 5–6 wet, 2–4 dirty. This is the only real change.
- Day 6 to 6 weeks: 6–8 wet matches all sources (6+). Dirty 2–5 matches NHS (2+) and LLL Canada (3–5); AAP says 4+ for breastfed babies after day 7 and fewer for formula. Kept 2–5 and say in the sheet that breastfed and formula-fed babies differ. "6–14+" read as day 6 up to 6 weeks.
- After 6 weeks: all sources say stools vary widely and can be days apart; wet stays 6+. Kept; the line says "dirty varies" so it fits on one line, and the sheet shows the full wording.
- After ~6 months: none of the sources give counts once solids start, so nothing is shown from day 183.
- Today's goals previously used day 5+ 6–8 wet / 3+ poops and day 4 2–4 poops. They now use this table (feeds unchanged); after 6 weeks the poop row reads "varies" with no target dots or checkmark.

## Typical poop look (one line inside the ⓘ sheet only)
Matched to the baby's age, e.g. "At day 4, poop is usually changing from greenish-brown to yellow." No new fields, screens or buttons; the existing optional poop color (with red/pale/black noted for the pediatrician summary) is unchanged.
| Day of life | Line |
|---|---|
| 1–2 | thick, sticky and black or dark green |
| 3–5 | changing from greenish-brown to yellow |
| 6–42 | soft and yellow, often seedy if breastfed, or thicker and yellow to tan with formula |
| 43–182 | soft, like pudding, and yellow, tan or brown |
Starting point: the same physician friend's notes (day 1–2 thick, sticky, black/dark green; day 3–5 greenish/brown to yellow; day 6–14+ soft, yellow, seedy if breastfed, or pasty/tan; 6 weeks+ soft/pudding-like, yellow/tan or brown). Cross-checked with AAP HealthyChildren.org ("How to Tell if Your Breastfed Baby is Getting Enough Milk": blackish tarry on days 1–2, greenish to yellow on days 3–4, yellow and loose with small curds by days 5–7; "The Many Colors of Baby Poop": mustard yellow breastfed, yellow-tan formula; Symptom Checker: meconium days 1–3, greenish-brown transitional days 4–5, milk stools from day 6, formula stools like peanut butter), NHS trust nappy charts (meconium days 1–2, brown/green/yellow and looser days 3–4, yellow from day 5) and La Leche League (greenish transitional by day 3, loose bright yellow seedy by day 5; pudding-like mustard yellow later). All agree; wording only made plainer ("pasty" became "thicker", "pudding-like" became "like pudding").

## Wording and compliance
- Line: `Typical at day N: X wet, Y dirty`. Neutral secondary text, no color change, never compared with the baby's counts, no alerts.
- Sheet: "This is a general guide drawn from common pediatric and breastfeeding guidance. It isn't medical advice, and Babyway doesn't judge your baby's counts." / "Every baby is different. Breastfed and formula-fed babies often poop on different schedules, and many babies poop less often after about 6 weeks." / "If you have any concerns, call your pediatrician."
- No diagnosis, no "dehydrated", no warnings, no endorsement claims, no organizations or people named in the app (unit test checks the words).

## Accessibility (Apple HIG)
- Text is in rem, so it follows iOS Larger Text; it wraps rather than truncates; no sideways scroll at the 24 px cap.
- Contrast 5.4:1 (light) and 5.7:1 (night) via `--soft2`.
- ⓘ is a 44×44 pt button labeled "About typical diaper ranges" for VoiceOver; the glyph is aria-hidden. The sheet is a dialog, focus moves to Close, the table has header scopes.
