import { FieldManualData } from "@/types/game-manual";

export const GAME_MANUALS: Record<string, FieldManualData> = {
  proof: {
    id: "proof",
    title: "Logical Proof Canvas",
    subtitle: "Formal Verification & Multi-Theorem Propositional Logic Suite",
    genre: "Formal Verification",
    badge: "Formal Logic Suite",
    route: "/proof",
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    objective:
      "Construct deterministic deductive proofs across 5 classic propositional theorems (Modus Ponens, Modus Tollens, Hypothetical Syllogism, Disjunctive Syllogism, Resolution) to discharge target engineering conclusions with mathematical certainty.",
    quickSummary:
      "Select a theorem scenario, wire valid premise nodes on the interactive canvas or CLI, inspect live step-by-step mathematical deduction ledgers, diagnose fallacies with truth-table counterexamples, and export verified proofs to Lean 4, LaTeX, Markdown, or Mermaid.",
    controls: [
      {
        action: "Select & Connect Node",
        description:
          "Click any source node (e.g. Node C), then click the target node (e.g. Node E) to establish a deductive dependency edge.",
        key: "Click Node",
      },
      {
        action: "Drag Node Position",
        description:
          "Click and drag any node across the canvas to customize visual layout; click 'Reset Layout' to return to canonical graph coordinates.",
        key: "Drag Node",
      },
      {
        action: "Switch Theorem Scenario",
        description:
          "Select from 5 engineering proof scenarios (Modus Ponens, Modus Tollens, Hypothetical Syllogism, Disjunctive Syllogism, Resolution) using the top toolbar tabs or CLI.",
        key: "Toolbar / CLI",
      },
      {
        action: "Guided Tactic Step",
        description:
          "Click 'Apply Next Tactic' in the Guided Proof Assistant to automatically evaluate and apply the next valid deduction step.",
        key: "1-Click Tactic",
      },
      {
        action: "CLI Split Console",
        description:
          "Open the terminal and run commands such as `theorem mt`, `connect C E`, `inspect C`, `ledger`, `export lean`, `simulate normal`, or `clear`.",
        key: "Ctrl + \\",
      },
      {
        action: "Export Verified Proof",
        description:
          "Click 'Export Proof' to copy production-ready Lean 4 formal code, LaTeX deduction trees, Markdown audit tables, or Mermaid diagrams.",
        key: "Export Button",
      },
    ],
    rules: [
      {
        title: "Modus Ponens & Modus Tollens",
        detail:
          "Modus Ponens derives Q from (P ∧ (P → Q)). Modus Tollens derives ¬P from ((P → Q) ∧ ¬Q). Both antecedent/consequent pairs must reach the target node before it discharges.",
        badge: "Deductive Rules",
      },
      {
        title: "Syllogisms & Clausal Resolution",
        detail:
          "Hypothetical Syllogism chains (P → Q) ∧ (Q → R) into P → R. Disjunctive Syllogism eliminates (P ∨ Q) ∧ ¬P into Q. Resolution refutes complementary literals (P ∨ Q) ∧ (¬P ∨ R) into Q ∨ R.",
        badge: "Advanced Rules",
      },
      {
        title: "Fallacy Engine & Counterexamples",
        detail:
          "Attempting invalid inferences (such as Affirming the Consequent or Denying the Antecedent) triggers real-time truth-table counterexamples demonstrating rows where premises are TRUE but conclusion is FALSE.",
        badge: "Fallacy Detection",
      },
      {
        title: "Background Tactic Watchdog",
        detail:
          "Simulations run inside dedicated Web Workers off the main thread. A 5-second watchdog timer terminates divergent tactics to prevent UI thread lockup.",
        badge: "Worker Safety",
      },
    ],
    proTips: [
      "Use the 'Logic Inspector' tab to review the plain-English meaning and hypothesis requirements of any node.",
      "Switch to the 'Deduction Ledger' tab to view the live mathematical proof derivation table.",
      "The Guided Proof Assistant on the left highlights the immediate next deduction step needed to complete the proof.",
      "You can toggle between direct visual canvas interaction and the keyboard CLI console at any time without losing proof state.",
    ],
    lore: {
      title: "Why Formal Verification Matters in Modern Software",
      story:
        "Traditional testing (unit, integration, end-to-end) only tests sample inputs. Formal verification uses mathematical logic to prove that software satisfies specifications across all possible execution states. From NASA flight software and cryptographic microkernels (seL4) to blockchain smart contracts and compiler verification (CompCert), formal logic guarantees the complete absence of whole classes of bugs.",
      realWorldTech: [
        "Lean 4",
        "Coq / Rocq",
        "Z3 SMT Solver",
        "Curry-Howard Isomorphism",
        "seL4 Microkernel",
      ],
    },
  },

  patrol: {
    id: "patrol",
    title: "Patrol Shift",
    subtitle: "Midwest Ski Patrol Judgment Simulation",
    genre: "Judgment Simulation",
    badge: "Simulation",
    route: "/patrol",
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    objective:
      "Work a full patrol shift at a Welch Village-inspired hill: hold the mountain between calls, take dispatches, run the scene, sled the patient down, hand off, and read your debrief. Educational simulation only: it does not teach or certify clinical care.",
    quickSummary:
      "Start your shift, patrol the map between dispatches, assess and treat on scene, run the toboggan down the fall line, hand off to EMS, then review a debrief scored across five dimensions.",
    controls: [
      {
        action: "Start a Shift",
        description:
          "Begin at the intro, move through the morning briefing, and arrive on the mountain map. Reset at any time from the header to start a fresh shift.",
        key: "Begin Shift Briefing",
      },
      {
        action: "Patrol the Mountain Map",
        description:
          "Between calls you hold the hill. Trigger ambient operations (a closed rope, debris on a trail, a guest asking directions) and resolve them, or await the next dispatch.",
        key: "Click Map Actions",
      },
      {
        action: "Respond to Dispatch",
        description:
          "Radio traffic arrives as text on CH 1. Acknowledge the call to travel to the scene; the scenario's location, patient, and bystanders are revealed as you gather information.",
        key: "Acknowledge",
      },
      {
        action: "Run the Scene (OEC)",
        description:
          "Assess scene safety first, then gather observations, check vitals, and execute care actions. Order matters: the debrief engine reads what you did and when.",
        key: "Click Actions",
      },
      {
        action: "Talk to People on Scene",
        description:
          "Choose dialogue responses to delegate to your partner, calm a patient, manage bystanders, or request resources over the radio. There is rarely one correct line.",
        key: "Click Choices",
      },
      {
        action: "Steer the Toboggan (OET)",
        description:
          "Hold left or right to steer across the fall line. Steering is continuous: the sled keeps turning while the key is held.",
        key: "A / D or ← / →",
      },
      {
        action: "Brake and Control Speed",
        description:
          "Hold to scrub speed on the pitch. Chain brake toggles on and off for sustained control on ice; tail rope belay toggles your partner's braking behind the sled.",
        key: "S / ↓ • Space or B • T",
      },
      {
        action: "Pause the Descent",
        description:
          "Freeze the toboggan simulation without losing your run state.",
        key: "P",
      },
      {
        action: "Touch & Step-Through Controls",
        description:
          "On touch devices a control dock provides the same steering, brake, chain-brake, and tail-rope inputs. Step-Through Mode replaces the real-time descent with a discrete, keyboard-and-screen-reader-navigable alternative path.",
        key: "Touch Dock / Step-Through Mode",
      },
      {
        action: "Hand Off & Debrief",
        description:
          "Give a structured handoff to incoming EMS, then read a debrief with specific observations derived from your actual event log, plus a shift summary when you close out.",
        key: "Complete Handoff",
      },
    ],
    rules: [
      {
        title: "Not Medical Training",
        detail:
          "Patrol Shift is an educational simulation about operational judgment. It does not provide clinical protocols, medical guidance, or any form of OEC/OET certification. Never use it as a care reference.",
        badge: "Disclaimer",
      },
      {
        title: "Scene Safety Comes First",
        detail:
          "Assessing scene safety before you touch the patient is scored. The debrief engine checks whether a scene-safety action was logged before your first patient-care action.",
        badge: "Scene",
      },
      {
        title: "Five Debrief Dimensions",
        detail:
          "Every incident is read across Scene Management, Patient Care, Communication, Transportation, and Operational Judgment: each with a meter and specific written observations, not a bare score.",
        badge: "Debrief",
      },
      {
        title: "Smooth Beats Fast",
        detail:
          "Transport is judged on patient comfort, not elapsed time. Abrupt corrections and hard braking on the descent cost you more than a slower, controlled run.",
        badge: "OET",
      },
      {
        title: "Unofficial Tribute",
        detail:
          "An independent, non-commercial tribute to Midwest ski patrolling. Not affiliated with, endorsed by, or sponsored by Welch Village Ski and Snowboard Area.",
        badge: "Notice",
      },
    ],
    proTips: [
      "Assess scene safety before anything else: the debrief engine explicitly checks the ordering.",
      "Delegate. Sending your partner for equipment while you stay with the patient reads as strong scene management.",
      "Reassess vitals after an intervention; a single check early gives the debrief nothing to compare against.",
      "On the descent, small sustained corrections beat large late ones: the comfort metric punishes abrupt input.",
      "Engage the chain brake before the pitch steepens, not after you are already accelerating.",
      "Ambient events between calls are scored too: patrolling is responsibility for a place, not just waiting for injuries.",
      "Audio is muted by default and every radio call is text-first, so nothing is lost with sound off.",
    ],
    lore: {
      title: "Midwest Patrol & Systems Architecture",
      story:
        "Midwest patrolling is its own discipline: 360 feet of vertical, hard-packed man-made snow, short fast laps, and a volunteer culture where the same person sweeps the hill, runs the sled, and talks to the guest's family. This simulation models that judgment (deciding, communicating, and sequencing under mild pressure) through a headless finite state machine, data-authored scenarios, and a declarative rule engine that derives feedback from your event history rather than a scoreboard.",
      realWorldTech: [
        "Finite State Machines",
        "Deep Modules",
        "Declarative Rule Engines",
        "Outdoor Emergency Care (OEC)",
        "Outdoor Emergency Transportation (OET)",
      ],
    },
  },

  "working-with-duck": {
    id: "working-with-duck",
    title: "Working With Duck",
    subtitle: "Pet Simulation & Multitasking Arcade",
    genre: "Pet Simulation",
    badge: "Pet AI Arcade",
    route: "/arcade/working-with-duck",
    storageKey: "working_with_duck_high_score",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "Balance writing production code against managing your autonomous Golden Retriever puppy, Duck. Keep Duck happy, healthy, and hazard-free while maximizing commit output.",
    quickSummary:
      "Toss toys to divert Duck from power cables, command training tricks (Q-W-E-R), push active coding commits (Space), scrub belly rubs during the flop, jump agility hurdles in the Dog Park, and wash in the Bathtub when muddy.",
    controls: [
      {
        action: "Active Code Burst",
        description:
          "In the office, press Spacebar (Focus Work Sprint) to rapidly push code commits and squash bugs with Good Boy multiplier bonuses.",
        key: "Spacebar / Desk Click",
      },
      {
        action: "Training Tricks",
        description:
          "In the office, press Q (Sit), W (High Five), E (Drop It), or R (Spin) for immediate obedience, focus recovery, and Good Boy score multipliers.",
        key: "Q, W, E, R",
      },
      {
        action: "Toss Toys & Treats",
        description:
          "Press 1 (Tennis Ball), 2 (Kong Chew), 3 (Squeaky Toy), or 4 (Treat) to divert Duck away from server cables and trade stolen items.",
        key: "1, 2, 3, 4 Hotkeys",
      },
      {
        action: "Bathtub Wash & Rinse",
        description:
          "When Duck gets muddy at the Dog Park, drag him to the Bathtub station, scrub lather with your mouse, and shower rinse for a sparkling clean coat.",
        key: "Bathtub Click / Drag",
      },
      {
        action: "Agility Jump & Whistle",
        description:
          "In the Dog Park, steer Duck around mud puddles with W or the Up and Down arrow keys, tap Spacebar to leap over agility hurdles, and recall Duck with the ultrasonic whistle.",
        key: "W / Arrows, Spacebar, Whistle",
      },
    ],
    rules: [
      {
        title: "Autonomous Puppy State Machine",
        detail:
          "Duck transitions autonomously between behavioral states: Idle, Hazard-Chew, Belly-Flop, Potty-Sniff, Trick-Performance, and Nap Time. Anticipate his transitions to prevent desk chaos.",
        badge: "Deterministic AI",
      },
      {
        title: "Hazard Interception",
        detail:
          "If Duck chews the API cluster wire or Part 11 audit script, multiplier resets and penalty points apply. Call 'Drop It!' (E) or drop a Kong (2) immediately.",
        badge: "Hazard Penalty",
      },
      {
        title: "5-Sprint Campaign & Accessories",
        detail:
          "Progress across 5 story-driven sprints to unlock wearable cosmetics: Adidas Bucket Hat, Tech CEO Bowtie, Adventure Bandana, and Yellow Mud Boots.",
        badge: "Wardrobe Unlocks",
      },
      {
        title: "Endless Quarters",
        detail:
          "Endless mode runs in quarters. Every 120 work units a new quarter starts (Q1, Q2, Q3...): the meters fill faster, impulses come sooner, and one hazard joins for the rest of the run. Q2 brings more frequent surprises, Q3 tracks mud in after every potty trip (a muddy Duck slows work until bathed), and Q4 sets Duck chewing faster, power cable first. The run ends at a time-out and scores 1,000 per quarter survived plus the work done, with its own endless best.",
        badge: "Endless",
      },
      {
        title: "Puppy Hiccups",
        detail:
          "From sprint 2, and in endless mode, Duck can catch the hiccups for four seconds. A trick called mid-hic slips and breaks the combo; call it in the gap between hics and it lands as normal.",
        badge: "Surprise",
      },
      {
        title: "Polaroid Scrapbook",
        detail:
          "Capturing key milestone moments unlocks 10 high-resolution real photos and vector artwork in your persistent scrapbook.",
        badge: "Collectibles",
      },
    ],
    proTips: [
      "Use 'Drop It!' (E) as soon as Duck targets a hazard to save items without switching toys.",
      "Wear Yellow Mud Boots to provide complete mud puddle immunity at the Dog Park.",
      "Equip the Tech CEO Bowtie for an extra 0.2x speed boost during active sprint crunch periods.",
    ],
    lore: {
      title: "Autonomous Behavior Trees in Canvas 2D",
      story:
        "Building lifelike virtual pets requires combining finite state machines with weighted steering behaviors (Craig Reynolds' Boids algorithms). Duck's wandering pathing computes avoidance vectors around furniture while evaluating hunger, joy, and fatigue curves rendered in 60 FPS Canvas 2D with procedural particle fur shaders.",
      realWorldTech: [
        "Craig Reynolds Steering",
        "Finite State Machines",
        "Web Audio API Synths",
        "Canvas 2D Physics",
      ],
    },
  },

  "laser-loon": {
    id: "laser-loon",
    title: "Laser Loon: Quest for the State Flag",
    subtitle: "Civic Arcade / Physics Raycast Shooter & Campaign",
    genre: "Civic Arcade Shooter",
    badge: "F277 Flag Lore",
    route: "/arcade/laser-loon",
    storageKey: "laser_loon_high_score",
    accentColor: "from-cyan-500/20 via-red-500/10 to-transparent",
    badgeBg: "bg-red-500/10 text-red-400 border-red-500/30",
    objective:
      "Pilot the iconic F277 Laser Loon through four campaign acts from Lake Minnetonka to the State Capitol dome, battling rival flag finalists, bureaucratic red tape, and Minnesota folklore hazards.",
    quickSummary:
      "Aim with the cursor or touch controls, fire ruby eye-lasers and the Cryo-Mortar's ice blocks, collect Hotdish power-ups, and unleash the Haunting Loon Tremolo ultimate shockwave to claim victory!",
    controls: [
      {
        action: "Aim & Fire Laser Arsenal",
        description:
          "Aim crosshair with cursor or touch and left-click or drag to fire the active laser beam (Ruby Laser, Cyan Pulse, Aurora Wave, or Cryo-Mortar). Without a mouse, hold Space: the laser locks on to an enemy nearly in line ahead, so fly level with your target.",
        key: "Left Click / Drag / Space",
      },
      {
        action: "The Haunting Loon Tremolo (Ultimate)",
        description:
          "When the energy meter hits 100%, trigger a screen-wide synthesized cryogenic loon screech that freezes and shatters all obstacles!",
        key: "U / Ultimate Button",
      },
      {
        action: "Cycle Laser Modes",
        description:
          "Switch between Ruby Eye Laser (1), Cyan Pulse (2), Aurora Borealis Wave (3), and Glacial Cryo-Mortar (4).",
        key: "Keys 1 - 4 / Weapon Bar",
      },
      {
        action: "Loon Movement & Gliding",
        description:
          "Glide Laser Loon smoothly along the lake surface or committee floor to collect power-ups and dodge boss projectiles.",
        key: "W/A/S/D or Arrow Keys",
      },
    ],
    rules: [
      {
        title: "Iconic F277 Crimson Optics",
        detail:
          "Laser beams project raycast vectors with continuous collision detection against rival flag submissions and bureaucratic red tape.",
        badge: "Raycast Physics",
      },
      {
        title: "Glacial Cryo-Shatter Combos",
        detail:
          "Cryo-Mortar ice blocks bounce off lake boundaries, encasing targets in ice. Shattering frozen targets awards 2x points and cascades shrapnel.",
        badge: "2x Shatter Combo",
      },
      {
        title: "Weapon Counters",
        detail:
          "Every enemy has one optic it is weak to (a CRIT! for double damage) and some it resists (RESISTED, half damage). Cyan Pulse shreds the swarms: Laser Mosquitoes, Runaway Pronto Pups and Red Tape. The Ruby Laser melts Glacial Hail, Deep-Fried Butter, Clipboards, Surprise Amendments and the Polar Vortex Eye. The Aurora Wave's wide sweep beats Prize Gopher Decoys, F29 Tricolor Drafts and shielded 1893 Seal Drones, which resist every other optic. The Cryo-Mortar crushes Rogue Jet-Skis and armoured Veto Stamps, which shrug off every beam. Each act's intro card names the optic its new enemies want; bosses take every weapon evenly. Any single weapon can still clear every act, just slower.",
        badge: "Crit / Resist",
      },
      {
        title: "Historic Campaign Acts & Bosses",
        detail:
          "Advance through Lake Minnetonka (Mega Mosquito), State Fair (Butter Colossus), Redesign Commission (Starflake Finalist), and the Capitol Rotunda (Grand Veto Gavel).",
        badge: "4-Act Campaign",
      },
    ],
    proTips: [
      "Save your Haunting Loon Tremolo ultimate for boss encounters to shatter their revolving defense shields.",
      "Swap optics with keys 1 to 4 as the enemy mix changes: matching each enemy's weakness clears an act well under par.",
      "Grab floating Tater Tot Hotdish pickups for instant zero-cooldown laser overcharge frenzy.",
      "Bouncing Cryo-Mortar ice blocks off the canvas floor and ceiling creates hazardous pinball walls for rival flags.",
    ],
    lore: {
      title: "The Grassroots Legend of Submission F277",
      story:
        "In late 2023, the Minnesota State Emblems Redesign Commission invited citizen submissions. Fred deRuiter submitted 'F277: Laser Loon': a majestic common loon blasting twin crimson lasers across azure waters. The design became a worldwide viral sensation, featured in The New York Times, The Washington Post, and NPR. Fred released F277 into the public domain (CC0), launching a grassroots civic campaign that raised over $13,500 for the Saint Paul Public Library Foundation.",
      realWorldTech: [
        "Raycast Collision Vectors",
        "Web Audio Dual-Oscillator Synthesis",
        "Multi-Phase Boss AI",
        "Deterministic State Progression",
      ],
    },
  },

  "quasi-puzzler": {
    id: "quasi-puzzler",
    title: "Quasi-Perfect Puzzler",
    subtitle: "Formal Verification Logic Puzzle Arcade",
    genre: "Formal Verification",
    badge: "Lean 4 Simulator",
    route: "/arcade/quasi-puzzler",
    storageKey: "quasi_perfect_puzzler_progress_v1",
    accentColor: "from-purple-500/20 via-purple-500/5 to-transparent",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    objective:
      "Construct formal AST proofs, discharge multi-goal branch cases, and synthesize valid Lean 4 code within language server RAM limits without conceding to the forbidden `sorry` axiom.",
    quickSummary:
      "Apply formal proof tactics (intro, apply, exact, cases, rw, ring, norm_num, simp, omega) across a 3-chapter curriculum to discharge mathematical theorems and preserve verification morality.",
    controls: [
      {
        action: "Apply Proof Tactic",
        description:
          "Click or drag tactic cards (`intro`, `apply`, `exact`, `cases`, `rw`, `ring`, `norm_num`, `simp`, `omega`, `linarith`) onto AST nodes to transform goals.",
        key: "Click / Drag Tactic",
      },
      {
        action: "Branch & Multi-Goal Navigation",
        description:
          "Tactics like `cases` split goals into multiple subgoals. Use the branch tabs to switch between active goals until all are discharged.",
        key: "Subgoal Tabs",
      },
      {
        action: "Progressive Hint Coach",
        description:
          "Toggle progressive 3-tier hints for conceptual strategy, target subtree highlights, and recommended tactics.",
        key: "Hints Button (H)",
      },
      {
        action: "Lean 4 IDE Inspector",
        description:
          "Inspect live generated Lean 4 code in real time (`theorem ... := by ...`) and copy directly to Lean Web Editor.",
        key: "Lean IDE (C)",
      },
      {
        action: "Undo & Redo Tactics",
        description:
          "Step back through applied tactics with Ctrl+Z (Cmd+Z on Mac) and reapply them with Ctrl+Y (Cmd+Y). The plain Z and Y keys do nothing. R resets the level.",
        key: "Ctrl/⌘ + Z / Y",
      },
      {
        action: "Switch Mode",
        description:
          "Toggle between Story Mode and Hacker Mode. Switching restarts the current level with the new mode's RAM budget; mid-proof, you confirm the restart first.",
        key: "M",
      },
      {
        action: "The 'Sorry' Escape Valve",
        description:
          "Admit defeat on the current branch using `sorry`. It costs no RAM but permanently incurs a -100 Morality Penalty. Like every tactic, it is locked at 0 GB until you reset the level.",
        key: "Sorry Button",
      },
    ],
    rules: [
      {
        title: "Expression Tree Transformation",
        detail:
          "Every mathematical theorem is modeled as an Abstract Syntax Tree (AST). Tactics transform the root goal into simpler sub-goals until reaching known axioms.",
        badge: "AST Engine",
      },
      {
        title: "Proof-Engine RAM Limit",
        detail:
          "Each tactic, including a failed one, consumes simulated memory. Story Mode starts with twice the Hacker Mode budget. In either mode, hitting 0 GB stops the simulated tactic session and the level must be reset. Every tactic, sorry included, stays locked until then.",
        badge: "RAM Constraint",
      },
      {
        title: "Multi-Goal Case Splits",
        detail:
          "Disjunctions (P ∨ Q) split into independent cases with their own hypotheses. Both branches must be discharged to achieve Q.E.D.",
        badge: "Multi-Goal",
      },
      {
        title: "Zero-Sorry Morality Rating",
        detail:
          "Using `sorry` bypasses a difficult sub-goal without proving it, assigning a severe penalty to your final verification integrity score.",
        badge: "Integrity Score",
      },
    ],
    proTips: [
      "Use `ring` to automatically prove algebraic polynomial equivalences like (a+b)² = a² + 2ab + b².",
      "`intro h` unpacks implication antecedents into your local hypothesis pool.",
      "`cases h_or` splits a disjunction into two sub-goals (h_left and h_right).",
      "`norm_num` rapidly evaluates concrete numerical arithmetic and comparisons.",
      "Targeted `rw [h]` uses far less RAM (2 GB) than full confluent search `simp` (6 GB).",
    ],
    lore: {
      title: "The Curry-Howard Isomorphism & Lean 4",
      story:
        "The Curry-Howard correspondence establishes that computer programs and mathematical proofs are the exact same mathematical objects: propositions are types, and proofs are programs. Interactive theorem provers like Lean 4, developed at Microsoft Research and Carnegie Mellon, enable mathematicians and engineers to formally verify complex mathematics (such as Peter Scholze's Liquid Tensor Experiment) and verify production microcode.",
      realWorldTech: [
        "Lean 4",
        "Dependent Type Theory",
        "Homotopy Type Theory",
        "Calculus of Constructions",
      ],
    },
  },

  "garmin-watch": {
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
          "Water Stations are aid tables you jump onto; their sides stop you. One with a down arrow over it opens a bonus room full of Kudos when you press Down on it, and you come out further along the course. A Rest Day ends when you go in. Plyo Boxes spring you up when you land on them, and higher if you hold jump. Treadmill Belts slide back and forth over gaps and carry you while you stand on them. Stomp a Rest Day Switch and for 8 seconds the bricks turn into Kudos and the Kudos into bricks. The bricks are PR Boards: Buff or stronger, you break them from below for a NEW PR! bonus.",
        badge: "Course",
      },
      {
        title: "Pool & Open Water",
        detail:
          "Stages 2 and 4 are swum, not run. Each tap of jump (Up or Space) is a stroke that pulls you toward the surface; between strokes you sink. Wading along the bottom is slow and the water foes sit low too, so keep stroking. Each pool length is 25 metres, and a stage is 40 lengths: the LENGTH readout counts them off on the face. Open water has currents, marked by teal chevrons, that carry you with the flow or hold you back against it. Orange buoys with a white stripe mark the swim line along the open water; you can climb onto one for a breather as it bobs. Bonus rooms stay on dry land.",
        badge: "Water",
      },
      {
        title: "Basement Gym",
        detail:
          "Stage 3 is the Basement Gym, with low squat racks hanging over the lane. Duck under the bar and keep your jumps low: a rising runner that meets a rack's underside bonks off it and drops back down. Big forms get hurt. A runner taller than Base, such as a Buff monkey or one with a Heat Map or Cape, that ends up under a rack takes a hit. Fluorescent strips run overhead as you pass.",
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
          "Body Battery replaces the watch battery. It drains while you run, and faster while you sprint. A hit costs 15. Kudos add 2, and power-ups and stage clears add 25. A Runner's High fills it. Ease to a jog to recharge it. At 0 you bonk: you can't sprint until it recovers to 25, and it recharges at a steady pace as well as a jog. It never ends a run.",
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
          "The run clock counts game time from GPS lock. It stops when you pause and when the run ends. Each 1 km stage clear is an auto lap, and its banner shows that lap's split: green when it is a best split for that lap, amber when it is slower. The banner also calls your pace: WORLD RECORD PACE for a lap under 50 seconds, NEGATIVE SPLIT when a lap beats the one before, and POSITIVE SPLIT · EASE UP when it is more than 5% slower. The result card shows your finish time, your average pace and a splits table against your previous bests, with a Negative split note and New best time when you beat your best total. Bests are saved per watch on this device. Sprinting buys time but drains Body Battery, and a bonk costs more time than it saves.",
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
          "Race Mode is an option in the companion panel, next to Dev Mode. A Training Run lays a random course every time; a race runs the same course every attempt, so times compare. The Saturday 5K is one fixed course. The Daily Workout is a course for the day that changes at local midnight, the same for everyone. Pick a category before the start: 5K Any% (finish as fast as you can), All Kudos (collect every Kudos on the lane), No Gear (finish at Base, with no power-ups, Runner's High or training buddy; Sync Blocks pay Kudos instead), Negative Split (every lap beats the lap before it), or All Medals (find all 15 Finisher Medals). Races run with Dev Mode off, every random choice comes from the course seed, and the simulation steps at a fixed 60 times a second, so a fast or slow monitor cannot change the game's speed. A press lands on the next step, so input timing can still vary by one step. While paused in a race, Backspace restarts it on the same course. Each result lands on this device's top 5 for its course and category, with CR for the first record set on it and PR when you beat that record. Share copies a plain-text result. Nothing goes online.",
        badge: "Race",
      },
      {
        title: "Virtual Partner",
        detail:
          "When a race sets the best time on its board, it is kept as a ghost for that course and category (a Daily Workout ghost lasts its day). The next attempt runs beside a see-through copy of that run, like the pacing partner on a running watch. Under the race line, the gap to it reads in red when you are behind (+0:02.4) and green when you are ahead (-0:01.1), and each lap banner adds the gap at that lap. The ghost is only drawn: it never touches anything and cannot change a result. Turn it on or off, or pick your PR or the course record, in the companion panel; this device keeps one runner, so both are the same run. With reduced motion the ghost has no trail. Ghosts are kept on this device only, and the oldest go first when storage is short.",
        badge: "Ghost",
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
  },

  "clinical-chaos": {
    id: "clinical-chaos",
    title: "Clinical Trial Chaos: CDISC Compliance",
    subtitle: "21 CFR Part 11 Compliance & Time Management Arcade",
    genre: "Compliance Arcade",
    badge: "21 CFR Part 11",
    route: "/arcade/clinical-chaos",
    storageKey: "clinical_chaos_highscore",
    accentColor: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    objective:
      "Standardize clinical observations across 8 CDISC SDTM domains (DM, VS, AE, LB, CM, EX, DS, MH), solve multi-choice Controlled Terminology puzzles, deploy combo-charged regulatory lifelines, sign 21 CFR Part 11 electronic records, and achieve a clean FDA BIMO inspection rating.",
    quickSummary:
      "Solve Controlled Terminology discrepancies via multi-choice puzzles, route validated dossier packets to tiered EDC stations with hotkeys [1-8] (four stations in phase 1, six in phase 2 and endless, all eight in phase 3), deploy power-ups [Q, W, E, R], and export authentic CDISC ODM XML / SDTM CSV datasets.",
    controls: [
      {
        action: "Validate Clinical Observation",
        description:
          "Click any unverified observation card to open the Multi-Choice Validation Drawer and select the compliant CDISC standard, MedDRA Preferred Term, or ISO-8601 date.",
        key: "Click Observation / Multi-Choice",
      },
      {
        action: "Route to EDC Domain Desk",
        description:
          "Submit validated dossiers to active EDC stations: [1] Demographics (DM), [2] Vital Signs (VS), [3] Adverse Events (AE), [4] Laboratory (LB), [5] Concomitant Meds (CM), [6] Drug Exposure (EX).",
        key: "Keys [1-8] or Click Station",
      },
      {
        action: "Deploy Regulatory Lifelines",
        description:
          "Deploy combo-charged power-ups: [Q] FDA Coffee Break (freeze auditor), [W] CDISC Auto-Clean (clean active dossier), [E] Site Query Extension (+12s), [R] Fast-Track 21 CFR Pass (instant sign). Auto-Clean and Fast-Track only fire on a dossier with flagged fields, so a clean one keeps their charge.",
        key: "Keys [Q, W, E, R]",
      },
      {
        action: "Pause the Shift",
        description:
          "Press P or the Pause button to stop every clock: subject timers, the auditor, the sponsor and lifeline durations. Press P or Resume to carry on. Opening this manual also holds the shift until you close it.",
        key: "P / Pause Button",
      },
      {
        action: "21 CFR Electronic Signature Lock",
        description:
          "Verify legal signature intent and authenticate with password to permanently lock records and cooldown auditor suspicion.",
        key: "Enter / Confirm Signature",
      },
      {
        action: "Cycle Active Queue & Switch View",
        description:
          "Press the left and right arrows to cycle between conveyor parcels. Toggle between Conveyor Floor, Live SDTM Studio, and Audit Trail Log tabs to export XML/CSV datasets. Tab moves focus between the game's buttons.",
        key: "← → / Tab Switcher",
      },
    ],
    rules: [
      {
        title: "Tiered CDISC SDTM Domains",
        detail:
          "Phase I activates core safety & lab domains (DM, VS, AE, LB). Phase II unlocks Concomitant Medications (CM) and Drug Exposure (EX). Phase III unlocks Disposition (DS) and Medical History (MH).",
        badge: "8 SDTM Domains",
      },
      {
        title: "Campaign Phase Targets",
        detail:
          "Each phase's counter starts at zero and counts that phase's new locks. Lock 5 CRFs to clear Phase 1, 3 more to clear Phase 2 and 4 more to clear Phase 3, 12 in all. Your score carries across all three phases.",
        badge: "5 + 3 + 4 Locks",
      },
      {
        title: "Controlled Terminology & MedDRA Coding",
        detail:
          "Selecting incorrect CT codes or unstandardized units incurs auditor suspicion penalties. Correct answers award bonus points and recharge power-up lifelines.",
        badge: "CDISC CT & MedDRA",
      },
      {
        title: "Fresh Data Every Shift",
        detail:
          "Most flagged vital signs, labs and dates are generated for each subject: a true value with one data-entry error applied (a wrong or unconverted unit, a slipped decimal point, a stray zero, a US-order or impossible date). Read the raw entry and work out the error; memorising last run's answers will not help. AE coding and medication puzzles stay hand-written.",
        badge: "Procedural Queries",
      },
      {
        title: "21 CFR § 11.50 Manifestation of Signatures",
        detail:
          "Electronic records require unambiguous intent ('Intent to Submit', 'Urgent Safety Expedited', etc.). Submitting unverified raw data triggers immediate audit rejection.",
        badge: "21 CFR Part 11",
      },
      {
        title: "FDA Bioresearch Monitoring (BIMO) Scoring",
        detail:
          "At the end of each shift or upon trial termination, receive a formal BIMO inspection report with NAI (No Action Indicated), VAI (Voluntary Action), or OAI (Form 483 Issued) determination.",
        badge: "BIMO Inspection",
      },
    ],
    proTips: [
      "Keep an eye on Serious Adverse Events (⚡ SAE): they have shorter timers and grant +300 bonus points upon compliant signature. Sign an SAE Urgent Safety Expedited, and never use that reason for a routine CRF.",
      "Charge your 'FDA Coffee Break' lifeline by maintaining clean submission streaks; deploy it when auditor suspicion climbs above 70%.",
      "Switch to the Live SDTM Studio tab during shifts to inspect generated observation rows and export authentic CDISC ODM 1.3 XML.",
      "Toggle the procedural 8-bit synth BGM to hear dynamic tempo scaling as auditor scrutiny intensifies.",
    ],
    lore: {
      title: "Biotech Data Governance & Regulatory Lifecycles",
      story:
        "Bringing a novel therapeutic drug or medical device from Phase I trials through FDA/EMA approval requires processing millions of patient data points under strict federal regulations. CDISC standards (SDTM, ADaM, and ODM) ensure universal semantic interoperability, while FDA 21 CFR Part 11 guarantees that electronic records have the identical legal standing and auditability as traditional paper records.",
      realWorldTech: [
        "CDISC SDTM / ADaM / ODM",
        "FDA 21 CFR Part 11",
        "Electronic Data Capture (EDC)",
        "MedDRA / WHO-Drug",
        "GxP Validation",
      ],
    },
  },

  "study-director": {
    id: "study-director",
    title: "Study Director: Everything Is Fine",
    subtitle: "Clinical Study Management Simulator",
    genre: "Management Simulation",
    badge: "Walkable Office",
    route: "/arcade/study-director",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "Take Study 24-081, a randomized PK study for a first-time biotech, from kickoff to closeout: a scientifically valid, compliant study, on time, without wrecking the budget, the sponsor relationship or your team. Six meters compete and you cannot keep them all high. At the end the sponsor, the company, the science and the regulator each give a verdict, and the FDA may come to ask about your decisions.",
    quickSummary:
      "The game opens in the CRO office. Walk the floor with W A S D, press E to use what you face or talk to a teammate, and drive out to the sites to see what the dashboard is hiding. Every action costs minutes and energy; go home when the day runs out. Prefer a dashboard? The classic desk gives you 5 attention points a day instead. Skipped documentation adds documentation debt, which the inspection replays. Your run saves as you play.",
    controls: [
      {
        action: "Walk the office",
        description:
          "Moves one tile; hold the key to keep walking. Walking costs clock time, about four tiles a minute. Pressing into the wall beside a doorway slides you into line with the door (one step, paid for). In the office directory, each place shows what the walk would cost before you go.",
        key: "W A S D / Arrows",
      },
      {
        action: "Use or talk",
        description:
          "Uses the station you face (EDC, phone, eTMF, coffee, your car) or talks to the teammate in front of you.",
        key: "E",
      },
      {
        action: "Ask yourself how it is going",
        description: "It is fine.",
        key: "F",
      },
      {
        action: "Choose an option (classic desk)",
        description:
          "Answers the open message with the numbered option. Each option shows its attention cost.",
        key: "1 - 5",
      },
      {
        action: "Document the decision",
        description:
          "Toggles documentation for the next choice. It costs 1 extra attention and keeps the decision from becoming an observation at inspection.",
        key: "D",
      },
      {
        action: "Move through the inbox",
        description: "Selects the next or previous message in the inbox.",
        key: "J / K",
      },
      {
        action: "End the day (classic desk)",
        description:
          "Unanswered messages whose time has run out apply their fallout, the study advances one day and attention refills to 5, less when a query backlog or documentation debt is taking routine work.",
        key: "E",
      },
      {
        action: "Skip to the next message",
        description:
          "When nothing is waiting, ends days until the next message arrives, so quiet stretches take one keypress.",
        key: "N",
      },
      {
        action: "Audit a site",
        description:
          "Costs 2 attention. Shows the site's true queries, deviations, unsigned source, eligibility concerns and training for 10 days.",
        key: "Audit button",
      },
    ],
    rules: [
      {
        title: "Attention is the resource",
        detail:
          "In the office, minutes and energy are the resource: the day starts at 8:00 and a late finish costs energy and morale. On the classic desk you get 5 attention points a day and unspent points do not carry over. Answering, delegating and auditing all spend them, so some messages will go unanswered.",
        badge: "Attention",
      },
      {
        title: "Sounds and small signals",
        detail:
          "Sound is off until you turn it on with the site's sound toggle, and it follows the site's reduced-motion and high-contrast settings. Six short cues exist, each played once per event and never in a loop: footsteps (every second tile, not on touch screens), a door when you enter a room, the phone ringing, an email chime, the coffee machine, and a stamp when an item leaves your task list. Small toasts show energy or focus moving, a heart gained or lost, and a stamped task. They are decoration: everything that matters is also written in the HUD and read out by screen readers.",
        badge: "Feedback",
      },
      {
        title: "The shape of a day",
        detail:
          "Each morning you can choose one priority for the day: your people, the sites or your desk. It colours the evening, when a short wrap-up says what you decided, what is still unwritten, what was left waiting and whether you kept your priority. Choosing people makes every kind gesture land a little harder; sites and desk are judged by what the sites sent overnight and whether your decisions are written up. Around ten, a quarter to one and half past three, something small interrupts the day (lunch, a sponsor ping, a jammed printer, a pile of queries, a fire drill, a new starter stuck at the door). Each has options with a time cost, and an interruption you let go is never free. You are never interrupted at a site or in a meeting.",
        badge: "Rhythm",
      },
      {
        title: "Getting to know your team",
        detail:
          "Open a teammate's conversation for four small actions. Bring a coffee (10 minutes, better if you know their order), ask a favour of them (20 minutes, only if they have room in their workload), ask about them (15 minutes, learns what they care about) or cover for them (5 minutes, needs four hearts, trades some trust for relief). Each can be used only so often. Teammates you trust a lot give you an early warning about the site that worries them most, and take one more unit of work a night.",
        badge: "People",
      },
      {
        title: "Five sites, five kinds of coordinator",
        detail:
          "Drive out to any of five sites. Each has its own coordinator and investigator, its own drive time, and a type you work out from visits: the anxious one whose records hold up, the friendly one who says all is well, the organised one who holds the whole study in their head, the confident one who writes the source from memory, and the new one who reports everything and has nobody to ask. What they show on the first visit is not the whole of them. The right checks reveal the rest, some only from the second visit.",
        badge: "Sites",
      },
      {
        title: "Visitors in the conference room",
        detail:
          "Twice in a study someone waits for you in the conference room for an hour and a half: the sponsor's VP of Clinical Operations, some time in the third week, and the EDC vendor, some time in the sixth. Walk in to meet them. With the sponsor you can tell what you have actually seen (best if you audited the site she is worried about), give the clean summary (pleasant, and a cost to integrity if something is being hidden), hand her to your data manager, or ask for another day. With the vendor you can ask for the audit-trail walkthrough, negotiate the renewal, send the data manager with questions, or take the brochure. A sponsor nobody meets takes it as a snub. Interruptions wait while a visitor does.",
        badge: "Visits",
      },
      {
        title: "Everything is fine, until you look",
        detail:
          "Enrollment, budget and timeline on the dashboard are honest. Safety, data and regulatory only show what each site has reported: a coordinator who emails about everything surfaces most problems, one who says nothing surfaces almost none. An audit shows the real numbers.",
        badge: "Dashboard",
      },
      {
        title: "Decisions echo",
        detail:
          "A high-burden protocol overloads sites, which produces deviations and queries, which overload data management, which delays lock and pushes the schedule. A choice on day 4 can be a crisis on day 63, and some choices schedule a follow-up message.",
        badge: "Causal chain",
      },
      {
        title: "Documentation debt",
        detail:
          "Skipping documentation saves attention today and adds debt. Debt lowers Compliance and raises the chance the FDA visits. If it does, it asks about your own decisions: documented ones close, undocumented ones become observations.",
        badge: "Inspection",
      },
      {
        title: "Four verdicts and a profile",
        detail:
          "Locking the database turns open queries into delay. The sponsor rates you in stars, the company reports margin and timeline variance, the science reports evaluable and missing data, and the regulator grades inspection readiness. The game then names which kind of Study Director you were, from what you actually did. A run played in the office closes out at the same report, and its share card says so; the link replays the same seed at the classic desk. Office runs also keep a meeting archive, reachable from your desk and from the closeout, and add meetings, site visits and what you were told to the exports.",
        badge: "Closeout",
      },
    ],
    proTips: [
      "Audit the site you hear least from.",
      "A message ignored on a critical day costs more than a cheap answer.",
      "Documenting everything is not free. Document the decisions an inspector would ask about.",
      "When the veteran says there is a problem, there is a problem.",
    ],
    lore: {
      title: "The person in the middle",
      story:
        "A study director sits between the sponsor, the sites, the statisticians, the data managers and the regulators, and is judged on whether the study holds up years later. The game is fictional and simplified: every sponsor, site and person is invented, and nothing in it is regulatory or clinical advice.",
      realWorldTech: [
        "Protocol deviation tracking",
        "Edit checks and data queries",
        "Database lock",
        "Trial master file",
        "FDA inspection readiness",
      ],
    },
  },

  "patty-drive-thru": {
    id: "patty-drive-thru",
    title: "Patty's Drive-Thru",
    subtitle: "A Diary Entry From a First Job",
    genre: "Autobiographical Simulation",
    badge: "First-Person Booth",
    route: "/arcade/patty-drive-thru",
    accentColor: "from-lime-200/20 via-lime-200/5 to-transparent",
    badgeBg: "bg-lime-200/10 text-lime-200 border-lime-200/30",
    objective:
      "Get through one drive-thru shift, squeezed from four hours into three minutes, without the drive-thru times or your dignity reaching zero. Every car you serve before its ticket turns red helps; every car that gives up and drives off costs speed and comes out of your pay.",
    quickSummary:
      "Orders arrive through the headset and go up on the kitchen display, where they turn yellow, then red. Ring each one up on the register, re-enter any drink the dispenser drops, flag Dale for coffee you are too young to brew, and bump the order when it is done. If you stand still too long, Bo notices. The shift ends with a pay stub, a closing note and a score: points for every car, less for late ones, plus extra for orders bumped while still green, for a streak of orders rung without a wrong entry, and for the Dignity you still have at close. Before clocking in you can pick a practice shift (lunch rush, failing dispenser, strict management); those do not count toward your score, and any shift's data downloads as JSON or CSV from the pay stub page.",
    controls: [
      {
        action: "Turn",
        description:
          "Pivots half a turn either way, from the window on the left to the kitchen on the right. Dragging with the mouse also turns.",
        key: "A / D or ← / →",
      },
      {
        action: "Use the register",
        description:
          "Zooms in on the register and moves the keyboard into it. The view narrows, so you lose sight of the order screen while you ring.",
        key: "Enter or Tab",
      },
      {
        action: "Step back",
        description: "Leaves the register and returns to the booth.",
        key: "Esc",
      },
      {
        action: "Pick an order",
        description: "Selects an open order by its position on the strip.",
        key: "1 - 6",
      },
      {
        action: "Bump the order",
        description:
          "Sends the selected order out. Bumping one that is not finished is a mistake and costs dignity.",
        key: "B",
      },
      {
        action: "Re-enter a dropped drink",
        description: "Rings the drink the dispenser lost in again.",
        key: "R",
      },
      {
        action: "Flag a coworker",
        description:
          "Asks Dale, who is nineteen, to brew the coffee you are not allowed to. It takes a few seconds.",
        key: "C",
      },
      {
        action: "Wipe the counter",
        description: "Calms Bo down. It works every few seconds.",
        key: "W",
      },
      {
        action: "Menu back / home",
        description: "Moves up one register menu, or back to its home screen.",
        key: "Backspace / Home",
      },
    ],
    rules: [
      {
        title: "Green, yellow, red",
        detail:
          "Each ticket's colour shows its age. Bumping a green ticket raises drive-thru speed the most, yellow a little, and red lowers it. A ticket left too long expires: the car drives off, speed drops sharply and the till comes up short.",
        badge: "Order screen",
      },
      {
        title: "The register is the enemy",
        detail:
          'Items sit one menu down. "No pickles" sits four menus down, and it only counts after the burger it belongs to is rung up. Ringing something that is not on the ticket costs dignity.',
        badge: "Register",
      },
      {
        title: "The drink machine",
        detail:
          "The automatic dispenser drops some of the drinks it is sent. A dropped drink has to be re-entered before the order can be bumped.",
        badge: "Dispenser",
      },
      {
        title: "Too young for coffee",
        detail:
          "You are under eighteen, so the coffee button does not work for you. Pressing it anyway costs dignity. Flag Dale and ring the coffee once it is brewed.",
        badge: "Age lock",
      },
      {
        title: "Never be idle",
        detail:
          "Doing anything at all keeps Bo off your back. Stand still and the watching meter fills; when it is full, Bo yells and you lose dignity. Wiping the counter calms Bo the most.",
        badge: "Manager",
      },
      {
        title: "Clocking out",
        detail:
          "The shift ends when the clock runs out, when drive-thru speed reaches zero, or when dignity does. A pay stub takes out the uniform, a break you did not take and any till shortage.",
        badge: "End of shift",
      },
    ],
    proTips: [
      "Look at the order screen before you zoom into the register.",
      "Ring the burger before you go looking for the pickles.",
      "Flag Dale the moment a coffee shows up.",
      "When there are no cars, wipe something.",
    ],
    lore: {
      title: "A diary entry",
      story:
        "My first job, on and off from 2014 to 2017, was the drive-thru window at a fast-food place. The game keeps the parts that stuck: the screen, the register, the drink machine, the coffee button and a manager who could not stand to see anyone idle. The chain is fictional and the people are renamed.",
      realWorldTech: [
        "Kitchen display systems",
        "Speed-of-service timers",
        "Point-of-sale menu trees",
        "Automatic beverage dispensers",
        "Youth employment rules",
      ],
    },
  },

  "for-better-or-bulk": {
    id: "for-better-or-bulk",
    title: "For Better or Bulk",
    subtitle: "Our Costco Wedding, Set Up in Real Time",
    genre: "Co-op Kitchen Chaos",
    badge: "Couch Co-op",
    route: "/arcade/for-better-or-bulk",
    accentColor: "from-rose-300/20 via-rose-300/5 to-transparent",
    badgeBg: "bg-rose-300/10 text-rose-300 border-rose-300/30",
    objective:
      "Turn a car full of warehouse supplies into a wedding between 9:00 and the 4:00 ceremony. Every planned spot in the venue wants one thing: an arrangement on each table, chairs on the lawn, lanterns on the hooks and a full buffet.",
    quickSummary:
      "Before the clock starts, pick two features Fred built into the wedding website months ago and fill the cart without going over budget. Then Fred and Abbi carry roses to the rose table, raw meat to the grill and everything else to where it goes. Phone calls freeze whoever answers unless the website already answered for you. Partway through the morning Fred's brothers text, and the clock stops until he decides what to do. At 4:00 the receipt explains what got done, who did it and why.",
    controls: [
      {
        action: "Move",
        description:
          "In two-player mode Fred uses WASD and Abbi the arrow keys. Alone, either set moves whoever you are playing.",
        key: "WASD / arrows",
      },
      {
        action: "Pick up or put down",
        description:
          "Takes from the crate, station, spot or patch of ground you are facing, or puts what you carry there.",
        key: "E or Space (Fred) / Enter (Abbi)",
      },
      {
        action: "Work",
        description:
          "Hold to arrange roses or pluck petals at a station, or to leave an empty centerpiece or petal spot bare on purpose.",
        key: "F (Fred) / Shift (Abbi)",
      },
      {
        action: "Swap",
        description:
          "In one-player mode, switches between Fred and Abbi. Shift+Tab leaves the cabinet, so keyboard focus can go back to the page.",
        key: "Tab / Shift+Tab",
      },
      {
        action: "Pause",
        description: "Stops the clock.",
        key: "Esc",
      },
    ],
    rules: [
      {
        title: "Roses become things",
        detail:
          "A bunch of roses on the rose table becomes an arrangement after a moment of held work, and in the petal bucket it becomes a bucket of petals. The cart buys exactly the roses the plan needs, so a dropped bunch in the bin is a bare table later.",
        badge: "Rose table",
      },
      {
        title: "The grill does not wait",
        detail:
          "Raw hot dogs and wings cook in a few seconds and burn a few seconds after that. Burnt food goes in the bin, and binning a batch restocks one batch from its crate. Extra food in the cart is insurance against the grill, not extra credit.",
        badge: "Grill",
      },
      {
        title: "The website answers the phone",
        detail:
          "Guests call with questions at set times. A call freezes whoever picks up for a moment, unless a website feature already answers it: the FAQ, Abbi's admin page or the registry scraper. The 3D intro answers nothing.",
        badge: "Phone",
      },
      {
        title: "The brothers' text",
        detail:
          "Fred can stay, take a short break and promise to come back for one thing, or leave. Staying keeps him working, nervously. A break brings him back calmer; the promise is kept only if that work is done by 4:00. Leaving is never a kept promise, however much Abbi finishes alone.",
        badge: "Presence",
      },
      {
        title: "Bare on purpose",
        detail:
          "Hold F or Shift on an empty centerpiece or petal spot to leave it bare. Simplifying drops that spot from the plan, and the receipt counts it as a choice, not as unfinished.",
        badge: "Simplify",
      },
    ],
    proTips: [
      "Put the meat on the grill first, then go do something else nearby.",
      "In one-player mode, park one person at the rose table and swap.",
      "The FAQ and the admin page stop the most calls.",
      "Chairs are heavy but never burn. Two come off the crate at a time.",
    ],
    lore: {
      title: "The real wedding",
      story:
        "Abbi and Fred married on 10/10/25 at the Plummer House in Rochester, for about 100 guests and under about $4,000, mostly from Costco. Abbi did most of the prep with friends, the roses were Kirkland, dinner was hot dogs, wings, mac and cheese and quinoa salad, and the leftovers went to the Rochester warming shelter. The game's layout, timings, prices and choices are invented for play.",
      realWorldTech: [
        "Fixed-timestep simulation",
        "Deterministic replay from input frames",
        "Canvas 2D rendering",
        "Shared-keyboard input mapping",
        "Condition-based explanations",
      ],
    },
  },

  "protocol-drift": {
    id: "protocol-drift",
    title: "Protocol Drift",
    subtitle: "Design the trial. Debug reality.",
    genre: "Systems Simulation",
    badge: "Pipeline Canvas",
    route: "/protocol-drift",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "As Lead Clinical Data Architect for Study PD-101, wire a pipeline that carries site entries into CDISC SDTM, keep it honest through tired coordinators and a mid-flight protocol amendment, derive the ADaM orthostatic rows below the Conservation Wall, and clear both Database Lock gates without fabricating a single bit.",
    quickSummary:
      "Accept the briefing, place chips on the Tabulation Lane and wire them, press Run Local Test, then Publish Revision, then Space to run the clock. Investigate discrepancies in the Forensic Inspector, query sites with attached evidence, and request the Database Lock on Day 28.",
    controls: [
      {
        action: "Run or pause the clock",
        description:
          "Runs the published pipeline at 1x, 2x or 5x; at 1x one simulated hour passes per real second.",
        key: "Space",
      },
      {
        action: "Step one hour",
        description:
          "While paused, advances the clock by exactly one simulated hour.",
        key: "N",
      },
      {
        action: "Expand the inspector",
        description:
          "Expands the tri-pane Forensic Inspector (Form View, Pipeline Trace, Review and Query) over the canvas.",
        key: "I",
      },
      {
        action: "Dock the inspector",
        description: "Returns the inspector to its docked height.",
        key: "Esc",
      },
      {
        action: "Add and wire chips",
        description:
          "Drag a chip from the toolbox, or press Enter on it, then connect output pins to input pins. The Pipeline as text list offers the same wiring from the keyboard.",
        key: "Drag / Enter",
      },
    ],
    rules: [
      {
        title: "The Conservation Wall",
        detail:
          "Tabulation chips cannot cross the wall at y416, and data flows only downward through the Snapshot Handoff, which freezes a read-only copy of SDTM. Analysis never rewrites tabulation.",
        badge: "Wall",
      },
      {
        title: "No silent selection or imputation",
        detail:
          "Text with two readings is kept and counted as loss until you disposition it. A partial date such as 2025-10 stays partial; imputing a day adds 4.95 bits of fabricated precision and blocks the lock.",
        badge: "Epistemic debt",
      },
      {
        title: "Evidence beats a generic query",
        detail:
          "A tired coordinator may answer Confirmed Correct without checking. That answers the thread but never resolves the issue. A query with the paper evidence attached gets a real review and a source correction.",
        badge: "Queries",
      },
      {
        title: "Route by assessment date",
        detail:
          "Amendment 01 requires standing blood pressure after a site activates v2. A visit is judged by when it was assessed, not when it was submitted, so a late backlog form stays on v1.",
        badge: "Amendment",
      },
      {
        title: "Dual Database Lock",
        detail:
          "The SDTM checklist needs 110 VS rows, 6 MH rows, no open queries, no fabricated debt and intact traces. The ADaM checklist needs 20 orthostatic rows with NOT EVALUABLE visits handled honestly and no stale derivations.",
        badge: "Lock",
      },
      {
        title: "Efficiency against par",
        detail:
          "The debrief scores five measures against par: 13 chips, 21 wires, lock on Day 28, no rejected commands and no fabricated bits. Each is worth 100 points at par, more for a leaner pipeline and less for a sprawling one, and earns a medal at or under par. Your best for each measure is kept in this browser.",
        badge: "Par",
      },
    ],
    proTips: [
      "Add the regex split before Site A's narrative entry arrives on Day 7.",
      "Inspect the Form View before you query: the paper may already tell you the answer.",
      "Replay derivations after any source correction.",
    ],
    lore: {
      title: "Where the plan meets the clinic",
      story:
        "Data standards describe the data a trial should collect; clinics produce the data they actually collect. Protocol Drift is a fictional, simplified account of the work in between. Every study, site and person is invented and nothing in it is clinical or regulatory advice.",
      realWorldTech: [
        "CDISC SDTM and ADaM",
        "CDASH partial date handling",
        "Source data verification",
        "Protocol amendments and IRB activation",
        "Database lock",
      ],
    },
  },

  "trial-and-error": {
    id: "trial-and-error",
    title: "Trial & Error: Biostat Ops",
    subtitle: "Card Table Deckbuilder & SAP QC Desk",
    genre: "Roguelike Deckbuilder",
    badge: "Chips × Mult",
    route: "/arcade/trial-and-error",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "Carry one fictional compound through three studies, one review at a time, and lock its Clinical Study Report. Each act is a study with three Blinds: Act I (Phase I safety) ends at the Dose Escalation Committee, Act II (Phase II proof of concept) at a DMC milestone or an FDA Information Request, and Act III (Phase III pivotal) at CSR Lock, the final boss. Inspect suspect cards on the QC Desk before you trust them: an uncorrected fatal defect zeroes the whole hand, and losing any Blind ends the run.",
    quickSummary:
      "Move across the hand with ← →, select up to five cards with Space, and press Enter to play the best hand they make (2 CPU). D discards the selection (1 CPU). I opens the focused card's QC Desk (1 CPU): inspect cells with Enter or Space, correct with C, trace a flagged cell to its Listing with T, and close with Esc. R recompiles a stale card (2 CPU), S runs structural QC on a face-down card (1 CPU), and A jumps to a blank shell's analysis sets. Between Blinds, spend the Study Budget in the shop. The run saves as you play, so a reload offers Resume run.",
    controls: [
      {
        action: "Replay the guided Blind",
        description:
          "Your first visit offers a guided Blind: one hand, with a coach outlining each control in amber as you inspect a Table, correct its finding, and play it with its Listing. Skip it at any step. Replay tutorial on this tab plays it again.",
        key: "Replay tutorial",
      },
      {
        action: "Move across the hand",
        description:
          "Left and right arrows move between cards; Home and End jump to the ends. Tab reaches the relic rack and the Play, Discard and Inspect buttons.",
        key: "← → / Home / End",
      },
      {
        action: "Select a card",
        description:
          "Toggles the focused card. Up to five cards can be selected; the table detects the best hand and previews its Chips × Mult.",
        key: "Space",
      },
      {
        action: "Play hand",
        description:
          "Scores the selected cards as they truly are, including defects you never inspected. Kickers that are not part of the hand do not score. Costs 2 CPU.",
        key: "Enter",
      },
      {
        action: "Discard",
        description:
          "Discards the selected cards and deals replacements. Costs 1 CPU.",
        key: "D",
      },
      {
        action: "Read a card",
        description:
          "Opens an enlarged, readable view of the focused card's face for free (Inspect, which reveals hidden defects, still costs CPU). A long press does the same; on touch, tap a selected card again.",
        key: "?",
      },
      {
        action: "Reorder the hand",
        description:
          "Moves the focused card left or right. With a pointer, drag a card by the grip above it. Order is cosmetic.",
        key: "Alt + ← →",
      },
      {
        action: "Cabinet audio",
        description:
          "SFX and Music switch the cabinet's synthesized sounds and its music loop. Both stay silent while site sound is muted (the default); Unmute turns site sound on. Music is off until you turn it on.",
        key: "SFX / Music",
      },
      {
        action: "Skip scoring",
        description:
          "While a played hand scores step by step, Space, the Skip button or a click on the score plate jumps to the result. The 1×, 2× and 4× buttons set the scoring speed.",
        key: "Space",
      },
      {
        action: "Inspect",
        description:
          "Opens the focused card's QC Desk for 1 CPU (reopening is free). Enter or Space inspects a cell, C corrects a revealed finding, Esc closes.",
        key: "I",
      },
      {
        action: "Move around a desk",
        description:
          "On the QC Desk the arrows move cell by cell and Home and End jump to the ends of a row. On the Figure Desk, ↑ and ↓ move between findings.",
        key: "← → ↑ ↓ / Home / End",
      },
      {
        action: "Correct or reconcile",
        description:
          "On the QC Desk, corrects the focused cell's revealed finding. On the Figure Desk, reconciles the focused Kaplan–Meier finding with the parent Table. Both are free.",
        key: "C",
      },
      {
        action: "Trace a flagged cell",
        description:
          "On the QC Desk, traces a flagged cell to the patient Listing it was counted from and draws a line to the first subject row (free). Press T again for the next row and Shift + T for the previous one.",
        key: "T / Shift + T",
      },
      {
        action: "Structural QC",
        description:
          "Checks a face-down card's column balance, missing data and format for 1 CPU without reading a single value. Rerunning it on the same card is free.",
        key: "S",
      },
      {
        action: "DMC session",
        description:
          "Where a Blind has a data monitoring committee, the Blind panel shows the session and a button that convenes the closed session or returns to the open one. The button says why when it is not available.",
        key: "Session",
      },
      {
        action: "Recompile",
        description:
          "Reruns the focused stale card against the current population snapshot for 2 CPU. Cells you corrected stay correct; defects nobody reported come back on the new data, so inspect the rerun again.",
        key: "R",
      },
      {
        action: "Allocate a blank shell",
        description:
          "Focuses the allocation choices for a selected blank shell. Each choice shows the set's N, the snapshot and the hand it would make. Allocating is free and final: the shell compiles on that set and takes it as its suit.",
        key: "A",
      },
      {
        action: "Apply a footnote seal",
        description:
          "Pick a seal up from the tray, then press Enter or Space on an eligible card to print it as a footnote (free). With a pointer, click the card or drag the seal onto it. Esc puts the seal back; Sell trades it for study budget.",
        key: "Enter / Space / Esc",
      },
      {
        action: "Use a Guidance card",
        description:
          "Guidance cards in the tray are named after real guidance documents. Using one (free) levels its hand up for the rest of the run, adding Chips and +Mult to that hand's base; Sell trades it for study budget instead.",
        key: "Use",
      },
      {
        action: "File a SAP Amendment",
        description:
          "Amendments in the tray raise one non-fatal SAP rule's stakes for the rest of the run: its correction earns more +Mult, and a standing redline costs more. Use opens a confirm that lists every output in hand compiled under the old rulebook, which goes stale until you recompile it. Esc keeps the amendment.",
        key: "Use / Esc",
      },
      {
        action: "Sell a relic",
        description:
          "In the shop, S or Enter on a relic in the rack offers to sell it for half what it cost.",
        key: "S / Enter",
      },
      {
        action: "Resume a run",
        description:
          "After a reload, Resume run puts you back on the same hand, score and CPU. New run asks before it discards the saved run.",
        key: "Resume run",
      },
      {
        action: "Run Info",
        description:
          "Opens the run's hand table (level, base Chips, base +Mult and times played), the equipped relics and the run seed. Esc closes it.",
        key: "Shift + R",
      },
      {
        action: "Hand cheat sheet",
        description:
          "Lists every hand, strongest first, with its level, base Chips and +Mult, what it is made of and an example. Hands the current stage refuses are marked, and so is the hand your selection makes. Free; H or Esc closes it.",
        key: "H",
      },
    ],
    rules: [
      {
        title: "Three acts, nine Blinds, one run",
        detail:
          "Each Blind has its own SAP, deck and target, and its CPU refills at the start of each Blind (unspent CPU does not carry over). The run seed shuffles each Blind's deck, so the same seed deals the same cards; the few outputs a Blind is built around are always in its opening hand. Clearing a Blind moves you to the next; failing one ends the run, and Restart run starts again from Act I's Small Blind.",
        badge: "Campaign",
      },
      {
        title: "A new study each act",
        detail:
          "After an act's Boss, Next study starts the next act. Its act card names the Boss waiting at its end. The new study brings its own subjects, snapshots, SAP and outputs, and the last study's trial sites close out with it. Your relics, hand levels, tray, study budget and cleared Blinds come along. The shop between acts sells no site packs, because the next study has no sites yet.",
        badge: "Act card",
      },
      {
        title: "Post-marketing rounds",
        detail:
          "Winning at CSR Lock offers a choice: Submit and end run, or Continue into post-marketing. The win is recorded either way. Each post-marketing round is a new study drawn by the seed, either Safety surveillance (a PSUR, a Label Update, then the Dose Escalation Committee) or a Post-authorisation safety study (an interim QC, a DMC open session, then an FDA Information Request). Every quota rises by a quarter each round, rounded up to the next 100, and your relics, hand levels, tray and budget carry on. The first failed Blind ends the run, and the result names the round you reached.",
        badge: "Endless",
      },
      {
        title: "Scoring pipeline",
        detail:
          "Hand Score = (base hand Chips + output Chips + relic Chips) × (base hand Mult + card and rule +Mult + relic +Mult) × every ×Mult. A High Table is 15 Chips / +1 Mult; the Demographics table adds 30 Chips / +1 Mult, and 12 verified subject records add 12 Chips.",
        badge: "Chips × Mult",
      },
      {
        title: "Hand levels",
        detail:
          "Every hand starts the run at level 1. A Guidance card raises its hand one level for the rest of the run, and the preview shows the hand's Lv. The Sponsor Safety Review deals ICH E2A, which levels MedDRA Five of a Kind by +35 Chips and +3 Mult. The flavour text is a joke, not regulatory advice.",
        badge: "Guidance",
      },
      {
        title: "SAP Amendments",
        detail:
          "The Rounding and Precision Amendments are sold in the shop and turn up in Guidance Packs. Filing one puts an amended rulebook in force, e.g. SAP-DM-001 becomes SAP-DM-001-AR, and it carries into every later Blind and study. Outputs already in hand were compiled under the old rulebook: they score 0 Chips until recompiled.",
        badge: "Amendment",
      },
      {
        title: "Protocol deviations",
        detail:
          "In Phase II and Phase III, a Small or Big Blind may open with a deviation scheduled by the seed. After hand 1 or 2 a subject leaves some populations, the snapshot moves on, and outputs in hand built on those populations go stale. The card that appears names the subject and the stale outputs: recompile them (R) or discard them, since fresh draws compile against the new snapshot. Phase III deviations never touch ITT, which is analysed as randomized. Boss Blinds never draw one.",
        badge: "Deviation",
      },
      {
        title: "Zero-score rule",
        detail:
          "A percentage divided by the wrong population's N (FAS instead of ITT) is a fatal denominator error. While it stands, the hand's final Mult is 0, whether or not you found it.",
        badge: "Fatal",
      },
      {
        title: "Precision and rounding",
        detail:
          "The SAP reports 1 decimal place and rounds ties half-to-even. Correcting a precision slip earns +2 Mult; correcting a rounding slip earns +1. Each open redline you have revealed costs 1 Mult.",
        badge: "SAP-DM-001",
      },
      {
        title: "Subjects, not events",
        detail:
          "Adverse event incidence counts subjects: a subject with three nervous system events is counted once in that System Organ Class. A draft that counts events is a major redline (−2 Mult); correcting it earns +2.",
        badge: "MedDRA",
      },
      {
        title: "Stale outputs",
        detail:
          "Every card records the population snapshot it was compiled against (Read a card shows it). When a subject joins or leaves a population, the snapshot moves to a new version and every card in hand built on that population goes STALE: it scores 0 Chips, a hand holding it cannot be played, and it cannot join a Population Flush. Recompile it (2 CPU) or discard it; new draws compile against the new snapshot, and cards of other populations stay valid.",
        badge: "Snapshot",
      },
      {
        title: "Blank shells",
        detail:
          "A dashed card marked SHELL is a table with no data yet. It cannot be played or inspected until you allocate one of its analysis sets; Table 14.1.3 takes ITT or Safety. Allocate to match the suit of the cards around it: a Safety Demographics table completes a Population Flush.",
        badge: "Shell",
      },
      {
        title: "Footnote seals",
        detail:
          "Seals are real table footnotes. The tray holds two, and they carry to the next Blind. A bonus seal adds Chips or Mult to the card it is printed on; the sponsor rounding footnote waives the tie-rounding redline. Each shell has a fixed number of footnote slots, and no footnote can waive a fatal rule.",
        badge: "Footnote",
      },
      {
        title: "Crisis cards",
        detail:
          "Every Blind after the first opens on a crisis: an audit, an amendment, a database migration or an early review. Answer it before you play. Each choice says what it costs, one is always free, and some add a rule for the Blind, such as a hand limit or a surcharge on discards. The run's seed decides the crisis, so the same seed deals the same run.",
        badge: "Crisis",
      },
      {
        title: "The committee reads Safety only",
        detail:
          "The Dose Escalation Committee's boss debuff disables every population except Safety: an ITT output scores 0 Chips there, however clean. Five System Organ Class tables together make a MedDRA Five of a Kind.",
        badge: "Boss",
      },
      {
        title: "Traces",
        detail:
          "With a Table open on the QC Desk, T traces a flagged cell to the Listing rows behind it, so you can see which subjects were counted. Tracing is free. A Table played with its Listing earns ×2 Mult once it has a trace into that Listing and every trace is resolved. A Listing compiled against another population snapshot blocks the trace until the stale output is recompiled.",
        badge: "Trace",
      },
      {
        title: "Kaplan–Meier figures",
        detail:
          "A Figure is drawn from a parent Table. Its QC checks the curve against the data: a fixed time origin, a curve that never rises, censoring ticks and the number at risk at every milestone, which must reconcile with the parent's subjects and events. Each open discrepancy costs 1 Mult. With the parent in hand, current and validated, and every finding reconciled, the Figure scores ×2 Mult; without a valid parent it scores 0 Chips. Act I deals no Figures; Acts II and III do.",
        badge: "KM",
      },
      {
        title: "The DMC firewall",
        detail:
          "Outputs that would show treatment arms before the committee meets are dealt face down in the open session: you see their structure, never their values. Structural QC checks them without unblinding. Inspecting one anyway is an unauthorized unblinding: it is logged, and the next hand played scores ×0 Mult. The closed session turns them face up, but it needs structural QC of every blinded output in hand first. Act I blinds nothing; Acts II and III do.",
        badge: "Firewall",
      },
      {
        title: "Staged Boss encounters",
        detail:
          "Some Bosses are defended in stages. Each stage sets its session, its quota and the hands it accepts, and the table names those hands; any other hand cannot be played. The DMC milestone defense opens with an open report (400: High Table, TLF Pair or Population Flush) and ends with a closed report (25,000: Efficacy Full House only).",
        badge: "Stages",
      },
      {
        title: "SOP relics",
        detail:
          "A relic is a person or tool on your team with a name, a description and one score modifier. The rack holds five, and each shows the phase it fires in. Hand played: it adds its modifier to every hand, or only when its condition holds, such as a Figure in the hand or no redline. Card scored: it fires on each matching output as that output scores, and the card pops; the ITT Purist scores every ITT output twice. On discard: the Blind's first discard costs no base CPU. Blind start: each Blind starts with extra CPU. Relics add to the score and never change what the SAP checks, and their order never changes the total. The shop sells relics, and defending a staged Boss offers a choice of one, which you must claim before the next Blind.",
        badge: "Relic",
      },
      {
        title: "Study Budget and the shop",
        detail:
          "Clearing a Blind cashes out Study Budget: $3k, $4k or $5k by Blind, $1k for every 2 CPU left unspent, and $1k interest per $5k already held, up to $5k. Between Blinds the shop stocks two items and two packs. A reroll costs $5k, then $1k more each time in the same visit, and anything sells for half its price, rounded down. A site from a Site Activation pack adds Chips to every later hand, and its subjects enroll after the next Blind's first hand, which stales outputs built on that population.",
        badge: "Shop",
      },
      {
        title: "The run deck",
        detail:
          "Your deck is carried from Blind to Blind and act to act. Each Blind still deals the outputs its study produces, and your changes ride on top. The shop sells blank table shells: one joins your deck and is dealt in every later Blind, in this study and the next, and compiles clean once you allocate it an analysis set. Once per shop visit, Archive ($3k) takes a card out of every later deal and Duplicate ($5k) copies one. A Blind's scripted setup cannot be archived, and no deck drops below a full opening hand. The shop and Run Info list the deck the next Blind deals.",
        badge: "Deck",
      },
      {
        title: "Saved runs",
        detail:
          "The cabinet keeps the run's seed and your moves in this browser, never a blinded value, and replays them when you choose Resume run. The save is cleared when the run ends or you start a new one. A run saved before the run deck resumes with its Blinds' own decks and no shells in the shop.",
        badge: "Save",
      },
    ],
    proTips: [
      "The Expected Value only counts findings you have revealed. Unreviewed cells can hide a zero.",
      "Draft A is the messiest draft but also the most valuable once every finding is corrected.",
      "FAS and ITT are different populations here; the Total column is where a denominator slip hides.",
      "In the safety Blinds, FAS and Per-Protocol drop S-008, the subject who stopped for atrial fibrillation. An N of 5 in the Active column is the tell.",
      "A Two Pair of the AE overview and the SAE table, each with its listing, is the Big Blind's workhorse.",
      "Data keeps moving during the sponsor review. If your Safety drafts go stale, sending them back to programming (discard) is cheaper than recompiling each one, and fresh draws arrive compiled against the new snapshot.",
      "Trace every flagged cell of a Table before you play it with its Listing. One unresolved trace and the pair loses its ×2.",
      "Reconcile a Kaplan–Meier Figure before you build a Full House around it. Each open discrepancy costs Mult, and only a reconciled Figure doubles it.",
      "Run structural QC on every face-down output before you convene the closed session. One peek costs the next hand its whole score.",
    ],
    lore: {
      title: "Why statisticians double-program tables",
      story:
        "Before a clinical study report goes anywhere, a second programmer independently re-derives every number in every table, listing and figure against the Statistical Analysis Plan. Most discrepancies are small (a decimal place, a tie rounded the other way), but a wrong denominator changes every percentage in a column. This game is fictional teaching material, not clinical or regulatory advice.",
      realWorldTech: [
        "Statistical Analysis Plans",
        "Tables, Listings & Figures",
        "Independent QC",
        "Banker's Rounding",
        "Analysis Populations",
        "MedDRA System Organ Classes",
        "Dose Escalation Committees",
      ],
    },
  },

  "retro-labyrinth": {
    id: "retro-labyrinth",
    title: "Retro Labyrinth: Graveyard Roguelike",
    subtitle: "Cyberpunk Red Team Breach & Mainframe Roguelike",
    genre: "Dungeon Roguelike",
    badge: "Cyberpunk Roguelike",
    route: "/arcade/retro-labyrinth",
    storageKey: "retro_labyrinth_highscore",
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    objective:
      "Breach a corporate network as a Red Team Netrunner, routing from the DMZ Gateway to the NEURAL_WARDEN core and picking a reward after every room. Manage Cyberdeck RAM, weaponize zero-days and offensive exploits, bypass EDR sentinels, solve Hex Matrix buffer puzzles, and defeat two 3D wireframe bosses: FaceForge, then the Neural Warden.",
    quickSummary:
      "Clear six hand-built rooms with WASD/Arrows, reaching each room's EXIT once its objective is done, then choose the next room on the route map and pick a weapon, a heal or a passive. Keys 1 to 3 fire your Cyberdeck class's tools, keys 4 and 5 the weapons you pick up on the route (the default Script Kiddie carries npm install, Nmap Port Recon and EMP), and Space fires an EMP, to exploit daemon CVEs and extract encrypted payloads.",
    controls: [
      {
        action: "Move Netrunner Avatar",
        description:
          "Walk the room's corridors, collect pickups and step onto airgap route nodes.",
        key: "WASD / Arrow Keys",
      },
      {
        action: "Deploy Cyber Exploits",
        description:
          "Keys 1 to 3 fire the three tools your Cyberdeck class starts with, in hotbar order. Script Kiddie: npm install (AoE), Nmap Port Recon (expose CVEs), EMP. Other classes carry Buffer Overflow (burst crit), Airgap 0-Day (piercer), MitM Spoof (confuse) or Ransomware (freeze and bounty). Keys 4 and 5 fire weapons picked as route rewards.",
        key: "1 to 5 Keys",
      },
      {
        action: "EMP Kernel Surge",
        description:
          "Discharge an electromagnetic surge to stun all security drones and camera sentinels in the sector.",
        key: "Spacebar / Touch Action A",
      },
      {
        action: "Pause",
        description: "Pause and resume the run. Enter also resumes.",
        key: "P",
      },
      {
        action: "Continue or Retry",
        description:
          "On the room-cleared screen, tap or Tab to a next room and a reward, then Enter (or Next Room) moves on; the first room is chosen unless you pick the other, and the reward can be left. R retries this room. After a trace, Enter or R retries the room.",
        key: "Enter / R",
      },
      {
        action: "Toggle CRT Phosphor Scanlines",
        description:
          "Toggle retro CRT phosphor curvature, bloom, and scanline shader post-processing filters.",
        key: "C Key",
      },
    ],
    rules: [
      {
        title: "The Route Map",
        detail:
          "The network has seven rooms: DMZ Gateway, Active Directory, BlinkBrowse, the TSP airgap enclave, the Darknet Vault, the FaceForge boss and the NEURAL_WARDEN final boss. A run is six of them. It always opens on the DMZ Gateway and ends on FaceForge, then the NEURAL_WARDEN. After each of the first rooms you choose between two next rooms: Active Directory or a middle room first, then two of the rooms left, so one middle room or the Darknet Vault rest stop is skipped. Each run has a seed, shown on the map, and the same seed draws the same choices and rewards. Clearing the NEURAL_WARDEN completes the run.",
        badge: "Campaign",
      },
      {
        title: "Room Rewards",
        detail:
          "Every cleared room before the last offers three rewards; pick one or none. A weapon joins your loadout in slot 4 or 5 at full ammo (with a full loadout it becomes an Ammo Cache that refills every tool). A Patch Kit restores 40 HP. A passive lasts the rest of the run and stacks: Overclocked Bus (+1 RAM regen per step), Chip Cache (+1 bypass chip on entering each room), Hardened Shell (+20 max HP) or DDR5 Bank (+16 max RAM).",
        badge: "Rewards",
      },
      {
        title: "Locked Exits",
        detail:
          "A room with airgap route nodes keeps its EXIT locked until you step on every node, and a boss room keeps it locked until the boss is defeated. A locked exit is drawn as LOCK in red and blocks you like a wall. Boss volleys aim where you are heading, so change direction to dodge.",
        badge: "Objectives",
      },
      {
        title: "Cyberdeck RAM & CVE Vulnerability Synergies",
        detail:
          "Exploits draw from your Cyberdeck RAM capacity. Port scanning exposes enemy CVE vulnerabilities (Buffer Overflow, Weak SSH, Default Creds) to trigger 2.5x critical damage and chain reactions.",
        badge: "CVE Combos",
      },
      {
        title: "Hex Matrix Buffer Bypass Terminals",
        detail:
          "Locked data vaults and security airgaps feature tactile Hex Buffer minigames. Align alternating row/column byte sequences or deploy Hardware Jumper Bypass Chips to harvest Crypto bounties.",
        badge: "Hex Hacking",
      },
      {
        title: "3D Wireframe Sovereign Boss Fights",
        detail:
          "The second-last room is the FaceForge wireframe face and the last is the NEURAL_WARDEN octahedron. Each fires volleys that change across three phases as its HP falls, and its room's EXIT stays locked until it is defeated. Dodge the volleys and hit it with your tools.",
        badge: "3D Boss Fight",
      },
    ],
    proTips: [
      "Use Nmap Port Recon on room entry (key 2 for the default Script Kiddie) to reveal hidden traps and tag hostile daemons with CVE vulnerability marks.",
      "Save Hardware Bypass Chips for the terminals in the TSP enclave and the Darknet Vault, where time limits are tight.",
      "Take the Darknet Vault on the route when you are short of crypto or HP: its market and chest restock the deck before the bosses.",
      "Visit the Darknet Market to purchase DDR5 RAM overclocks and Airgap 0-Day payloads using harvested Crypto.",
    ],
    lore: {
      title: "Red Team Infiltration & Legacy Code Archaeology",
      story:
        "Every engineer has explored legacy codebases that feel like ancient, crumbling dungeons filled with deprecated dependencies, undocumented endpoints, and zombie cron jobs. Retro Labyrinth turns code maintenance and cybersecurity into a roguelike over seven rooms. The rooms are hand-built, not generated: DMZ Gateway, Active Directory, BlinkBrowse, the TSP airgap enclave with its moving walls, the Darknet Vault, the FaceForge boss and the NEURAL_WARDEN final boss. A seeded route map picks which middle rooms a run visits. Patrols, hacking terminals, raycast field-of-view, Web Audio 8-bit sound and real-time 3D vector wireframe bosses fill them in.",
      realWorldTech: [
        "Hand-Built Room Campaign",
        "Seeded PRNG Route Map",
        "Raycast Field of View",
        "CVE Vulnerability Models",
        "Hex Buffer Matrix",
        "Web Audio API",
        "3D Wireframe Projection",
      ],
    },
  },

  "meme-vault": {
    id: "meme-vault",
    title: "Meme Vault",
    subtitle:
      "8-Pad Retro Sampler, Echo Sequence Game & Easter Egg Trophy Case",
    genre: "Sound Toy & Memory Game",
    badge: "Secret Room",
    route: "/arcade/meme-vault",
    storageKey: "meme_vault_echo_best",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "Play Echo: watch the vault light a sequence of pads, repeat it exactly, and see how long a sequence you can hold. Between rounds, hunt the six hidden trophies scattered across the site.",
    quickSummary:
      "Press Start Echo. The vault plays one pad; repeat it with keys 1 to 8 or by clicking. Each sequence you repeat adds one pad and the tempo rises gently. One wrong pad ends the round, and your best streak is kept on this device.",
    controls: [
      {
        action: "Start or Stop Echo",
        description:
          "Tab to Start Echo and press Enter or Space, or click it. Stop Echo ends the round without recording it.",
        key: "Enter / Space",
      },
      {
        action: "Press a Pad",
        description:
          "Keys 1 to 8 on the top row or the numpad press the matching pad. Outside a round a pad plays its sample; during your turn it answers Echo. Keys are ignored while you type in a field or a dialog is open.",
        key: "1 – 8",
      },
      {
        action: "Sound On or Off",
        description:
          "The Sound toggle mutes every pad and the fail sting. With reduced motion on, sound stays off until you choose Play sound anyway. Echo still plays with lights alone.",
        key: "Sound Toggle",
      },
      {
        action: "Open this Manual",
        description: "Open the field manual from anywhere in the room.",
        key: "? / H",
      },
    ],
    rules: [
      {
        title: "Watch, Then Repeat",
        detail:
          "Pads are ignored while the vault plays. When it finishes, it is your turn: press the same pads in the same order. Repeating the whole sequence adds 1 to your streak and the vault plays it again with one more pad.",
        badge: "Core Loop",
      },
      {
        title: "One Mistake Ends the Round",
        detail:
          "A wrong pad plays a low fail sting and shows your final streak. Start again for a new sequence.",
        badge: "Fail State",
      },
      {
        title: "Rising Tempo",
        detail:
          "Every three pads the playback gets a little quicker, down to a floor that stays readable. Longer sequences are faster, never frantic.",
        badge: "Tempo",
      },
      {
        title: "Best Streak",
        detail:
          "Beating your stored best shows a New Echo best toast. The best is kept in this browser and survives reloads. It is separate from the trophy count that feeds the arcade score.",
        badge: "Record",
      },
      {
        title: "The Hidden Trophy Case",
        detail:
          "Six trophies are hidden around the site, not just in this room. Locked shelf slots carry a hint; the manual's pro tips nudge without spoiling.",
        badge: "Trophies",
      },
    ],
    proTips: [
      "Say the key numbers under your breath as the pads light. A spoken chunk like 3-1-7 is easier to hold than a picture.",
      "Each pad has its own sound, so Echo can be played by ear with sound on.",
      "One trophy rewards a sound you actually hear in this very room.",
      "A furry friend naps somewhere you only reach by scrolling all the way down.",
      "The terminal on one of the case studies knows a few classic UNIX jokes, and one very risky git command.",
      "The command palette (Cmd+K) has opinions about hot drinks and an old HTTP status code.",
      "Gamers of a certain age know a code that starts with up, up.",
    ],
    lore: {
      title: "A Sampler with a Memory",
      story:
        "Every sound in the vault is synthesized in the browser with the Web Audio API: oscillators, filtered noise and short envelopes, with no audio files. Echo turns the sampler into a call-and-response memory game. Its sequence comes from a seeded counter-based PRNG, so a given seed always plays the same pads and the engine can be tested exactly.",
      realWorldTech: [
        "Web Audio API",
        "AnalyserNode Oscilloscope",
        "Seeded Mulberry32 PRNG",
        "Pure State Machines",
        "localStorage Persistence",
      ],
    },
  },

  crf: {
    id: "crf",
    title: "CRF Studio",
    subtitle: "Design, test and export clinical trial data collection forms",
    genre: "Clinical Data Tool",
    badge: "CDISC CDASH / SDTM",
    route: "/crf",
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    objective:
      "A case report form (CRF) is the questionnaire a clinical trial site fills in for each patient visit. CRF Studio lets you build those forms, check them against CDISC standards, try them with test data, and export them in the formats sponsors and regulators use.",
    quickSummary:
      "Pick a sample study from the dropdown in the studio header, click a form in the left panel, and edit it on the canvas. Then open Live EDC to enter test data, or Exports to download the study. Your changes save in this browser.",
    controls: [
      {
        action: "Take the guided tour",
        description:
          "Open the studio's ⋮ menu and choose Spotlight UI Tour for a five-step walkthrough of the panels.",
        key: "⋮ menu",
      },
      {
        action: "Switch sample study",
        description:
          "Use the study dropdown at the top left of the studio. Blank Starter Canvas gives you a small form to start from.",
        key: "Study dropdown",
      },
      {
        action: "Add a field",
        description:
          "Open the Palette tab in the left panel and click a field type. It is added to the open form and selected so you can configure it on the right.",
        key: "Palette",
      },
      {
        action: "Add a standard form",
        description:
          "Click '+ CDASH Form' in the studio header to add a ready-made CDASH form such as Demographics, Vital Signs or Adverse Events.",
        key: "+ CDASH Form",
      },
      {
        action: "Switch modes",
        description:
          "Use the mode bar (Canvas, Form Grid, Matrix, AST Rules, Live EDC, aCRF Viewer, Exports), or press 1 to 7.",
        key: "1 to 7",
      },
      {
        action: "Find in the study",
        description:
          "Click Find in the studio header, or press F outside a text box, to search forms, fields and visits by name or variable and jump to them, insert a starter block, or open an export.",
        key: "F",
      },
      {
        action: "Undo and redo",
        description: "Undo or redo the last change to the study.",
        key: "Ctrl/⌘ + Z",
      },
      {
        action: "Test the open form",
        description:
          "Open the Test dock to fill the form in and watch its edit checks and show/hide rules react.",
        key: "Ctrl/⌘ + \\",
      },
    ],
    rules: [
      {
        title: "CDASH and SDTM",
        detail:
          "CDASH is the CDISC standard for how questions are collected. SDTM is the standard for how the data is submitted. Each field carries its SDTM target, which the aCRF Viewer and the annotated exports show.",
        badge: "Glossary",
      },
      {
        title: "Schedule of Assessments (SoA)",
        detail:
          "The Matrix view is the study calendar: rows are forms, columns are visits, and a check means the form is collected at that visit.",
        badge: "Glossary",
      },
      {
        title: "Edit checks",
        detail:
          "Rules that catch bad or missing data at entry time. A Hard Stop blocks saving; an Auto-Query lets the site save but raises a question for them to resolve.",
        badge: "Glossary",
      },
      {
        title: "Live EDC",
        detail:
          "An electronic data capture (EDC) simulation. Switch roles (site coordinator, investigator, monitor, data manager) to see how entry, verification and locking work under 21 CFR Part 11.",
        badge: "Glossary",
      },
    ],
    proTips: [
      "Start with a sample study to see a finished design, then try Blank Starter Canvas to build your own.",
      "Hover a mode in the mode bar for a one-line description of what it does.",
      "The conformance check in the header reads 'Verified' when the study has no CDISC issues; click it to see and fix any it finds.",
      "Nothing leaves your browser: the study is stored locally, and exports are generated on your machine.",
    ],
    lore: {
      title: "Why CRF design matters",
      story:
        "Every number in a clinical trial result starts as an answer on a CRF. A confusing question, a missing range check or an unmapped variable turns into queries for site staff, cleaning work for data managers, and delay before a drug or device can be reviewed. Designing forms against CDISC standards from the start is what makes the downstream SDTM datasets straightforward.",
      realWorldTech: [
        "CDISC CDASH",
        "CDISC SDTM",
        "CDISC ODM-XML",
        "HL7 FHIR Questionnaire",
        "21 CFR Part 11",
      ],
    },
  },
  simulator: {
    id: "simulator",
    title: "Architectural Archetype Simulator",
    subtitle: "Architecture Bias, Incident Triage & Code Review",
    genre: "Decision Sim",
    badge: "Decision Tree",
    route: "/simulator",
    accentColor: "from-blue-500/20 via-blue-500/5 to-transparent",
    badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    objective:
      "Make three engineering trade-offs (an architecture bias, a production incident mitigation and a code review safeguard) and see how they balance Systems Rigor, UI/UX Craft, Resilience and Velocity.",
    quickSummary:
      "Choose an architecture bias, triage a live latency spike and review an async pipeline. Your path maps deterministically to one of four Architectural Archetypes.",
    controls: [
      {
        action: "Select an Option",
        description:
          "Click or press Enter on an option card to commit to that trade-off. Each option adds points to the four decision axes.",
        key: "Click Option Card",
      },
      {
        action: "Step Back",
        description:
          "Use Back (or the browser's Back button) to revisit the previous question. Progress lives in the URL, so any step can be shared or bookmarked.",
        key: "Back Button",
      },
      {
        action: "Copy Report",
        description:
          "On the result screen, copy a plain-text report with your archetype, the four decision stats, your three decisions and a link that reopens the result.",
        key: "Copy Report",
      },
      {
        action: "Run Again",
        description:
          "Return to the first question to explore a different path and archetype.",
        key: "Run Again",
      },
    ],
    rules: [
      {
        title: "Four Decision Axes",
        detail:
          "Every option adds points to Systems Rigor, UI/UX Craft, Resilience and Velocity. Stats show each axis as a share of the most that axis can score on any path.",
        badge: "Score Matrix",
      },
      {
        title: "Live Incident Commander Triage",
        detail:
          "Stage 2 places you in the middle of a production latency spike. A circuit breaker with a fallback queue favours resilience; scaling read-replicas favours velocity.",
        badge: "Outage Triage",
      },
      {
        title: "Architectural Archetypes",
        detail:
          "Your bias (systems or interface) and stance (resilience or velocity) select one of four archetypes, from 'Fault-Isolation Architect' to 'Product Velocity Engineer'. Ties resolve to systems and resilience.",
        badge: "Archetype Profile",
      },
    ],
    proTips: [
      "There are no purely 'correct' choices: every decision trades speed, durability and operational overhead against each other.",
      "Question 1 sets your bias; question 2 mostly sets your stance. Change one of them to reach a different archetype.",
      "The stage badge above each question names the operational context of the challenge.",
    ],
    lore: {
      title: "Architecture Trade-offs Under Pressure",
      story:
        "Architecture is mostly a series of trade-offs made with incomplete information: which layer to harden first, how to stop a latency spike from cascading, and which safeguard a pipeline cannot ship without. The simulation compresses three of those decisions into a few minutes and shows which pattern your choices form.",
      realWorldTech: [
        "Expand-and-Contract Migrations",
        "SRE SLO/SLA Frameworks",
        "Blameless Post-Mortems",
        "Circuit Breakers",
      ],
    },
  },
};
