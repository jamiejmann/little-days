/* Little Days · "Today's moments" content library.
   Short, everyday activities by age, written in plain language for parents.
   Every activity is grounded in public guidance from the sources listed below
   (CDC "Learn the Signs. Act Early.", the American Academy of Pediatrics on HealthyChildren.org,
   NHS Best Start in Life, and ZERO TO THREE). No statistics or claims beyond those sources.
   These are ideas for play, not a curriculum or medical advice.

   Shape of an activity:
     id      stable id (stored with check-offs; never rename once released)
     area    one of the AREAS keys below
     title   short name
     dose    how long / how often, in plain words
     times   taps to complete it for the day (default 1); tummy time counts sessions
     steps   2-4 simple steps
     why     one line on why it helps
     notice  optional "what to notice" (an observation, never a test)
     safety  optional extra safety line
     src     ids from SOURCES
*/
(function(){
const SOURCES={
  cdc2:{name:'CDC · Milestones by 2 months',url:'https://www.cdc.gov/act-early/milestones/2-months.html'},
  cdc4:{name:'CDC · Milestones by 4 months',url:'https://www.cdc.gov/act-early/milestones/4-months.html'},
  cdc6:{name:'CDC · Milestones by 6 months',url:'https://www.cdc.gov/act-early/milestones/6-months.html'},
  cdc9:{name:'CDC · Milestones by 9 months',url:'https://www.cdc.gov/act-early/milestones/9-months.html'},
  cdc12:{name:'CDC · Milestones by 1 year',url:'https://www.cdc.gov/act-early/milestones/1-year.html'},
  aapTummy:{name:'AAP · Back to Sleep, Tummy to Play',url:'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Back-to-Sleep-Tummy-to-Play.aspx'},
  aapSleep:{name:'AAP · How to Keep Your Sleeping Baby Safe',url:'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx'},
  aapBooks:{name:'AAP · How to Share Books With Your Baby',url:'https://www.healthychildren.org/English/ages-stages/baby/pages/how-to-share-books-with-your-baby.aspx'},
  aap1mo:{name:'AAP · Developmental Milestones at 1 Month',url:'https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-1-Month.aspx'},
  aap3mo:{name:'AAP · Developmental Milestones at 3 Months',url:'https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-3-Months.aspx'},
  aapSkin:{name:'AAP · Skin-to-Skin Contact (Kangaroo Care)',url:'https://www.healthychildren.org/English/ages-stages/baby/preemie/Pages/About-Skin-to-Skin-Care.aspx'},
  nhsTalk:{name:'NHS Best Start in Life · First sounds, 0 to 6 months',url:'https://www.nhs.uk/start-for-life/baby/learning-to-talk/'},
  ztt:{name:'ZERO TO THREE · Play Activities for Birth to 12 Months',url:'https://www.zerotothree.org/resource/play-activities-for-birth-to-12-months/'},
  zttLang:{name:'ZERO TO THREE · Language and Literacy Skills, 0 to 12 Months',url:'https://www.zerotothree.org/resource/supporting-language-and-literacy-skills-from-0-12-months/'}
};

const AREAS={
  cognitive:{label:'Thinking',emoji:'🧠'},
  language:{label:'Talking',emoji:'💬'},
  physical:{label:'Moving',emoji:'💪'},
  visual:{label:'Seeing',emoji:'👀'},
  sensory:{label:'Senses',emoji:'✋'},
  social:{label:'Feelings',emoji:'💛'},
  independence:{label:'Exploring',emoji:'🌱'}
};

const SAFETY={
  always:'Never wake your baby or delay a feed for an activity. Stop if baby seems tired or fussy.',
  tummy:'Tummy time is only while baby is awake and you are watching. Back to sleep, always.',
  skin:"Skin-to-skin only while you're fully awake. If you feel sleepy, place baby on their back in their own bassinet or crib.",
  medical:"These are ideas for play, not medical advice. Every baby grows at their own pace. Talk to your pediatrician about any concerns."
};

/* ---------- 0 to 2 weeks: bonding, calm and closeness ---------- */
const B0=[
 {id:'nb-tummy',area:'physical',title:'Tummy time on your chest',dose:'A few minutes, 2–3 times today',times:3,tummy:true,
  steps:['Lean back a little while you are fully awake, and lay baby tummy-down on your chest.','Keep a hand on their back and make sure their nose and mouth are clear.','Talk softly so they want to lift their head toward your face.','A minute or two is a fine start. Stop when baby has had enough.'],
  why:'Builds the neck and shoulder strength baby will later use to roll, sit and crawl.',
  notice:'Does baby try to lift or turn their head toward your voice?',safety:'tummy',src:['aapTummy']},
 {id:'nb-face',area:'cognitive',title:'Face-to-face time',dose:'1–2 minutes, twice today',
  steps:['When baby is awake and calm, hold them about 8–12 inches from your face.','Look into their eyes, smile and speak softly.','Pause and give them time to respond.'],
  why:'Newborns see best up close and prefer faces, so this is how they start to know you.',
  notice:'Does baby briefly focus on your face?',src:['aap1mo','cdc2']},
 {id:'nb-narrate',area:'language',title:'Narrate the day',dose:'During changes, dressing and feeds',
  steps:['Say what you are doing as you do it: "Socks off. Legs up. Here are your toes."','Use a warm, sing-song voice and full sentences.','Use the same words each time. Babies learn through repetition.'],
  why:'Hearing your voice and everyday words is the very start of learning to talk.',
  notice:'Does baby settle or go still when you talk?',src:['nhsTalk','cdc2']},
 {id:'nb-skin',area:'social',title:'Skin-to-skin cuddle',dose:'As long as you both like',
  steps:['Sit somewhere comfy while you are fully awake. Baby wears just a diaper.','Hold baby upright on your bare chest, head turned to one side, nose and mouth clear.','Cover you both with a blanket, keeping baby\u2019s head uncovered.','Any caregiver can do this.'],
  why:'Helps keep baby warm and calm and supports bonding and breastfeeding.',
  notice:'Does baby seem calmer or more relaxed against you?',safety:'skin',src:['aapSkin','aapSleep']},
 {id:'nb-contrast',area:'visual',title:'Black-and-white pictures',dose:'1–2 minutes, once today',
  steps:['Hold a bold black-and-white picture 8–12 inches from baby\u2019s face.','Keep it still at first.','If baby looks at it, move it slowly a little to one side. It\u2019s fine if they don\u2019t follow yet.'],
  why:'Young babies are drawn to high-contrast patterns, which gives their eyes something to practice on.',
  notice:'Does baby look at the picture for a moment?',src:['aap1mo']},
 {id:'nb-read',area:'language',title:'Read a first story',dose:'2–3 minutes, once today',
  steps:['Hold baby close and read any short book aloud.','Use different voices and let your tone go up and down.','Stop whenever baby looks away or fusses. No need to finish the book.'],
  why:'Baby takes in the rhythm and sounds of your voice, and it becomes a calm routine together.',
  notice:'Does your voice seem to soothe them?',src:['aapBooks']},
 {id:'nb-cues',area:'social',title:'Read baby\u2019s signals',dose:'Throughout the day',
  steps:['Notice when baby is alert and looking at you. That\u2019s a good time to play.','Looking away, yawning or fussing usually means "I need a break."','When you see those signs, slow down, hold them and keep things quiet.'],
  why:'Responding to their signals helps baby feel safe, and you learn what they like.',
  notice:'What does baby do when they have had enough?',src:['cdc2']},
 {id:'nb-hands',area:'independence',title:'Hands near mouth',dose:'Whenever baby is fussing a little',
  steps:['When baby is awake and fussing a little, help their hand find their mouth.','Let them suck on their fingers or a pacifier if they like.','Stay close and comfort them if they need you.'],
  why:'Sucking on fingers is one of the first ways babies learn to calm themselves.',
  notice:'Does baby bring a hand toward their mouth on their own?',src:['cdc2']},
 {id:'nb-sound',area:'sensory',title:'Gentle sounds',dose:'A minute or two',
  steps:['Hum or sing softly near baby, or play quiet music.','Try one side, then the other.','Keep it calm and low. Newborns startle easily.'],
  why:'Babies can hear well from birth and may turn toward familiar voices.',
  notice:'Does baby react differently to your voice and another caregiver\u2019s?',src:['aap1mo','nhsTalk']}
];

/* ---------- 2 to 4 weeks: looking, listening, head control ---------- */
const B1=[
 {id:'w2-tummy',area:'physical',title:'Tummy time',dose:'3–5 minutes, 2–3 times today',times:3,tummy:true,
  steps:['Try it after a diaper change or when baby wakes up from a nap.','Lay baby tummy-down on your chest or on a blanket on the floor.','Get down at their eye level and talk or sing.','Stop when baby has had enough. Short is fine.'],
  why:'Strengthens neck, shoulders and back, and helps prevent flat spots on the head.',
  notice:'Does baby turn their head from side to side?',safety:'tummy',src:['aapTummy','aap1mo']},
 {id:'w2-track',area:'visual',title:'Follow my face',dose:'1–2 minutes',
  steps:['Hold baby facing you, about 8–12 inches away.','Once they look at you, slowly move your head a little to one side.','Come back to the middle, then try the other side.'],
  why:'Practices focusing and starting to follow things with the eyes.',
  notice:'Do baby\u2019s eyes follow you, even a little?',src:['aap1mo','aap3mo']},
 {id:'w2-sing',area:'language',title:'Sing while you feed',dose:'During one feed today',
  steps:['While feeding, talk or sing softly to baby.','Use a sing-song voice with big ups and downs.','Repeat the same song. Babies love hearing it again and again.'],
  why:'Watching your face and hearing your voice up close supports early speech.',
  notice:'Does baby watch your mouth or face?',src:['nhsTalk']},
 {id:'w2-rattle',area:'sensory',title:'Where\u2019s that sound?',dose:'A few tries',
  steps:['Hold a soft rattle to one side of baby\u2019s head, out of sight.','Shake it gently.','Wait, then try the other side.'],
  why:'Helps baby link sounds with where they come from.',
  notice:'Does baby go still, blink or turn toward the sound?',src:['cdc2']},
 {id:'w2-cuddle',area:'social',title:'Hold, rock, repeat',dose:'Whenever baby needs it',
  steps:['When baby cries, pick them up and hold them close.','Rock, sway or talk softly.','You can\u2019t spoil a baby by holding or responding to them.'],
  why:'Being comforted again and again teaches baby they are safe and cared for.',
  notice:'What helps baby settle best: rocking, your voice, or being held?',src:['cdc2']},
 {id:'w2-skin',area:'social',title:'Skin-to-skin',dose:'10 minutes or more',
  steps:['While you are fully awake, hold baby in just a diaper on your bare chest.','Keep their head turned to the side with nose and mouth clear.','A good one for any caregiver to try.'],
  why:'Calms baby, helps keep them warm and builds closeness.',safety:'skin',src:['aapSkin']},
 {id:'w2-read',area:'language',title:'Story on your lap',dose:'A few minutes',
  steps:['Find a quiet spot and hold baby on your lap or in your arms.','Pick a book with simple rhymes and bold pictures.','Point to the pictures and use different voices.'],
  why:'Shared reading from birth builds language and a cozy routine.',
  notice:'Does baby widen their eyes or kick their legs?',src:['aapBooks']},
 {id:'w2-face',area:'cognitive',title:'Slow faces',dose:'1–2 minutes',
  steps:['Face baby, close up.','Slowly make one expression: a big smile, then an "O" mouth.','Hold it a few seconds and wait.'],
  why:'Faces are baby\u2019s favorite thing to study. It\u2019s how they start learning about people.',
  notice:'Does baby stare, or move their mouth too?',src:['aap1mo','nhsTalk']},
 {id:'w2-floor',area:'independence',title:'Kick time on a blanket',dose:'A few minutes, awake',
  steps:['Lay baby on their back on a clean blanket on the floor, while they\u2019re awake.','Let them stretch, wave and kick freely.','Stay right beside them.'],
  why:'Free time out of seats lets baby move their whole body, and helps prevent flat spots.',
  notice:'Does baby move both arms and both legs?',src:['aapTummy','cdc2']}
];

/* ---------- 1 to 2 months: smiles, tracking, "talking" ---------- */
const B2=[
 {id:'m1-tummy',area:'physical',title:'Tummy time with a toy',dose:'A few minutes, 3 or more times',times:3,tummy:true,
  steps:['Lay baby on their tummy on the floor while they\u2019re awake.','Put a toy or yourself at their eye level, just in front.','Cheer them on as they lift their head.','By about 7 weeks, aim for 15–30 minutes in total across the day.'],
  why:'Helps baby practice holding their head up, a key skill around 2 months.',
  notice:'Does baby hold their head up for a moment?',safety:'tummy',src:['aapTummy','cdc2']},
 {id:'m1-coo',area:'language',title:'Copy baby\u2019s sounds',dose:'A few back-and-forths',
  steps:['When baby makes a sound, copy it back.','Wait, smiling, for them to "answer."','Keep the conversation going as long as they enjoy it.'],
  why:'Taking turns with sounds is the start of real conversation.',
  notice:'Does baby make sounds other than crying?',src:['cdc2','nhsTalk']},
 {id:'m1-smile',area:'social',title:'Smile hello',dose:'Every time you walk up',
  steps:['When you come to baby, catch their eye and smile big.','Say hello in a happy voice.','Wait for a smile back.'],
  why:'Smiling back and forth builds connection, and social smiles often appear around now.',
  notice:'Does baby smile when you talk or smile at them?',src:['cdc2']},
 {id:'m1-track',area:'visual',title:'Slow toy ride',dose:'1–2 minutes',
  steps:['With baby on their back, hold a bright toy about a foot away.','When they look at it, move it slowly left, then right.','Go slow, and stop if they look away.'],
  why:'Practices following moving things with the eyes.',
  notice:'Do baby\u2019s eyes follow the toy?',src:['cdc4','aap3mo']},
 {id:'m1-mirror',area:'cognitive',title:'Baby in the mirror',dose:'A minute or two',
  steps:['Hold baby in front of a mirror, or prop a baby-safe mirror near them during floor time.','Point and say, "Who\u2019s that? That\u2019s you!"','Make a funny face and see what they do.'],
  why:'Mirrors are fascinating to babies and help them start to learn who they are.',
  notice:'Does baby look at the face in the mirror for a few seconds?',src:['cdc2','ztt']},
 {id:'m1-pictures',area:'visual',title:'Look at faces and colors',dose:'A few minutes',
  steps:['Show baby a book or photo with bright colors or faces.','Point to one thing and talk about it.','Let baby look as long as they like.'],
  why:'Bright pictures and faces hold attention and give you things to talk about.',
  notice:'Does baby look at a picture for several seconds?',src:['cdc2','aap3mo']},
 {id:'m1-bath',area:'sensory',title:'Talk through bath time',dose:'At the next bath',
  steps:['During a bath or wipe-down, talk about the water and how it feels.','Name body parts as you wash them.','Keep one hand on baby the whole time.'],
  why:'New feelings plus your words connects touch with language.',
  notice:'How does baby react to warm water on their skin?',safety:'Never leave baby alone in or near water, even for a moment.',src:['nhsTalk','cdc2']},
 {id:'m1-calm',area:'social',title:'Calm-down practice',dose:'When baby is upset',
  steps:['When baby cries, stay calm yourself first.','Hold, rock, sing or talk softly.','Offer fingers or a pacifier if that helps.'],
  why:'Babies learn to calm down by being calmed by you, over and over.',
  notice:'Does baby calm when spoken to or picked up?',src:['cdc2']},
 {id:'m1-routine',area:'independence',title:'Same steps each time',dose:'At bedtime or naptime',
  steps:['Pick a short, simple routine: diaper, song, cuddle, into bed.','Do it the same way each time.','Lay baby on their back in their own sleep space.'],
  why:'Routines help baby learn what comes next, which builds confidence.',safety:'Back to sleep, on a firm, flat surface with nothing else in the crib.',src:['cdc2','aapSleep','aapBooks']}
];

/* ---------- 2 to 3 months: cooing, reaching, moving ---------- */
const B3=[
 {id:'m2-tummy',area:'physical',title:'Tummy time with toys',dose:'Several times today, longer as baby enjoys',times:3,tummy:true,
  steps:['Lay baby on their tummy on the floor while they\u2019re awake.','Place a few toys at eye level, some just out of reach.','Lie down facing them and talk.'],
  why:'Builds the strength baby needs to push up on their arms and, later, roll.',
  notice:'Does baby push up on their forearms?',safety:'tummy',src:['aapTummy','cdc4']},
 {id:'m2-chat',area:'language',title:'Coo conversations',dose:'A few minutes',
  steps:['Face baby and wait for a coo or "aah."','Answer with excitement: "Oh really? Tell me more!"','Pause and let them reply.'],
  why:'Responding to baby\u2019s sounds teaches them to take turns talking.',
  notice:'Does baby make sounds back when you talk?',src:['cdc4','cdc2']},
 {id:'m2-swat',area:'physical',title:'Swat and kick',dose:'A few minutes on the floor',
  steps:['With baby on their back, hold a soft toy within reach of their hands.','Let them swing or bat at it.','Try one near their feet so they can kick it.'],
  why:'Reaching and kicking build coordination between eyes, hands and feet.',
  notice:'Does baby swing an arm at the toy?',src:['cdc4']},
 {id:'m2-exercise',area:'physical',title:'Bicycle song',dose:'A minute or two',
  steps:['With baby on their back, sing a song.','Gently bend and stretch their arms and legs in time with it.','Keep movements slow and soft.'],
  why:'A playful way for baby to feel their body move while hearing your voice.',
  notice:'Does baby smile or kick along?',src:['cdc4']},
 {id:'m2-track',area:'visual',title:'Up, down, side to side',dose:'1–2 minutes',
  steps:['Show baby a brightly colored toy.','Move it slowly left to right, then up and down.','Watch their eyes follow.'],
  why:'Eyes are now getting better at tracking moving things.',
  notice:'Does baby follow the toy across the middle?',src:['cdc4','aap3mo']},
 {id:'m2-scarf',area:'sensory',title:'Feel the breeze',dose:'A minute or two',
  steps:['During tummy time, wave a light scarf above baby and say "Feel the wind!"','Let it float gently onto their back, then slide it off.','Wave it in front so they can follow it with their eyes.'],
  why:'A gentle new feeling makes tummy time more fun and adds something to watch.',
  notice:'Does baby react to the soft touch?',safety:'Take the scarf away when you\u2019re done.',src:['ztt']},
 {id:'m2-hands',area:'cognitive',title:'Discover hands',dose:'Whenever baby\u2019s awake',
  steps:['Let baby look at and suck on their own hands.','Gently touch each finger and count: "One, two, three…"','Put a light rattle in their hand.'],
  why:'Babies learn about their bodies by watching and mouthing their own hands.',
  notice:'Does baby look at their hands with interest?',src:['cdc4']},
 {id:'m2-likes',area:'social',title:'What does baby love?',dose:'Throughout the day',
  steps:['Pay attention to what makes baby smile, and what upsets them.','Do more of what they enjoy.','Share your discoveries with the other caregivers.'],
  why:'Knowing baby\u2019s likes helps everyone respond in ways that make them feel good.',
  notice:'What made baby smile today?',src:['cdc4']},
 {id:'m2-floor',area:'independence',title:'Floor play every day',dose:'A little time, a few times today',
  steps:['Put baby on a play mat or blanket on the floor while awake.','Keep safe toys nearby.','Try not to keep baby in swings or bouncy seats for too long.'],
  why:'Floor time gives baby room to move, learn and explore on their own.',src:['cdc4','aapTummy']}
];

/* ---------- 3 to 4 months: grasping, laughing, cause and effect ---------- */
const B4=[
 {id:'m3-tummy',area:'physical',title:'Tummy time reach',dose:'Several times today',times:3,tummy:true,
  steps:['Lay baby on their tummy on the floor while awake.','Place toys in a circle around them, some just out of reach.','Encourage them to reach for one.'],
  why:'Reaching in different directions builds the muscles for rolling and, later, crawling.',
  notice:'Does baby push up on elbows and reach?',safety:'tummy',src:['aapTummy','cdc4']},
 {id:'m3-grasp',area:'physical',title:'Hold and shake',dose:'A few minutes',
  steps:['Put an easy-to-hold rattle in baby\u2019s hand.','Show them how it sounds.','Let them explore it, mouthing included.'],
  why:'Holding and shaking builds grip and shows baby they can make things happen.',
  notice:'Does baby hold the toy when you put it in their hand?',safety:'Only toys too big to choke on, with no sharp edges.',src:['cdc4']},
 {id:'m3-peek',area:'cognitive',title:'Peek-a-boo',dose:'A few rounds',
  steps:['Cover your eyes with your hands.','Uncover and say "Peek-a-boo!" with a big smile.','Watch for baby\u2019s smile.'],
  why:'A classic game that builds attention and, over time, the idea that things come back.',
  notice:'Does baby smile or chuckle?',src:['cdc4']},
 {id:'m3-giggle',area:'social',title:'Chuckle time',dose:'A few minutes',
  steps:['Try gentle tickles, funny faces or silly sounds.','See what gets a chuckle.','Stop if baby turns away.'],
  why:'Shared laughter builds connection and shows baby you\u2019re tuned in.',
  notice:'Does baby smile on their own to get your attention?',src:['cdc4']},
 {id:'m3-name',area:'language',title:'Use baby\u2019s name',dose:'Throughout the day',
  steps:['Say baby\u2019s name often while you talk to them.','"Are you ticklish, (name)?"','Smile when they look at you.'],
  why:'Hearing their name often helps baby learn it over the coming months.',
  notice:'Does baby turn toward your voice?',src:['cdc4']},
 {id:'m3-bounce',area:'physical',title:'Lap bounce',dose:'A minute or two',
  steps:['Hold baby securely under the arms with their feet on your lap.','Let them gently bounce up and down.','Sing along.'],
  why:'Lets baby feel their weight on their feet and enjoy movement with you.',
  notice:'Does baby hold their head steady?',src:['cdc4']},
 {id:'m3-quiet',area:'language',title:'Quiet book time',dose:'A few minutes',
  steps:['Choose a cloth book with colorful pictures.','Let baby touch it while you point and name things.','Use different voices.'],
  why:'Books give baby new words and quiet one-on-one time with you.',
  notice:'Does baby touch the book or kick in excitement?',src:['cdc4','aapBooks']},
 {id:'m3-textures',area:'sensory',title:'Texture tour',dose:'A few minutes',
  steps:['Gather a few safe fabrics: soft, fuzzy, smooth, crinkly.','Gently bring baby\u2019s hand to each one.','Name how it feels: "Soft!" "Bumpy!"'],
  why:'New textures build body awareness and give you words to share.',
  notice:'Which texture does baby seem to like?',src:['ztt','nhsTalk']},
 {id:'m3-explore',area:'independence',title:'Safe things to explore',dose:'During floor play',
  steps:['Lay out a few safe toys within reach.','Let baby choose one and explore it, mouth too.','Stay close and watch.'],
  why:'Mouthing and choosing toys is how babies learn about the world.',safety:'Nothing sharp, hot or small enough to choke on.',src:['cdc4']},
 {id:'m3-circles',area:'visual',title:'Colors and circles',dose:'A few minutes',
  steps:['Show baby a toy or picture with bright colors, bull\u2019s-eyes or spirals.','Hold it still, then move it slowly.','Try one a little further away. Baby can now see across the room.'],
  why:'Baby\u2019s eyesight is growing fast, and round patterns and colors are especially interesting now.',
  notice:'Which colors or patterns hold baby\u2019s attention?',src:['aap3mo']}
];

/* ---------- 4 to 6 months: rolling, laughing, babbling ---------- */
const B5=[
 {id:'m4-roll',area:'physical',title:'Roll for it',dose:'A few times today',times:2,tummy:true,
  steps:['Put baby on their tummy or back on the floor, while awake.','Place a favorite toy just out of reach to one side.','Cheer them on as they twist or roll toward it.'],
  why:'Reaching to the side encourages rolling over.',
  notice:'Does baby roll from tummy to back?',safety:'tummy',src:['cdc6','aapTummy']},
 {id:'m4-sit',area:'physical',title:'Supported sitting',dose:'A few minutes',
  steps:['Sit baby between your legs or in your lap, holding them steady.','Put toys in front for them to look at.','Let them practice balancing, with you close.'],
  why:'Helps baby practice balance and leaning on their hands.',
  notice:'Does baby lean on their hands to support themselves?',src:['cdc6']},
 {id:'m4-turns',area:'language',title:'Back-and-forth play',dose:'A few minutes',
  steps:['When baby smiles, smile back. When they make a sound, copy it.','Try a raspberry and see if they blow one back.','Wait for their turn.'],
  why:'Taking turns teaches the rhythm of conversation.',
  notice:'Does baby take turns making sounds with you?',src:['cdc6']},
 {id:'m4-name',area:'visual',title:'Name what baby sees',dose:'On a walk or around the house',
  steps:['When baby looks at something, point to it.','Name it: "That\u2019s a tree. A big green tree."','Follow their gaze to the next thing.'],
  why:'Naming what baby is interested in builds understanding of words.',
  notice:'Does baby look where you point?',src:['cdc6','nhsTalk']},
 {id:'m4-mirror',area:'social',title:'Mirror smiles',dose:'A minute or two',
  steps:['Sit with baby in front of a mirror.','Wave, smile and say their name.','Hide out of view, then pop back: "Peek-a-boo!"'],
  why:'Babies this age love looking at themselves, and it builds social play.',
  notice:'Does baby smile at themselves?',src:['cdc6','zttLang']},
 {id:'m4-drop',area:'cognitive',title:'Drop and give back',dose:'A few rounds',
  steps:['When baby drops a toy, pick it up and give it back.','Say "Uh-oh! Here it is!"','Repeat as long as it\u2019s fun.'],
  why:'This simple game teaches cause and effect.',
  notice:'Does baby reach to grab a toy they want?',src:['cdc6']},
 {id:'m4-sounds',area:'sensory',title:'New sounds',dose:'A few minutes',
  steps:['Try whispering, clapping or a funny noise.','Pause between each one.','See which sound baby likes best.'],
  why:'Different sounds spark curiosity and listening.',
  notice:'Does baby squeal or laugh?',src:['cdc6']},
 {id:'m4-read',area:'language',title:'Picture book chat',dose:'A few minutes, every day',
  steps:['Look at a colorful book together.','Talk about the pictures.','When baby babbles, answer: "Yes, that\u2019s the doggy!"'],
  why:'Daily reading builds vocabulary and a love of books.',
  notice:'Does baby pat the pictures?',src:['cdc6','aapBooks']},
 {id:'m4-soothe',area:'independence',title:'Comfort and calm',dose:'When baby is upset',
  steps:['Talk softly, hold or rock baby.','Offer a favorite toy or let them suck on fingers or a pacifier.','Give them a moment to settle in your arms.'],
  why:'With your help, baby learns they can calm down.',
  notice:'What helps baby calm down fastest?',src:['cdc6']}
];

/* ---------- 6 to 9 months: moving, object permanence, problem solving ---------- */
const B6=[
 {id:'m6-crawl',area:'physical',title:'Come and get it',dose:'A few times today',
  steps:['Place a toy on the floor a little out of reach.','Encourage baby to crawl, scoot or roll to it.','Celebrate when they get there!'],
  why:'Motivates baby to move and builds strength for crawling.',
  notice:'How does baby get around: rolling, scooting or crawling?',src:['cdc9','ztt']},
 {id:'m6-hide',area:'cognitive',title:'Hide the toy',dose:'A few rounds',
  steps:['Let baby watch you hide a toy under a cloth.','Ask "Where did it go?"','Let them find it, or lift the cloth together.'],
  why:'Teaches that things still exist when out of sight.',
  notice:'Does baby look for a toy that has disappeared?',src:['cdc9','cdc12']},
 {id:'m6-babble',area:'language',title:'Babble to words',dose:'A few minutes',
  steps:['When baby says "bababa," repeat it back.','Then add a word that starts the same: "ball!"','Keep it playful.'],
  why:'Connects baby\u2019s own sounds to real words.',
  notice:'Does baby make lots of different sounds like "mamama" or "bababa"?',src:['cdc9']},
 {id:'m6-wave',area:'language',title:'Wave bye-bye',dose:'Every time someone leaves',
  steps:['Wave and say "bye-bye" when people come and go.','Help baby wave their hand too.','Try a simple sign, like "more," at meals.'],
  why:'Gestures help baby communicate before they have words.',
  notice:'Does baby lift their arms to be picked up?',src:['cdc9']},
 {id:'m6-dump',area:'cognitive',title:'Dump and fill',dose:'A few minutes',
  steps:['Give baby a container with a few big blocks.','Dump them out together.','Put them back in, one at a time.'],
  why:'Emptying and filling is early problem-solving.',
  notice:'Does baby bang two things together?',safety:'Use blocks too big to fit in baby\u2019s mouth.',src:['cdc9']},
 {id:'m6-myturn',area:'social',title:'My turn, your turn',dose:'A few rounds',
  steps:['Pass a toy to baby: "Your turn!"','Ask for it back: "My turn!"','Keep passing it back and forth.'],
  why:'Builds turn-taking, a key social skill.',
  notice:'Does baby move a toy from one hand to the other?',src:['cdc9','zttLang']},
 {id:'m6-feelings',area:'social',title:'Name the feeling',dose:'Throughout the day',
  steps:['When baby shows a feeling, name it: "You\u2019re sad."','Show it on your face too.','Comfort them: "Let\u2019s see if we can feel better."'],
  why:'Naming feelings helps baby start to understand them.',
  notice:'What different faces does baby make: happy, sad, surprised?',src:['cdc9']},
 {id:'m6-bye',area:'independence',title:'Cheerful goodbyes',dose:'When you leave the room or go out',
  steps:['Say a quick, cheerful goodbye instead of sneaking away.','When you come back, say so: "I\u2019m back!"','Keep it short and warm.'],
  why:'Baby learns what to expect, which builds trust and confidence.',
  notice:'Does baby react when you leave?',src:['cdc9']},
 {id:'m6-explore',area:'independence',title:'Safe space to explore',dose:'Daily floor time',
  steps:['Set up a baby-safe area on the floor.','Let baby move around and choose what to play with.','Stay close so they know you\u2019re near.'],
  why:'Freedom to explore safely builds curiosity and confidence.',safety:'Move sharp or breakable things out of reach and lock away medicines and cleaning products.',src:['cdc9']},
 {id:'m6-book',area:'language',title:'Point and name',dose:'A few minutes',
  steps:['Look at a book with pictures of everyday things.','Point to one and name it.','Follow baby\u2019s lead if they want to turn the page.'],
  why:'Naming pictures builds vocabulary.',
  notice:'Does baby pat or point at pictures?',src:['cdc9','aapBooks']},
 {id:'m6-feet',area:'sensory',title:'Texture feet',dose:'A few minutes',
  steps:['Lay out a few different fabrics: a towel, something fuzzy, a silky scarf.','Hold baby upright so their feet touch each one, or let them crawl across.','Name each feeling: "Soft! Scratchy!"'],
  why:'Different textures build body awareness and new words.',
  notice:'Which texture does baby prefer?',src:['ztt']},
 {id:'m6-describe',area:'visual',title:'Describe what they see',dose:'Throughout the day',
  steps:['Notice what baby is looking at.','Describe it simply: "A red, round ball."','Hold it closer so they can see and touch it.'],
  why:'Matching words to what baby sees builds attention and understanding.',
  notice:'Does baby look when you call their name?',src:['cdc9']}
];

/* ---------- 9 to 12 months: early words, imitation, independence ---------- */
const B7=[
 {id:'m9-cruise',area:'physical',title:'Cruise to the couch',dose:'A few times today',
  steps:['Place baby near something sturdy they can pull up on safely, like a couch.','Put a toy a little further along.','Cheer as they step sideways to get it.'],
  why:'Pulling up and cruising builds strength and balance for walking.',
  notice:'Does baby pull up to stand or walk holding on?',safety:'Baby walkers aren\u2019t recommended. Let baby practice on their own.',src:['cdc12','ztt']},
 {id:'m9-push',area:'physical',title:'Push it along',dose:'A few minutes',
  steps:['Give baby a sturdy empty box or push toy.','Let them push it across the floor.','Stay close for wobbles.'],
  why:'Pushing things lets baby practice walking steps with support.',src:['cdc12']},
 {id:'m9-point',area:'language',title:'Answer the point',dose:'Every time baby points',
  steps:['When baby points, put it into words: "You want the cup?"','Hand it over: "Here\u2019s your cup."','Celebrate any attempt to say the word.'],
  why:'Responding to pointing shows baby that communicating works.',
  notice:'Does baby say "mama," "dada" or another special name?',src:['cdc12']},
 {id:'m9-expand',area:'language',title:'Build on their words',dose:'Throughout the day',
  steps:['When baby says "ta," say "Yes, a truck!"','Add a little more: "A big, blue truck."','Keep it simple and happy.'],
  why:'Adding to baby\u2019s words helps them learn new ones.',src:['cdc12']},
 {id:'m9-cup',area:'cognitive',title:'In the cup',dose:'A few minutes',
  steps:['Give baby a cup and a few big blocks.','Show how to drop one in.','Let them try, then tip them out together.'],
  why:'Putting things in containers is a new thinking skill around this age.',
  notice:'Does baby put something in a container?',safety:'Use blocks too big to fit in baby\u2019s mouth.',src:['cdc12']},
 {id:'m9-patacake',area:'social',title:'Pat-a-cake',dose:'A few rounds',
  steps:['Sing pat-a-cake and clap baby\u2019s hands with yours.','Try "So big!" and lift their arms up high.','Pause to see if baby starts it themselves.'],
  why:'Action games build imitation, memory and fun together.',
  notice:'Does baby play along or wave bye-bye?',src:['cdc12','ztt']},
 {id:'m9-music',area:'sensory',title:'Kitchen band',dose:'A few minutes',
  steps:['Give baby a pot and a wooden spoon.','Bang out a rhythm together.','Try loud and soft.'],
  why:'Making noise teaches cause and effect and is great fun.',src:['cdc12']},
 {id:'m9-hands',area:'independence',title:'Pick it up',dose:'During play',
  steps:['Offer a few safe things to pick up and put down.','Let baby try on their own before helping.','Celebrate their effort.'],
  why:'Practice with fingers builds the fine grip babies develop around a year.',
  notice:'Does baby pick things up with thumb and pointer finger?',safety:'Nothing small enough to choke on.',src:['cdc12']},
 {id:'m9-flap',area:'cognitive',title:'Lift-the-flap books',dose:'A few minutes',
  steps:['Choose a book with flaps or textures.','Let baby lift the flaps and find what\u2019s underneath.','Ask "Where\u2019s the dog?" even before they can answer.'],
  why:'Flaps and questions build curiosity and the start of conversation.',src:['cdc12','aapBooks']},
 {id:'m9-gentle',area:'social',title:'Show the way',dose:'When baby needs guidance',
  steps:['Show baby what you want them to do, like petting gently.','Praise with words and hugs when they do it.','Save "no" for things that are dangerous.'],
  why:'Positive guidance teaches baby what to do, not just what not to do.',src:['cdc12']},
 {id:'m9-lookthere',area:'visual',title:'Look over there!',dose:'On a walk or at the window',
  steps:['Point to something interesting: a bus, a dog, a bird.','Say "Look! A dog!" and watch where baby looks.','Give them time to find it.'],
  why:'Following your point helps baby pay attention to what others are showing them.',
  notice:'Does baby look where you point?',src:['cdc12']}
];

const BANDS=[
  {id:'0-2w',label:'Weeks 0\u20132',from:0,to:13,focus:'Bonding, closeness and calm',items:B0},
  {id:'2-4w',label:'Weeks 2\u20134',from:14,to:27,focus:'Looking, listening and head control',items:B1},
  {id:'1-2m',label:'1\u20132 months',from:28,to:59,focus:'Smiles, tracking and first "talking"',items:B2},
  {id:'2-3m',label:'2\u20133 months',from:60,to:89,focus:'Cooing, reaching and moving',items:B3},
  {id:'3-4m',label:'3\u20134 months',from:90,to:119,focus:'Grasping, laughing and cause and effect',items:B4},
  {id:'4-6m',label:'4\u20136 months',from:120,to:181,focus:'Rolling, exploring and babbling',items:B5},
  {id:'6-9m',label:'6\u20139 months',from:182,to:273,focus:'Moving, finding and problem-solving',items:B6},
  {id:'9-12m',label:'9\u201312 months',from:274,to:365,focus:'Early words, copying and independence',items:B7}
];

function bandFor(ageDays){return BANDS.find(b=>ageDays>=b.from&&ageDays<=b.to)||null}

// Pick today's 2-3 moments. Tummy time (when the band has it) is every day;
// the rest rotate day to day so it doesn't feel repetitive.
function pick(ageDays,count){
  count=count||3;const b=bandFor(ageDays);if(!b)return null;
  const anchor=b.items.find(x=>x.tummy),rest=b.items.filter(x=>x!==anchor);
  const need=anchor?count-1:count,out=anchor?[anchor]:[];
  const L=rest.length,start=(ageDays*need)%L,lap=Math.floor(ageDays*need/L);
  let step=1+(lap%(L-1));if(L%step===0&&need>1&&step>1&&(need*step)%L===0)step=1; // vary pairings each lap, never repeat
  for(let i=0;i<need&&i<L;i++){const x=rest[(start+i*step)%L];if(!out.includes(x))out.push(x);else out.push(rest[(start+i)%L])}
  return {band:b,items:out};
}
function byId(id){for(const b of BANDS){const x=b.items.find(i=>i.id===id);if(x)return x}return null}
// Tummy time sessions a day for the goals card (AAP: 2-3 short sessions to start, growing over time)
function tummyTarget(ageDays){const b=bandFor(ageDays);if(!b)return null;const t=b.items.find(x=>x.tummy);return t?(t.times||1):null}

window.LD_MOMENTS={SOURCES,AREAS,SAFETY,BANDS,bandFor,pick,byId,tummyTarget};
})();
