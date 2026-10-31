import type { FieldManualData } from "./types";

export const TRIAL_AND_ERROR_MANUAL: FieldManualData = {
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
        "A relic is a person or tool on your team with a name, a description and one score modifier. The rack holds five, and each shows the phase it fires in. Hand played: it adds its modifier to every hand, or only when its condition holds, such as a Figure in the hand or no redline. Card scored: it fires on each matching output as that output scores, and the card pops; the ITT Purist scores every ITT output twice. On discard: the Blind's first discard costs no base CPU, or each discard this Blind adds the relic's bonus to every later hand. Blind start: each Blind starts with extra CPU, and some relics add more in each later act. Synergy relics scale with what you build up this Blind: a stale output in hand, a redline fixed or a hand already played. Relics add to the score and never change what the SAP checks, and their order never changes the total. The shop sells relics, and defending a staged Boss offers a choice of one, which you must claim before the next Blind.",
      badge: "Relic",
    },
    {
      title: "Study Budget and the shop",
      detail:
        "Clearing a Blind cashes out Study Budget: $3k, $4k or $5k by Blind, $1k for every 2 CPU left unspent, and $1k interest per $5k already held, up to $5k. Between Blinds the shop stocks two items and two packs. Each act has its own shop: Act II and Act III stock stronger relics that Act I never sells. Every relic is Common, Uncommon or Rare, marked with a dot, a diamond or a star; the shop draws commons most often, and a rare costs at least $8k. The Codex describes each relic's trigger. A reroll costs $5k, then $1k more each time in the same visit, and anything sells for half its price, rounded down. A site from a Site Activation pack adds Chips to every later hand, and its subjects enroll after the next Blind's first hand, which stales outputs built on that population.",
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
        "The cabinet keeps the run's seed and your moves in this browser, never a blinded value, and replays them when you choose Resume run. The save is cleared when the run ends or you start a new one. A run saved before the run deck resumes with its Blinds' own decks and no shells in the shop, and a run saved before each act had its own shop resumes with the one shop every act shared.",
      badge: "Save",
    },
    {
      title: "Arcade Daily",
      detail:
        "The Daily Protocol is this game's Arcade Daily. Play daily on the arcade hub opens today's seed in the New run dialog, under Virtual Biotech at stake 1, and a finished run files its best hand as today's daily best beside the other games' dailies. Old Daily Protocol links still give the same seeds.",
      badge: "Daily",
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
};
