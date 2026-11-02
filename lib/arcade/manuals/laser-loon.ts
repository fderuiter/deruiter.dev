import type { FieldManualData } from "./types";

export const LASER_LOON_MANUAL: FieldManualData = {
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
        "Advance through Lake Minnetonka, the State Fair, the Redesign Commission and the Capitol Rotunda. Each boss fights its own way: the Mega Mosquito Queen calls in swarms, the Butter Colossus lobs pats in high arcs, the Starflake Finalist fires star bursts behind a turning shield that turns your beam away (shoot through the open side, or use the Tremolo), and the Grand Veto Gavel slams walls of amendments with one gap to fly through.",
      badge: "4-Act Campaign",
    },
    {
      title: "Arcade Survival",
      detail:
        "Three hearts and no finish line. Every 30 seconds a new wave arrives with the next act's enemies (Lake, Fair, Hearing, Capitol, then round again), the crowd grows, and from the second wave the enemies shoot back, faster each wave. Your score and the time you lasted are saved separately from the campaign's best.",
      badge: "Endless Waves",
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
      "In late 2023, the Minnesota State Emblems Redesign Commission invited citizen submissions. Fred de Ruiter submitted 'F277: Laser Loon': a majestic common loon blasting twin crimson lasers across azure waters. The design became a worldwide viral sensation, featured in The New York Times, The Washington Post, and NPR. Fred released F277 into the public domain (CC0), launching a grassroots civic campaign that raised over $13,500 for the Saint Paul Public Library Foundation.",
    realWorldTech: [
      "Raycast Collision Vectors",
      "Web Audio Dual-Oscillator Synthesis",
      "Multi-Phase Boss AI",
      "Deterministic State Progression",
    ],
  },
};
