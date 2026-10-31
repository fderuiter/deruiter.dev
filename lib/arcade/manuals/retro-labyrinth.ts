import type { FieldManualData } from "./types";
import { manualControlsFromActions } from "../input";
import { LABYRINTH_ACTIONS } from "@/lib/retro-labyrinth/actions";

export const RETRO_LABYRINTH_MANUAL: FieldManualData = {
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
    // The key column comes from the game's action map (#2376), so the
    // manual names the keys the game binds.
    ...manualControlsFromActions(LABYRINTH_ACTIONS, [
      {
        group: "move",
        action: "Move Netrunner Avatar",
        description:
          "Walk the room's corridors, collect pickups and step onto airgap route nodes.",
      },
      {
        group: "tools",
        action: "Deploy Cyber Exploits",
        description:
          "Keys 1 to 3 fire the three tools your Cyberdeck class starts with, in hotbar order. Script Kiddie: npm install (AoE), Nmap Port Recon (expose CVEs), EMP. Other classes carry Buffer Overflow (burst crit), Airgap 0-Day (piercer), MitM Spoof (confuse) or Ransomware (freeze and bounty). Keys 4 and 5 fire weapons picked as route rewards.",
      },
      {
        group: "emp",
        action: "EMP Kernel Surge",
        description:
          "Discharge an electromagnetic surge to stun every security drone in the sector.",
        alsoKey: "Touch Action A",
      },
      {
        group: "market",
        action: "Darknet Market",
        description:
          "At the Darknet Vault rest stop, open the Market to spend crypto on a hotfix patch, RAM, bypass chips, a 0-Day injector or the CVE Threat Feed.",
      },
      {
        group: "pause",
        action: "Pause",
        description: "Pause and resume the run. Enter also resumes.",
      },
      {
        group: "cards",
        action: "Continue or Retry",
        description:
          "On the room-cleared screen, tap or Tab to a next room and a reward, then Enter (or Next Room) moves on; the first room is chosen unless you pick the other, and the reward can be left. R retries this room. After a trace, Enter or R retries the room.",
      },
      {
        group: "crt",
        action: "Toggle CRT Phosphor Scanlines",
        description:
          "Toggle retro CRT phosphor curvature, bloom, and scanline shader post-processing filters.",
      },
    ]),
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
      title: "Firmware Bay & Class Unlocks",
      detail:
        "Crypto you harvest is banked on this device across runs. Between runs, open Firmware Upgrades (on the trace card, the run-complete card or the class picker) to spend it on four permanent tracks of three tiers each, costing 300, 700 and 1,200 crypto: RAM Expansion (+8 GB max RAM per tier), Scan Accelerator (+1 hex terminal buffer slot per tier), Payload Amplifier (+0.5 tile AoE exploit radius per tier) and Chip Fabricator (+1 starting bypass chip per tier). A tier takes effect from the next run. Script Kiddie and Cryptanalyst are open from the start; clearing the FaceForge boss room unlocks the APT Specialist, and finishing a run by clearing the NEURAL_WARDEN unlocks the Hardware Hacker. Locked classes show in the picker with the milestone that opens them; a profile saved before the locks keeps all four. The APT Specialist's +25% blast radius multiplies the Payload Amplifier radius too.",
      badge: "Meta Progression",
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
        "The second-last room is the FaceForge wireframe face and the last is the NEURAL_WARDEN octahedron. Each fires volleys that change across three phases as its HP falls, and its room's EXIT stays locked until it is defeated. FaceForge fans and rings its shots at you. The NEURAL_WARDEN fights differently: in phase 1 it lights four lanes (a + or an X) just before it fires down them, in phase 2 it sweeps a turning two-ended beam, and in phase 3 it fires the lanes you stand nearest plus a fast seeker. Walls stop every shot. Dodge the volleys and hit it with your tools.",
      badge: "3D Boss Fight",
    },
  ],
  proTips: [
    "Use Nmap Port Recon on room entry (key 2 for the default Script Kiddie) to tag hostile daemons with CVE vulnerability marks.",
    "Save Hardware Bypass Chips for the 5x5 terminals deeper in the route, where the target sequence is longest.",
    "Take the Darknet Vault on the route when you are short of crypto or HP: its market and chest restock the deck before the bosses.",
    "The Darknet Market trades only at the Darknet Vault rest stop: buy DDR5 RAM overclocks and Airgap 0-Day payloads there with harvested Crypto.",
    "A lost run still banks the crypto of every room you cleared, so a few Firmware Bay tiers make the next attempt sturdier.",
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
};
