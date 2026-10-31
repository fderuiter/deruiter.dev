import type { FieldManualData } from "./types";

export const GARMIN_WATCH_MANUAL: FieldManualData = {
  id: "garmin-watch",
  title: "Monkey C Mayhem",
  subtitle: "A Garmin 5K Platformer",
  genre: "Embedded Systems",
  badge: "Monkey C Mayhem",
  route: "/arcade/garmin-watch",
  storageKey: "garmin_simulator_high_score",
  accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  objective:
    "Run a 5K: five 1 km stages on three lives. Each run starts with Waiting for GPS… and then GO. Stomp Couch Potatoes, jump Hurdles, bump Sync Blocks, and keep your Body Battery above zero on the way to each finish pole. Clear stage 5 to finish the 5K. Your high score is saved on this device.",
  quickSummary:
    "Press Enter to start. Up or Space jumps (hold for height), Right sprints, Left eases to a jog. Stomp Couch Potatoes and Snooze Buttons, and jump the Hurdles. Bump Sync Blocks for power-ups, press X to throw heat bolts or spin the Compression Cape, and keep your Body Battery above zero.",
  controls: [
    {
      action: "Start & Pause",
      description:
        "Enter starts a run, which opens with Waiting for GPS…, and pauses or resumes it. P or Esc also pause and resume. The pause screen says AUTO PAUSE.",
      key: "Enter / P / Esc",
    },
    {
      action: "Jump",
      description:
        "Tap for a short hop, hold for a full jump. Hold longer to clear the Hurdles and the gaps.",
      key: "↑ / Space",
    },
    {
      action: "Sprint & Jog",
      description:
        "Hold Right to sprint. Sprinting drains Body Battery faster. Hold Left to ease to a jog, which rests you and recharges Body Battery.",
      key: "→ / ←",
    },
    {
      action: "Action (Heat Map & Cape)",
      description:
        "With a Heat Map, throws a heat bolt along the track. With the Compression Cape, spins to knock foes aside. Both work on Couch Potatoes, Snooze Buttons and Kettlebells. With neither, pressing it in mid-air does a Spin Jump. Stand beside a medicine ball to pick it up, then press again to throw it forward; a ball in hand is thrown before anything else. In Dev Mode, Backspace and G force garbage collection instead.",
      key: "X / Backspace / G",
    },
    {
      action: "Glide & Take Off (Compression Cape)",
      description:
        "With the Compression Cape, hold jump while falling to glide down slowly. Sprint to fill the pace meter; a full meter lets you take off.",
      key: "Hold ↑ / Space",
    },
    {
      action: "Restart Race",
      description:
        "In Race Mode, Backspace while paused restarts the race on the same course.",
      key: "Backspace (paused race)",
    },
    {
      action: "Training Plan Map",
      description:
        "On the Morning Report and the map, the arrow keys move between workouts, Space or Enter starts the highlighted one, X opens the gear bag, and Esc or Backspace goes back.",
      key: "Arrows / Space / Enter / X / Esc",
    },
    {
      action: "Backlight",
      description:
        "Turns the watch backlight on or off. In Dev Mode the backlight drains the watch battery.",
      key: "L",
    },
    {
      action: "Down (Water Station & Burpee Slam)",
      description:
        "Standing on a Water Station with a down arrow over it, Down takes you into its bonus room. In a fitness run, pressing Down in mid-air is a Burpee Slam that drops you straight down. Anywhere else it does nothing in a normal run; in Dev Mode it pops the oldest heap variable.",
      key: "↓",
    },
    {
      action: "Wipe Fog (Dev Mode Only)",
      description:
        "Only in Dev Mode, where thermal fog builds up. Drag across the watch face to wipe where you drag. Normal runs have no fog to wipe.",
      key: "W / Drag Across Screen",
    },
  ],
  rules: [
    {
      title: "Scoring",
      detail:
        "Stomps, Kudos, power-ups, foes beaten by a heat bolt, a cape spin or a Runner's High, and stage clears all add points. The Rep Max pays 2,000. Pass your best score mid-run and the watch flashes NEW PR! Your best score is saved on this device.",
      badge: "High Score",
    },
    {
      title: "Foes",
      detail:
        "Couch Potatoes and Snooze Buttons walk toward you. Stomp them from above; a Snooze Button pays double. Hurdles are spiked: jump over them, and never land on one.",
      badge: "Foes",
    },
    {
      title: "Burpee Slam",
      detail:
        "In a fitness run, press Down in mid-air to slam straight down. Landing on a foe below stomps it, and landing on a PR Board or brick breaks it. A slam costs a little Body Battery. You cannot slam underwater.",
      badge: "Slam",
    },
    {
      title: "Wall Jump",
      detail:
        "Slide down the side of a Water Station or a Plyo Box, and press jump on the way down to leap off it. You get one wall jump per contact with a wall: leave the wall or land to get another. Sliding down a wall slows your fall.",
      badge: "Wall",
    },
    {
      title: "Spin Jump",
      detail:
        "In mid-air with neither a Heat Map nor a Compression Cape, press the action key for a slower, floatier jump. Bouncing off a spiky foe, such as a Move Alert or a Jellyfish, sends you back up without harm. A spin does not break blocks.",
      badge: "Spin",
    },
    {
      title: "Running Buddy",
      detail:
        "Bump a rare Sync Block to hatch a Running Buddy, a dog on a leash. Good boy! You ride it: you jump a little higher, and it eats the small foes it runs into (Kettlebells, Move Alerts, Box Jumpers and Auto Laps) for 200 points, with no harm to you. Stomps from above still work. A hit while riding costs the buddy, not your power tier: it runs off ahead, and a sprint can catch it again for three seconds. A buddy waits outside a Water Station's bonus room, and does not carry over to the next stage.",
      badge: "Buddy",
    },
    {
      title: "Medicine Ball",
      detail:
        "Medicine balls lie on the track of the land stages. Stand beside one and press the action key to pick it up, with a Med ball! call-out the first time in a run. A carried ball slows the pace meter's fill, like running with a weight. Press the action key again to throw it forward. A thrown ball knocks out the first foe it hits and breaks a brick, then stops; a ball that lands without hitting anything rests where it stops, ready to pick up again. A hit drops the ball you carry at your feet.",
      badge: "Med Ball",
    },
    {
      title: "Aid Station",
      detail:
        "Halfway along each stage stands an Aid Station: a small table with a cup and a flag pole. Run past it and its flag flies green, with an Aid station! toast. Lose a life after that and you restart at the Aid Station, not at the start of the stage. Until you touch it, its flag hangs grey. A stage clear puts the Aid Station away for the next stage.",
      badge: "Aid",
    },
    {
      title: "Finisher Medals",
      detail:
        "Each stage hides three Finisher Medals, gold discs on a two-tone ribbon. One may sit inside a PR Board, so break the board to get it. One may wait in a Water Station's bonus room, and the rest float over a ledge, a block row or the lane, so jump for them. Grab one to score 500 points. Three slots at the top of the face show the stage's medals: gold when found. A medal is found once per run, and it stays found when a lost life lays the stage out again. The run-over screen tallies your MEDALS, out of 15.",
      badge: "Medals",
    },
    {
      title: "Secret Exits",
      detail:
        "Some stages hide a second finish pole at the far end of a Water Station's bonus room, past the Aid Station. Grab it to clear the stage early and skip the rest of the course to the next stage. Any medal you still need sits before that station. Each secret exit you find is recorded for the run and shown as SECRET EXITS on the run-over screen. Stage 5 has none.",
      badge: "Exits",
    },
    {
      title: "Second Wind",
      detail:
        "Some stages hide a Second Wind in one of their Sync Blocks. Bump it to start a 15-second event that remixes the stage, then everything snaps back. Hill Repeats tilts the lane into climbs and descents: run 100 m to clear it. Taper Week eases gravity so every jump floats: grab 6 Kudos. Fun Run turns the foes into cheering fans, and touching one is a high five that hands out a Kudos instead of a hit: high-five 2 fans. Night Run leaves only a headlamp cone lit: take no hits. Clearing an event pays out the Finisher Medal its block holds, with a Second Wind! toast. A lost life or a stage clear ends the event early, and its medal waits for another run.",
      badge: "Wind",
    },
    {
      title: "Course Foes",
      detail:
        "Each stage adds its own gym foes. A Kettlebell tips over when you stomp it, then slides when you touch or kick it, and a sliding kettlebell flattens anything in its path. A Move Alert (the watch nagging you to move) flies in waves; stomp it to clip its wings. A Box Jumper hops toward you on a timer. An Auto Lap is a lap timer that buzzes lap pings at you while it is on screen. The Rep Max, a gym bro who lobs dumbbells, waits on stages 3 and 5. It takes three stomps or six hits, and pays 2,000.",
      badge: "Foes",
    },
    {
      title: "The Course",
      detail:
        "Each 1 km stage has gaps in the track, one-way ledges you can jump up through, and rows of blocks. Bump a Sync Block from below to release a power-up or a Kudos. Grab the finish pole to clear the stage. Clearing stage 5 completes the 5K.",
      badge: "5K",
    },
    {
      title: "Course Pieces",
      detail:
        "Water Stations are aid tables you jump onto; their sides stop you. One with a down arrow over it opens a bonus room full of Kudos when you press Down on it, and you come out further along the course. A Rest Day ends when you go in. Plyo Boxes spring you up when you land on them, and higher if you hold jump. Treadmill Belts slide back and forth over gaps and carry you while you stand on them. Stomp a Rest Day Switch and for 8 seconds the bricks turn into Kudos and the Kudos into bricks, until REST DAY OVER. The first Plyo Box, Treadmill Belt and current you meet in a run are named on the face, and read out. The bricks are PR Boards: Buff or stronger, you break them from below for a NEW PR! bonus.",
      badge: "Course",
    },
    {
      title: "Pool & Open Water",
      detail:
        "Stages 2 and 4 are swum, not run. Each tap of jump (Up or Space) is a stroke that pulls you toward the surface; between strokes you sink. Wading along the bottom is slow and the water foes sit low too, so keep stroking. Each pool length is 25 metres, and a stage is 40 lengths: the LENGTH readout counts them off on the face. A gap in the pool floor is a deep end: you can sink into it, its far wall stops you, and you stroke up and out over the edge; sink past the bottom of the face and you lose a life. Open water has currents, marked by teal chevrons, that carry you with the flow or hold you back against it. Orange buoys with a white stripe mark the swim line along the open water; you can climb onto one for a breather as it bobs. Bonus rooms stay on dry land.",
      badge: "Water",
    },
    {
      title: "Basement Gym",
      detail:
        "Stage 3 is the Basement Gym, with low squat racks hanging over the lane. Duck under the bar and keep your jumps low: a rising runner that meets a rack's underside bonks off it and drops back down. No bug comes at you under a rack, so a rack is never a trap. Big forms get hurt. A runner taller than Base, such as a Buff monkey or one with a Heat Map or Cape, that ends up under a rack takes a hit. Fluorescent strips run overhead as you pass.",
      badge: "Gym",
    },
    {
      title: "Tri Suit",
      detail:
        "A Tri Suit is the swimmer's power-up. It comes out of the second power Sync Block on a water stage. The Tri Suit strokes faster and sinks more slowly in the water, so it is the fast way down the pool. On land it is a clumsy hopper: its take-off is a short, low hop that ignores a full pace meter. It stays at Base height, and it comes off at the transition when the next stage is back on land.",
      badge: "Tri Suit",
    },
    {
      title: "Water Foes",
      detail:
        "The water has its own foes. A Jellyfish drifts through the water on a bob, and it cannot be stomped: go around it, or get stung. Lost Goggles come in pairs, sinking and rising in the water column.",
      badge: "Foes",
    },
    {
      title: "Power-ups & Lives",
      detail:
        "Sync Blocks give four power-ups. A Protein Shake makes the monkey Buff: taller, and able to take one hit. A Heat Map lets you throw heat bolts with X. A Compression Cape lets you glide and take off. A Runner's High makes you invincible for a short time, and flattens anything you run into. A hit drops you back to Base. At Base, a hit costs a life. You start with three lives.",
      badge: "Lives",
    },
    {
      title: "Body Battery",
      detail:
        "Body Battery replaces the watch battery. It drains while you run on the ground, and a sprint drains it faster wherever you are: on the ground, in the air or in the water. A hit costs 15. Kudos add 2, and power-ups and stage clears add 25. A Runner's High fills it. Ease to a jog on the ground to recharge it. At 0 you bonk: you can't sprint until it recovers to 25, and it recharges at a steady pace as well as a jog. RECOVERED · SPRINT IS BACK tells you when the bonk is over. Sprinting the whole 5K bonks you about three times; sprinting only while the gauge reads MED or better keeps you clear. It never ends a run.",
      badge: "Body Battery",
    },
    {
      title: "Training Effect & Status",
      detail:
        "Each stage clear scores a Training Effect from 0.0 to 5.0, shown with a label such as TE 3.4 · Improving. Game over shows your Training Status, from Unproductive to Peaking, and a recovery time in hours.",
      badge: "Training",
    },
    {
      title: "Run Clock & Splits",
      detail:
        "The run clock counts game time from GPS lock. It stops when you pause and when the run ends. Each 1 km stage clear is an auto lap, and its banner shows that lap's split: green when it is a best split for that lap, amber when it is slower. The banner also calls your pace: WORLD RECORD PACE for a lap under 43 seconds, NEGATIVE SPLIT when a lap beats the one before, and POSITIVE SPLIT · EASE UP when it is more than 5% slower. The result card shows your finish time, your average pace and a splits table against your previous bests, with a Negative split note and New best time when you beat your best total. Bests are saved per watch on this device. Sprinting buys time but drains Body Battery, and a bonk costs more time than it saves.",
      badge: "Splits",
    },
    {
      title: "Watch Messages",
      detail:
        "The watch talks back. Stomp chains, power-ups, hits, 1UPs, stage clears and the Rep Max each pop a short message, such as NEGATIVE SPLIT, CARB LOADED, DID YOU EVEN SYNC? and NEVER SKIP LEG DAY. Ease off (hold Left) on the ground for six seconds and it buzzes MOVE!",
      badge: "Toasts",
    },
    {
      title: "Race Mode",
      detail:
        "Race Mode is an option in the companion panel, next to Dev Mode. A Training Run lays a random course every time; a race runs the same course every attempt, so times compare. The Saturday 5K is one fixed course. The Daily Workout is a course for the day that changes at local midnight, the same for everyone. Pick a category before the start: 5K Any% (finish as fast as you can), All Kudos (collect every Kudos on the lane), No Gear (finish at Base, with no power-ups, Runner's High or training buddy; Sync Blocks pay Kudos instead), Negative Split (every lap beats the lap before it), or All Medals (find all 15 Finisher Medals). Races run with Dev Mode off, every random choice comes from the course seed, and the simulation steps at a fixed 60 times a second, so a fast or slow monitor cannot change the game's speed. A press lands on the next step, so input timing can still vary by one step. While paused in a race, Backspace restarts it on the same course. The Saturday 5K has a coach's time of 5:17.43, set by the balance-pass playtest sprinting the whole course, and the race report shows how far you are from it. Each result lands on this device's top 5 for its course and category, with CR for the first record set on it and PR when you beat that record. Share copies a plain-text result. Nothing goes online.",
      badge: "Race",
    },
    {
      title: "Virtual Partner",
      detail:
        "When a race sets the best time on its board, it is kept as a ghost for that course and category (a Daily Workout ghost lasts its day). The next attempt runs beside a see-through copy of that run, like the pacing partner on a running watch. Under the race line, the gap to it reads in red when you are behind (+0:02.4) and green when you are ahead (-0:01.1), and each lap banner adds the gap at that lap. The ghost is only drawn: it never touches anything and cannot change a result. Turn it on or off, or pick your PR or the course record, in the companion panel; this device keeps one runner, so both are the same run. With reduced motion the ghost has no trail. Ghosts are kept on this device only, and the oldest go first when storage is short.",
      badge: "Ghost",
    },
    {
      title: "Training Plan",
      detail:
        "Pick Training Plan as the run mode for a two-week plan laid out like a coach's calendar. Each visit opens with a Morning Report: your Training Readiness, the next workout, and your lives, continues and gear bag. Then the map: Easy Run, Tempo, Intervals and Long Run sit on paths, and clearing one opens the next. Move with the arrow keys (or UP and DOWN on the watch) and press Space or START to go; every node is also a button in the companion panel. Each workout is one stage, the same every time. A cleared workout can be run again as practice, which shows its time but never changes the plan. A Recovery Hut hides three items: pick one and it goes into the gear bag, which holds 8. Losing every life is a DNF, back to training: a continue refills your lives, and with none left the plan's score is reset instead. The map is never lost. The plan is saved on this device; New plan starts over.",
      badge: "Plan",
    },
    {
      title: "Gear Bag",
      detail:
        "Press X on the Morning Report or the map, or Open gear bag in the companion panel, to open the bag. Pack an item and it goes with your next new workout: a Protein Shake, Heat Map or Compression Cape starts it at that power-up (one per workout), a Runner's High starts as the GPS locks, an Energy Gel refills Body Battery the first time you bonk, and a Pre-Workout holds the pace meter full for the first 6 seconds, up to your first jump. A Rest Day is taken on the map at once: it opens the paths past your next workout without running it. Practice runs and Race Day leave packed gear in place, so every race starts from the Base tier. Packed gear still counts towards the bag's 8, and Unpack puts it back.",
      badge: "Bag",
    },
    {
      title: "Finisher Cards",
      detail:
        "Every finish pole carries a Finisher Card that flips through a Shoe, a Bottle and a Medal. Grab the pole and you keep the card it showed. Three cards pay out: three Shoes earn 2 lives, three Bottles 3 and three Medals 5, each with a badge, and three mixed cards give 1 life. Your cards show under the medal slots at the top of the face. A Training Run keeps its cards for that run, and the Training Plan keeps them between workouts on the map. Race Mode, Race Day and practice runs leave the cards alone. With reduced motion on, the pole shows all three cards standing still, and an outline steps from card to card to mark the one on offer.",
      badge: "Cards",
    },
    {
      title: "Badges and Run History",
      detail:
        "The companion panel keeps a badge case and your last 20 runs, with the day, mode, finish time or DNF, distance, best Training Effect and Kudos of each. Badges are earned once: First 5K, Sub-5 Minute Race, Negative Splitter (every lap faster than the last), Rep Max Slayer, All Kudos and No Gear Finisher (both in Race Mode), Daily Workout Streaks for finishing a run on 3 and 7 days in a row, Couch to 5K (finish the 5K on a day you already took a DNF) and Never Skip Leg Day (clear a stage without sprinting). New badges show on the result card and are read out. First 5K also counts toward the 5K Finisher trophy. Everything stays on this device.",
      badge: "Badges",
    },
    {
      title: "Race Day and The Wall",
      detail:
        "Race Day ends the plan. The lane moves at a steady race pace, so pace keys do nothing, and the run clock times it onto its own Race Day board. Near the end The Wall steps out, and the finish stays out of reach until it falls. It holds ahead of you, then charges down the lane: jump and land on top to hit it, or jump clear to dodge. It takes three hits, and each one changes its pattern: it charges faster, then throws a brick while it holds, then two. Bricks fly low, so a jump clears them. Beat it and reach the finish for the finisher medal.",
      badge: "Boss",
    },
    {
      title: "Dev Mode (Optional)",
      detail:
        "Dev Mode is a toggle in the simulator controls, off by default. It brings back the original firmware challenge: a RAM heap that fills with automatic allocations, Down to pop variables, forced garbage collection that freezes the watch, NV flash that fills up, a battery that drains with thermal fog you wipe with W, and crash reports such as Null Pointer, Watchdog Tripped, Stack Overflow, Out Of Memory, Out Of Storage and Segmentation Fault. Each device tier has its own RAM limit: Fēnix 5 has 32 KB, Forerunner 245 has 64 KB, and Edge 1030 has 128 KB.",
      badge: "Optional",
    },
    {
      title: "Telemetry",
      detail:
        "The companion panel samples each run once per second of play. Download it as a CSV with every metric, or a FIT file with heart rate and distance only (a simulator file, not a Garmin Connect upload).",
      badge: "Data",
    },
  ],
  proTips: [
    "Stomp Couch Potatoes from above. They never see it coming.",
    "Jump early over the Hurdles. A late hop lands you on the spikes.",
    "Ease to a jog before your Body Battery hits zero. A bonk costs you the sprint.",
    "Pick up every Kudos you can. Each one adds 2 to Body Battery, and they add up over a 5K.",
    "Sprinting in the air and in the water costs Body Battery too. Sprint the flat land, and ease to a steady stroke in the pool when the gauge drops to LOW.",
    "The Rep Max takes three stomps. Stomp from above, then stay out of the dumbbell arc.",
    "With a Heat Map, throw early so the bolts clear a walker before it reaches you.",
    "With the Cape, sprint the flat stretch before a wide gap so a full pace meter turns the jump into a take-off.",
    "Dev Mode is optional. Turn it on in the simulator controls for the full RAM challenge.",
  ],
  lore: {
    title: "Engineering for Wearable Hardware Constraints",
    story:
      "The game started on the Theodore Wirth mud run, a 10 km Minnesota trail race where Fred's Garmin fought for GPS lock the whole way. That run became the mechanics: a 5K in five stages, foes that come off the course, and a Body Battery that drains with every sprint. Under the hood, a watch's memory is still tiny. Garmin watches pair ultra-low-power Memory-in-Pixel (MIP) displays with microcontrollers that run for weeks on a charge, so Monkey C code has to be frugal: reuse object pools, avoid dynamic closures, and keep bitmaps small. Dev Mode brings that memory limit back to the runner.",
    realWorldTech: [
      "Garmin Connect IQ",
      "Monkey C VM",
      "MIP Display Tech",
      "Object Pooling",
      "ARM Cortex-M",
    ],
  },
};
