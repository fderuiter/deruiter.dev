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
          "Press Spacebar while at your desk to rapidly push code commits and squash bugs with Good Boy multiplier bonuses.",
        key: "Spacebar / Desk Click",
      },
      {
        action: "Training Tricks",
        description:
          "Press Q (Sit), W (High Five/Paw), E (Drop It), or R (Spin) for immediate obedience, focus recovery, and Good Boy score multipliers.",
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
          "In the Dog Park, tap Spacebar to leap over agility hurdles and recall Duck with the ultrasonic whistle.",
        key: "Spacebar / Whistle",
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
      "Aim with the cursor or touch controls, fire ruby eye-lasers and cryogenic ice mortars, collect Hotdish power-ups, and unleash the Haunting Loon Tremolo ultimate shockwave to claim victory!",
    controls: [
      {
        action: "Aim & Fire Laser Arsenal",
        description:
          "Aim crosshair with cursor or touch; left-click, drag or hold Space to fire the active laser beam (Ruby Laser, Cyan Pulse, Aurora Wave, or Cryo Mortar).",
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
          "Mortar ice blocks bounce off lake boundaries, encasing targets in ice. Shattering frozen targets awards 2x points and cascades shrapnel.",
        badge: "2x Shatter Combo",
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
      "Grab floating Tater Tot Hotdish pickups for instant zero-cooldown laser overcharge frenzy.",
      "Bouncing Cryo Mortar ice blocks off the canvas floor and ceiling creates hazardous pinball walls for rival flags.",
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
        action: "The 'Sorry' Escape Valve",
        description:
          "Admit defeat on the current branch using `sorry`. This keeps the engine running but permanently incurs a -100 Morality Penalty.",
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
          "Each tactic, including a failed one, consumes simulated memory. Story Mode starts with twice the Hacker Mode budget. In either mode, hitting 0 GB stops the simulated tactic session and the level must be reset.",
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
    title: "Monkey C Mayhem: Garmin Schvitz App",
    subtitle: "Embedded Systems & Garmin Schvitz App Simulator",
    genre: "Embedded Systems",
    badge: "Monkey C Mayhem",
    route: "/arcade/garmin-watch",
    storageKey: "garmin_simulator_high_score",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "Keep your custom Connect IQ watch face executing inside an unforgiving 32KB RAM limit on a circular 280×280 MIP display while managing GC freezes and thermal condensation.",
    quickSummary:
      "Use physical bezel buttons to cycle sensor widgets, swipe across the watch crystal to wipe fog, and trigger manual GC before running out of memory.",
    controls: [
      {
        action: "Bezel Buttons",
        description:
          "Click the physical watch bezel buttons: UP, DOWN, SELECT, and BACK to navigate watch apps and menus.",
        key: "Bezel Clicks",
      },
      {
        action: "Wipe Thermal Fog",
        description:
          "Click and drag your cursor across the circular glass face to wipe away condensation built up from high heart-rate intervals.",
        key: "Drag Across Screen",
      },
      {
        action: "Sensor Rate Toggle",
        description:
          "Switch GPS, Optical HR, and Accelerometer polling frequencies to balance telemetry fidelity against battery drain.",
        key: "Sensor Toggles",
      },
      {
        action: "Force Garbage Collection",
        description:
          "Execute manual memory compaction to reclaim abandoned object references before hitting the 32KB heap ceiling.",
        key: "G / Backspace / BACK",
      },
    ],
    rules: [
      {
        title: "32KB Monkey C Heap Ceiling",
        detail:
          "Connect IQ watch face apps run in an isolated virtual machine with a strict 32KB memory ceiling. Exceeding 32,768 bytes triggers an immediate Out-Of-Memory system halt.",
        badge: "32KB Limit",
      },
      {
        title: "500ms GC Stop-The-World Freeze",
        detail:
          "Running garbage collection freezes UI rendering and sensor capture for 500ms. Time your GC cycles during low-velocity running intervals.",
        badge: "GC Pause",
      },
      {
        title: "Thermal Condensation Fog",
        detail:
          "During high HR workouts, perspiration condensation obscures the MIP display. Failure to wipe fog prevents reading cadence and heart rate alerts.",
        badge: "Fog Hazard",
      },
    ],
    proTips: [
      "Avoid allocating transient objects inside the `onUpdate(dc)` 1Hz rendering loop to prevent garbage build-up.",
      "Wipe screen fog early before it occludes the battery life percentage indicator.",
      "Drop GPS polling from 1Hz to 0.1Hz when battery drops below 15%.",
    ],
    lore: {
      title: "Engineering for Wearable Hardware Constraints",
      story:
        "Smartwatches like the Garmin Forerunner and Fenix utilize ultra-low-power Memory-in-Pixel (MIP) displays and ultra-constrained microcontrollers capable of running for 14+ days on a single charge. Developing for Garmin's Monkey C language demands relentless memory optimization: reusing object pools, avoiding dynamic closures, and managing strict byte-aligned bitmaps.",
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
      "Solve Controlled Terminology discrepancies via multi-choice puzzles, route validated dossier packets to tiered EDC stations with hotkeys [1-6], deploy power-ups [Q, W, E, R], and export authentic CDISC ODM XML / SDTM CSV datasets.",
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
        key: "Keys [1-6] or Click Station",
      },
      {
        action: "Deploy Regulatory Lifelines",
        description:
          "Deploy combo-charged power-ups: [Q] FDA Coffee Break (freeze auditor), [W] CDISC Auto-Clean (clean active dossier), [E] Site Query Extension (+12s), [R] Fast-Track 21 CFR Pass (instant sign).",
        key: "Keys [Q, W, E, R]",
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
        title: "Controlled Terminology & MedDRA Coding",
        detail:
          "Selecting incorrect CT codes or unstandardized units incurs auditor suspicion penalties. Correct answers award bonus points and recharge power-up lifelines.",
        badge: "CDISC CT & MedDRA",
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
          "At the end of each shift or upon trial termination, receive a formal BIMO inspection report with NAI (Approved), VAI (Voluntary Action), or OAI (Form 483 Issued) determination.",
        badge: "BIMO Inspection",
      },
    ],
    proTips: [
      "Keep an eye on Serious Adverse Events (⚡ SAE): they have shorter timers and grant +300 bonus points upon compliant signature.",
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
    badge: "Attention Budget",
    route: "/arcade/study-director",
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective:
      "Take Study 24-081, a randomized PK study for a first-time biotech, from kickoff to closeout: a scientifically valid, compliant study, on time, without wrecking the budget, the sponsor relationship or your team. Six meters compete and you cannot keep them all high. At the end the sponsor, the company, the science and the regulator each give a verdict, and the FDA may come to ask about your decisions.",
    quickSummary:
      "Each day you have 5 attention points. Answer messages in the inbox (1 to 5 choose an option), audit a site to see what the dashboard is hiding, then end the day. Documenting a decision costs 1 more attention. Skipped documentation adds documentation debt, which the inspection replays. Your run saves as you play.",
    controls: [
      {
        action: "Choose an option",
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
        action: "End the day",
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
          "You get 5 attention points a day and unspent points do not carry over. Answering, delegating and auditing all spend them, so some messages will go unanswered.",
        badge: "Attention",
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
          "Locking the database turns open queries into delay. The sponsor rates you in stars, the company reports margin and timeline variance, the science reports evaluable and missing data, and the regulator grades inspection readiness. The game then names which kind of Study Director you were, from what you actually did.",
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
          "Each Blind has its own SAP, deck and target, and its CPU refills at the start of each Blind (unspent CPU does not carry over). Clearing a Blind moves you to the next; failing one ends the run, and Restart run starts again from Act I's Small Blind.",
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
        title: "Saved runs",
        detail:
          "The cabinet keeps the run's seed and your moves in this browser, never a blinded value, and replays them when you choose Resume run. The save is cleared when the run ends or you start a new one.",
        badge: "Save",
      },
    ],
    proTips: [
      "The Expected Value only counts findings you have revealed. Unreviewed cells can hide a zero.",
      "Draft A is the messiest draft but also the most valuable once every finding is corrected.",
      "FAS and ITT are different populations here; the Total column is where a denominator slip hides.",
      "In the safety Blinds, FAS and Per-Protocol drop S-008, the subject who stopped for atrial fibrillation. An N of 5 in the Active column is the tell.",
      "A Two Pair of the AE overview and the SAE table, each with its listing, is the Big Blind's workhorse.",
      "Data keeps moving during the sponsor review. If your Safety drafts go stale, sending them back to programming (discard) is cheaper than recompiling each one, and the reruns at the bottom of the deck arrive current.",
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
    storageKey: "retro_labyrinth_high_score",
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    objective:
      "Infiltrate fortified corporate mainframe subnets as an autonomous Red Team Netrunner. Manage Cyberdeck RAM, weaponize zero-days and offensive exploits, bypass EDR sentinels, solve tactile Hex Matrix buffer puzzles, and defeat the 3D Wireframe Sovereign Boss.",
    quickSummary:
      "Navigate procedural subnets with WASD/Arrows and reach each room's EXIT. Keys 1 to 3 fire your Cyberdeck class's tools (the default Script Kiddie carries npm install, Nmap Port Recon and EMP), and Space fires an EMP, to exploit daemon CVEs and extract encrypted payloads.",
    controls: [
      {
        action: "Move Netrunner Avatar",
        description:
          "Navigate through procedural subnet corridors and step onto discovery nodes.",
        key: "WASD / Arrow Keys",
      },
      {
        action: "Deploy Cyber Exploits",
        description:
          "Fire the three tools your Cyberdeck class starts with, in hotbar order. Script Kiddie: npm install (AoE), Nmap Port Recon (expose CVEs), EMP. Other classes carry Buffer Overflow (burst crit), Airgap 0-Day (piercer), MitM Spoof (confuse) or Ransomware (freeze and bounty).",
        key: "1, 2, 3 Keys",
      },
      {
        action: "EMP Kernel Surge",
        description:
          "Discharge an electromagnetic surge to stun all security drones and camera sentinels in the sector.",
        key: "Spacebar / Touch Action A",
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
          "The mainframe climax pits you against the 3D Vector Kernel Warden. Dodge rotating projectile volleys and strike the core as defense shields rotate across phases.",
        badge: "3D Boss Fight",
      },
    ],
    proTips: [
      "Use Nmap [1] on room entry to reveal hidden traps and tag hostile daemons with CVE vulnerability marks.",
      "Save Hardware Bypass Chips for Tier 3 & 4 encrypted vaults where time limits are tight.",
      "Visit the Darknet Market to purchase DDR5 RAM overclocks and Airgap 0-Day payloads using harvested Crypto.",
    ],
    lore: {
      title: "Red Team Infiltration & Legacy Code Archaeology",
      story:
        "Every engineer has explored legacy codebases that feel like ancient, crumbling dungeons filled with deprecated dependencies, undocumented endpoints, and zombie cron jobs. Retro Labyrinth turns code maintenance and cybersecurity into a playable roguelike using cellular automata dungeon generation, raycasted field-of-view, Web Audio 8-bit sound synthesis, and real-time 3D vector wireframe rendering.",
      realWorldTech: [
        "Cellular Automata",
        "Bresenham FOV Raycasting",
        "CVE Vulnerability Models",
        "Hex Buffer Matrix",
        "Web Audio API",
        "3D Wireframe Projection",
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
    title: "Engineering Leadership Simulator",
    subtitle: "Executive Decision Tree & Incident Commander",
    genre: "Leadership Sim",
    badge: "Decision Tree",
    route: "/simulator",
    accentColor: "from-blue-500/20 via-blue-500/5 to-transparent",
    badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    objective:
      "Navigate high-stakes technical leadership, production incident triage, and organizational scaling dilemmas to balance Technical Depth, Alignment, UI Craft, and Resilience.",
    quickSummary:
      "Evaluate realistic engineering scenarios, choose strategic trade-offs, and generate a verified Leadership Archetype profile summarizing your management philosophy.",
    controls: [
      {
        action: "Select Strategic Option",
        description:
          "Click option cards to choose your leadership decision for the active stage. Each option carries distinct 4-axis trade-offs.",
        key: "Click Option Card",
      },
      {
        action: "Review Dimension Impact",
        description:
          "Hover over option descriptions to preview the systemic consequences on Tech Depth, Team Alignment, UI Polish, and Resilience.",
        key: "Hover Impact",
      },
      {
        action: "Copy Leadership Assessment",
        description:
          "At the conclusion of the simulation, generate and copy a Markdown/JSON report of your leadership archetype and decision log.",
        key: "Export Button",
      },
      {
        action: "Restart Simulation",
        description:
          "Reset the decision tree to explore alternative incident mitigation pathways and divergent architectural strategies.",
        key: "Reset Button",
      },
    ],
    rules: [
      {
        title: "4-Dimensional Evaluation Matrix",
        detail:
          "Decisions adjust 4 core competencies: Technical Architecture, Organizational Alignment, User Experience Polish, and Operational Resilience.",
        badge: "Score Matrix",
      },
      {
        title: "Live Incident Commander Triage",
        detail:
          "Stage 2 places you in the middle of a live production outage. Balancing short-term mitigation (circuit breakers, read-replicas) against root-cause durability determines your outcome.",
        badge: "Outage Triage",
      },
      {
        title: "Leadership Archetype Synthesis",
        detail:
          "Your aggregate path maps to distinguished engineering leadership archetypes: from 'Pragmatic Systems Architect' to 'Product Velocity Champion'.",
        badge: "Archetype Profile",
      },
    ],
    proTips: [
      "There are no purely 'correct' choices: every decision involves deliberate trade-offs between speed, durability, and operational overhead.",
      "High resilience choices protect against catastrophic cascading outages during subsequent stages.",
      "Review the stage badge indicators to understand the operational context of each challenge.",
    ],
    lore: {
      title: "Staff+ and Engineering Management Decision Frameworks",
      story:
        "Great engineering leaders don't just write clean code; they manage risk, mentor teams through high-severity outages, and make architectural decisions that compound positively over years. This interactive simulation models real-world Staff+ engineering trade-offs: from Expand-and-Contract schema migrations to blameless post-mortem cultures.",
      realWorldTech: [
        "Expand-and-Contract Migrations",
        "SRE SLO/SLA Frameworks",
        "Blameless Post-Mortems",
        "Circuit Breakers",
      ],
    },
  },
};
