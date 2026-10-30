import { describe, expect, expectTypeOf, it } from "vitest";
import * as arcadeAchievements from "@/lib/arcade-achievements";
import type {
  ArcadeProgress,
  ArcadeRun,
  ArcadeTrophy,
} from "@/lib/arcade-achievements";

describe("lib/arcade-achievements export contract snapshot (#3489)", () => {
  it("exports the exact set of runtime symbols and function signatures", () => {
    expect(Object.keys(arcadeAchievements).sort()).toEqual([
      "ARCADE_TROPHIES",
      "ARCADE_UNIFIED_PROGRESS_KEY",
      "HALL_OF_FAME_TROPHY_COUNT",
      "evaluateTrophies",
      "getArcadeProgress",
      "getDefaultArcadeProgress",
      "parseScoreValue",
      "recordArcadeMilestone",
      "recordArcadeScore",
      "recordRun",
      "saveArcadeProgress",
      "unlockArcadeTrophies",
    ]);

    expect(arcadeAchievements.ARCADE_UNIFIED_PROGRESS_KEY).toBe(
      "arcade_unified_progress_v1"
    );
    expect(arcadeAchievements.HALL_OF_FAME_TROPHY_COUNT).toBe(15);

    const functionSignatures = Object.fromEntries(
      Object.entries(arcadeAchievements)
        .filter(([, value]) => typeof value === "function")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, fn]) => [name, (fn as (...args: never[]) => unknown).length])
    );

    expect(functionSignatures).toEqual({
      evaluateTrophies: 1,
      getArcadeProgress: 0,
      getDefaultArcadeProgress: 0,
      parseScoreValue: 1,
      recordArcadeMilestone: 2,
      recordArcadeScore: 4,
      recordRun: 2,
      saveArcadeProgress: 1,
      unlockArcadeTrophies: 1,
    });
  });

  it("re-exports the public TypeScript types", () => {
    expectTypeOf<ArcadeProgress>().toHaveProperty("highScores");
    expectTypeOf<ArcadeProgress>().toHaveProperty("unlockedTrophies");
    expectTypeOf<ArcadeTrophy>().toHaveProperty("id");
    expectTypeOf<ArcadeTrophy>().toHaveProperty("gameId");
    expectTypeOf<ArcadeRun>().toHaveProperty("score");
    expectTypeOf<ArcadeRun>().toHaveProperty("view");
  });

  it("snapshots the complete ARCADE_TROPHIES registry in order", () => {
    expect(arcadeAchievements.ARCADE_TROPHIES).toEqual([
      // Working With Duck
      {
        id: "duck_first_sprint",
        gameId: "working-with-duck",
        title: "Deadline Met",
        subtitle: "Working With Duck",
        description: "Complete a work sprint while keeping Duck happy.",
        icon: "Bone",
        category: "gameplay",
        milestone: "sprint_shipped",
        conditionDescription: "Ship any sprint in Working With Duck",
      },
      {
        id: "duck_master",
        gameId: "working-with-duck",
        title: "Puppy Whisperer",
        subtitle: "Working With Duck",
        description:
          "Ship a sprint with every prop saved, no accidents and Duck still a Good Boy.",
        icon: "Heart",
        category: "mastery",
        milestone: "three_star_sprint",
        conditionDescription:
          "Earn all three stars on a sprint in Working With Duck",
      },
      {
        id: "duck_graduate",
        gameId: "working-with-duck",
        title: "Good Boy Graduate",
        subtitle: "Working With Duck",
        description:
          "Ship all five sprints with Duck still on the Good Boy list.",
        icon: "Trophy",
        category: "mastery",
        milestone: "campaign_cleared",
        conditionDescription: "Clear sprint 5 in Working With Duck",
      },
      {
        id: "duck_trick_or_treat",
        gameId: "working-with-duck",
        title: "Trick or Treat",
        subtitle: "Working With Duck",
        description: "Ship a sprint with Duck dressed as a duck.",
        icon: "Pumpkin",
        category: "gameplay",
        milestone: "duck_costume_sprint",
        conditionDescription:
          "Ship a sprint in Working With Duck wearing the Halloween duck costume",
      },

      // Laser Loon
      {
        id: "laser_loon_novice",
        gameId: "laser-loon",
        title: "Flag Defender",
        subtitle: "Laser Loon",
        description: "Blast through red tape and defend the state flag design.",
        icon: "Crosshair",
        category: "gameplay",
        targetScore: 500,
        conditionDescription: "Reach 500+ points in Laser Loon",
      },
      {
        id: "laser_loon_ace",
        gameId: "laser-loon",
        title: "Capitol Flight Ace",
        subtitle: "Laser Loon",
        description:
          "Master raycast optics and defeat rival flag submissions.",
        icon: "Sparkles",
        category: "mastery",
        targetScore: 2000,
        conditionDescription: "Reach 2,000+ points in Laser Loon",
      },
      {
        id: "laser_loon_flawless_act",
        gameId: "laser-loon",
        title: "Untouched Plumage",
        subtitle: "Laser Loon",
        description: "Clear a campaign act without losing a single hit.",
        icon: "Heart",
        category: "gameplay",
        milestone: "act_no_hit",
        conditionDescription: "Clear a Laser Loon act without taking a hit",
      },
      {
        id: "laser_loon_campaign",
        gameId: "laser-loon",
        title: "Veto Overridden",
        subtitle: "Laser Loon",
        description: "Beat all four acts and their bosses in one campaign.",
        icon: "Trophy",
        category: "mastery",
        milestone: "campaign_cleared",
        conditionDescription: "Win the Laser Loon campaign",
      },
      {
        id: "laser_loon_all_stars",
        gameId: "laser-loon",
        title: "Unanimous Consent",
        subtitle: "Laser Loon",
        description: "Earn all three stars on every campaign act.",
        icon: "Sparkles",
        category: "mastery",
        milestone: "all_stars",
        conditionDescription: "Earn all 12 Laser Loon campaign stars",
      },

      // Quasi-Perfect Puzzler
      {
        id: "quasi_first_proof",
        gameId: "quasi-puzzler",
        title: "First Q.E.D.",
        subtitle: "Quasi-Perfect Puzzler",
        description: "Apply Lean 4 tactics to complete your first AST proof.",
        icon: "Brain",
        category: "gameplay",
        targetScore: 100,
        conditionDescription: "Complete at least 1 proof goal",
      },
      {
        id: "quasi_master_prover",
        gameId: "quasi-puzzler",
        title: "Formal Verifier",
        subtitle: "Quasi-Perfect Puzzler",
        description: "Prove every Act 1 level honestly, with no sorry.",
        icon: "ShieldCheck",
        category: "mastery",
        milestone: "all_levels_proven",
        conditionDescription: "Prove all 18 Act 1 levels",
      },
      {
        id: "quasi_all_gold",
        gameId: "quasi-puzzler",
        title: "Golden Lemma",
        subtitle: "Quasi-Perfect Puzzler",
        description: "Earn three stars on every Act 1 level.",
        icon: "Sparkles",
        category: "mastery",
        milestone: "all_gold",
        conditionDescription: "Earn gold (3 stars) on all 18 Act 1 levels",
      },
      {
        id: "quasi_act_two",
        gameId: "quasi-puzzler",
        title: "Almost Perfect",
        subtitle: "Quasi-Perfect Puzzler",
        description:
          "Prove every Act 2 level honestly: quantifiers, induction, inequality chains and almost perfect numbers.",
        icon: "Trophy",
        category: "mastery",
        milestone: "act_two_proven",
        conditionDescription: "Prove all 12 Act 2 levels without sorry",
      },

      // Garmin Watch Simulator
      {
        id: "garmin_survivor",
        gameId: "garmin-watch",
        title: "First Split",
        subtitle: "Monkey C Mayhem",
        description: "Reach the finish pole of a 1 km stage.",
        icon: "Cpu",
        category: "gameplay",
        milestone: "stage_cleared",
        conditionDescription: "Clear a stage in Monkey C Mayhem",
      },
      {
        id: "garmin_gc_master",
        gameId: "garmin-watch",
        title: "5K Finisher",
        subtitle: "Monkey C Mayhem",
        description: "Run all five stages and cross the 5K finish line.",
        icon: "Sparkles",
        category: "mastery",
        milestone: "run_complete",
        conditionDescription: "Finish the 5K in Monkey C Mayhem",
      },

      // Clinical Trial Chaos
      {
        id: "clinical_auditor_pass",
        gameId: "clinical-chaos",
        title: "Clean FDA Audit",
        subtitle: "Clinical Trial Chaos",
        description: "Sort SDTM domain tables and pass audit inspection.",
        icon: "ClipboardCheck",
        category: "gameplay",
        targetScore: 500,
        conditionDescription: "Reach 500+ points in Clinical Trial Chaos",
      },
      {
        id: "clinical_cdisc_pro",
        gameId: "clinical-chaos",
        title: "CDISC Champion",
        subtitle: "Clinical Trial Chaos",
        description:
          "Maintain maximum throughput under extreme regulatory pressure.",
        icon: "Trophy",
        category: "mastery",
        targetScore: 2000,
        conditionDescription: "Reach 2,000+ points in Clinical Trial Chaos",
      },
      {
        id: "clinical_nai_campaign",
        gameId: "clinical-chaos",
        title: "No Action Indicated",
        subtitle: "Clinical Trial Chaos",
        description:
          "Finish the Phase 3 campaign with an NAI inspection verdict.",
        icon: "ShieldCheck",
        category: "mastery",
        milestone: "nai_campaign",
        conditionDescription:
          "Earn an NAI verdict on Phase 3 in Clinical Trial Chaos",
      },
      {
        id: "clinical_clean_inspection",
        gameId: "clinical-chaos",
        title: "Nothing to Hide",
        subtitle: "Clinical Trial Chaos",
        description:
          "Answer every question in the campaign-finale FDA inspection from your own audit trail, and disclose every sponsor shortcut.",
        icon: "ClipboardCheck",
        category: "mastery",
        milestone: "clean_inspection",
        conditionDescription:
          "Pass the Phase 3 FDA inspection interview without a wrong answer in Clinical Trial Chaos",
      },

      // Trial & Error
      {
        id: "trial_error_first_blind",
        gameId: "trial-and-error",
        title: "Blind Cleared",
        subtitle: "Trial & Error",
        description:
          "Play Chips x Mult hands to satisfy the SAP review blind.",
        icon: "Cards",
        category: "gameplay",
        milestone: "blind_cleared",
        conditionDescription: "Clear a Blind in Trial & Error",
      },
      {
        id: "trial_error_csr_lock",
        gameId: "trial-and-error",
        title: "CSR Lock Mastery",
        subtitle: "Trial & Error",
        description:
          "Guide a candidate compound through all trial phases to lock.",
        icon: "Trophy",
        category: "mastery",
        milestone: "run_won",
        conditionDescription: "Win a Trial & Error run at CSR Lock",
      },
      {
        id: "trial_error_act_cleared",
        gameId: "trial-and-error",
        title: "Committee Survived",
        subtitle: "Trial & Error",
        description:
          "Beat an act's boss Blind and move the study to the next act.",
        icon: "ClipboardCheck",
        category: "gameplay",
        milestone: "act_cleared",
        conditionDescription: "Clear an act's boss Blind in Trial & Error",
      },

      // Study Director
      {
        id: "study_director_kickoff",
        gameId: "study-director",
        title: "Study Kickoff",
        subtitle: "Study Director",
        description:
          "Get through your first three weeks: answer the inbox, walk the floor and keep the sites running.",
        icon: "ClipboardCheck",
        category: "gameplay",
        milestone: "first_weeks",
        conditionDescription: "Reach day 15 of a study in Study Director",
      },
      {
        id: "study_director_closeout",
        gameId: "study-director",
        title: "FDA Replay Approved",
        subtitle: "Study Director",
        description:
          "Close out a study with every decision written up and nothing left to lapse.",
        icon: "ShieldCheck",
        category: "mastery",
        milestone: "clean_file",
        conditionDescription:
          "Close out a Study Director study with every decision documented and none ignored",
      },
      {
        id: "study_director_grade_a",
        gameId: "study-director",
        title: "Inspection Ready",
        subtitle: "Study Director",
        description: "Close out a study with an A regulatory grade.",
        icon: "Trophy",
        category: "mastery",
        milestone: "grade_a",
        conditionDescription: "Finish a Study Director study with grade A",
      },

      // Patty's Drive-Thru
      {
        id: "patty_drive_thru_first_rush",
        gameId: "patty-drive-thru",
        title: "First Rush",
        subtitle: "Patty's Drive-Thru",
        description:
          "Keep the line moving with fast, clean orders for one shift.",
        icon: "Headset",
        category: "gameplay",
        targetScore: 400,
        conditionDescription: "Reach 400+ points in Patty's Drive-Thru",
      },
      {
        id: "patty_drive_thru_close",
        gameId: "patty-drive-thru",
        title: "Made It to Close",
        subtitle: "Patty's Drive-Thru",
        description:
          "Work a full shift with most of the board still green when you clock out.",
        icon: "Trophy",
        category: "mastery",
        targetScore: 700,
        conditionDescription: "Reach 700+ points in Patty's Drive-Thru",
      },
      {
        id: "patty_drive_thru_zero_late",
        gameId: "patty-drive-thru",
        title: "Nobody Waited",
        subtitle: "Patty's Drive-Thru",
        description:
          "Make it to close on a standard shift with zero late orders.",
        icon: "Headset",
        category: "mastery",
        milestone: "zero_late_shift",
        conditionDescription: "Close a standard shift with no late orders",
      },
      {
        id: "patty_drive_thru_full_week",
        gameId: "patty-drive-thru",
        title: "Worked a Full Week",
        subtitle: "Patty's Drive-Thru",
        description:
          "Clock in Monday through Fry Friday and work all five days of a week.",
        icon: "Headset",
        category: "milestone",
        milestone: "full_week",
        conditionDescription: "Finish all five days of a Patty's Drive-Thru week",
      },

      // For Better or Bulk
      {
        id: "for_better_or_bulk_setup_crew",
        gameId: "for-better-or-bulk",
        title: "Setup Crew",
        subtitle: "For Better or Bulk",
        description: "Place a dozen things around the venue before 4:00.",
        icon: "Rings",
        category: "gameplay",
        targetScore: 12,
        conditionDescription: "Place 12+ things in For Better or Bulk",
      },
      {
        id: "for_better_or_bulk_everything",
        gameId: "for-better-or-bulk",
        title: "Bought Out the Roses",
        subtitle: "For Better or Bulk",
        description:
          "Buy every rose and place all 27 things the biggest plan asks for: bouquets, centerpieces, petals, chairs, lanterns and the buffet.",
        icon: "Trophy",
        category: "mastery",
        targetScore: 27,
        conditionDescription: "Place 27 things in For Better or Bulk",
      },
      {
        id: "for_better_or_bulk_three_stars",
        gameId: "for-better-or-bulk",
        title: "Three for Three",
        subtitle: "For Better or Bulk",
        description:
          "Meet all three game challenges on a finished run of the standard day.",
        icon: "Sparkles",
        category: "mastery",
        conditionDescription:
          "Meet all three game challenges on a standard-day run in For Better or Bulk",
      },
      {
        id: "for_better_or_bulk_perfect_day",
        gameId: "for-better-or-bulk",
        title: "A Perfect Day",
        subtitle: "For Better or Bulk",
        description:
          "Meet all three game challenges on a seeded day, the one the whole day shares.",
        icon: "Trophy",
        category: "mastery",
        conditionDescription:
          "Meet all three game challenges on a seeded day in For Better or Bulk",
      },
      {
        id: "for_better_or_bulk_nothing_burnt",
        gameId: "for-better-or-bulk",
        title: "Nothing Burnt",
        subtitle: "For Better or Bulk",
        description: "Finish every setup task with no batch burnt on the grill.",
        icon: "Heart",
        category: "gameplay",
        conditionDescription:
          "Finish every setup task with no burnt batches in For Better or Bulk",
      },

      // Protocol Drift
      {
        id: "protocol_drift_locked",
        gameId: "protocol-drift",
        title: "Database Locked",
        subtitle: "Protocol Drift",
        description: "Clear both Database Lock gates for Study PD-101.",
        icon: "ShieldCheck",
        category: "gameplay",
        targetScore: 100,
        conditionDescription: "Lock the Protocol Drift database",
      },
      {
        id: "protocol_drift_defensible",
        gameId: "protocol-drift",
        title: "Defensible Lock",
        subtitle: "Protocol Drift",
        description:
          "Lock the database and earn all three preventative badges without fabricating data.",
        icon: "Trophy",
        category: "mastery",
        milestone: "all_badges",
        conditionDescription:
          "Earn every Protocol Drift preventative badge at lock",
      },
      {
        id: "protocol_drift_lean_lock",
        gameId: "protocol-drift",
        title: "Lean Pipeline",
        subtitle: "Protocol Drift",
        description:
          "Lock the database with a live pipeline at or under the par chip count.",
        icon: "Cpu",
        category: "milestone",
        milestone: "lock_under_par_chips",
        conditionDescription: "Lock Protocol Drift with no more chips than par",
      },

      // Retro Labyrinth
      {
        id: "retro_labyrinth_crawler",
        gameId: "retro-labyrinth",
        title: "Dungeon Crawler",
        subtitle: "Retro Labyrinth",
        description: "Navigate shifting maze walls and defeat legacy code bugs.",
        icon: "DeviceGamepad2",
        category: "gameplay",
        targetScore: 500,
        conditionDescription: "Reach 500+ points in Retro Labyrinth",
      },
      {
        id: "retro_labyrinth_boss",
        gameId: "retro-labyrinth",
        title: "FaceForge Slayer",
        subtitle: "Retro Labyrinth",
        description:
          "Break the FaceForge wireframe boss and walk out of its arena.",
        icon: "Trophy",
        category: "gameplay",
        milestone: "faceforge_cleared",
        conditionDescription: "Clear the FaceForge boss room in Retro Labyrinth",
      },
      {
        id: "retro_labyrinth_untouched",
        gameId: "retro-labyrinth",
        title: "Zero Packets Lost",
        subtitle: "Retro Labyrinth",
        description: "Clear a boss room without a single volley landing.",
        icon: "ShieldCheck",
        category: "mastery",
        milestone: "boss_no_hit",
        conditionDescription:
          "Clear a Retro Labyrinth boss room without taking a hit from the boss",
      },
      {
        id: "retro_labyrinth_root",
        gameId: "retro-labyrinth",
        title: "Root Access",
        subtitle: "Retro Labyrinth",
        description:
          "Route through the whole network and take down the Neural Warden.",
        icon: "Cpu",
        category: "mastery",
        milestone: "run_completed",
        conditionDescription:
          "Finish a Retro Labyrinth run by clearing the Neural Warden",
      },

      // Meme Vault
      {
        id: "meme_vault_explorer",
        gameId: "meme-vault",
        title: "Soundboard Operator",
        subtitle: "Meme Vault",
        description: "Find your first hidden trophy in or around the Meme Vault.",
        icon: "Sparkles",
        category: "gameplay",
        targetScore: 100,
        conditionDescription: "Find 1 Meme Vault easter egg",
      },
      {
        id: "meme_vault_echo_5",
        gameId: "meme-vault",
        title: "Echo Chamber",
        subtitle: "Meme Vault",
        description: "Repeat a five-pad Echo sequence without a wrong pad.",
        icon: "Sparkles",
        category: "gameplay",
        milestone: "echo_streak_5",
        conditionDescription: "Reach an Echo streak of 5 in Meme Vault",
      },
      {
        id: "meme_vault_echo_10",
        gameId: "meme-vault",
        title: "Perfect Recall",
        subtitle: "Meme Vault",
        description: "Repeat a ten-pad Echo sequence without a wrong pad.",
        icon: "Trophy",
        category: "mastery",
        milestone: "echo_streak_10",
        conditionDescription: "Reach an Echo streak of 10 in Meme Vault",
      },
      {
        id: "meme_vault_cleared",
        gameId: "meme-vault",
        title: "Vault Cleared",
        subtitle: "Meme Vault",
        description:
          "Find all six hidden trophies in and around the Meme Vault.",
        icon: "Trophy",
        category: "mastery",
        targetScore: 600,
        conditionDescription: "Find all 6 Meme Vault easter eggs",
      },

      // Cross-Game Meta Achievements
      {
        id: "arcade_triathlon",
        gameId: "cross_game",
        title: "Arcade Triathlete",
        subtitle: "Portfolio Meta",
        description: "Score personal bests in at least 3 distinct mini-games.",
        icon: "Trophy",
        category: "cross_game",
        conditionDescription: "Score in 3 or more games",
      },
      {
        id: "arcade_completionist",
        gameId: "cross_game",
        title: "Portfolio Veteran",
        subtitle: "Portfolio Meta",
        description: "Participate and set high scores in 6 or more mini-games.",
        icon: "Trophy",
        category: "cross_game",
        conditionDescription: "Score in 6 or more games",
      },
      {
        id: "arcade_legend",
        gameId: "cross_game",
        title: "Hall of Famer",
        subtitle: "Portfolio Meta",
        description: "Unlock 15 game trophies across the arcade.",
        icon: "Sparkles",
        category: "cross_game",
        conditionDescription: "Unlock 15 game trophies",
      },
    ]);
  });
});
