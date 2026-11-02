import type { FieldManualData } from "./types";

export const PATTY_DRIVE_THRU_MANUAL: FieldManualData = {
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
    "Orders arrive through the headset and go up on the kitchen display, where they turn yellow, then red. Ring each one up on the register, re-enter any drink the dispenser drops, flag Dale for coffee you are too young to brew, and bump the order when it is done. If you stand still too long, Bo notices. A few times a shift someone puts a question to you: serve the stale fries, cover Dale's short till, tell a customer the shake machine is broken. You have a few seconds to answer while the cars keep coming, and what you choose decides how the shift ends. The shift ends with a pay stub, a closing note and a score: points for every car, less for late ones, plus extra for orders bumped while still green, for a streak of orders rung without a wrong entry, and for the Dignity you still have at close. Before clocking in you can pick a practice shift (lunch rush, failing dispenser, strict management); those do not count toward your score, and any shift's data downloads as JSON or CSV from the pay stub page. Or work a week of shifts, Monday to Friday: each day is different, each ends on its own diary page, and each day's score counts on its own. The five days add up to a week total, kept as your best week, and finishing all five earns a trophy.",
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
      description:
        "Selects an open order by the small key number on its ticket, which is its place on the board, not its order number.",
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
    {
      action: "Answer a question",
      description:
        "Picks the first or second answer when someone puts a question to you mid-shift. The buttons work too.",
      key: "Q / E",
    },
    {
      action: "Pause",
      description:
        "Stops the shift clock. Press it again to resume. In the 3D booth, Esc first steps back from the register.",
      key: "P or Esc",
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
    {
      title: "Questions with no good answer",
      detail:
        "Three times a shift Bo, Dale or a customer asks you something, and each answer trades drive-thru speed against Dignity or pay. Nothing stops while you think; if the timer runs out, whatever happens when nobody speaks up happens. Pick More time to decide before clocking in for twice as long. Your answers are written in the diary, and they quietly add up to how much you stood with the crew: make it to close and the shift ends as the Company Man, a Silent Exit or a Walkout. Running out of speed or Dignity still ends it first.",
      badge: "Dilemmas",
    },
    {
      title: "A week of shifts",
      detail:
        "Monday is a normal shift. On Tuesday the drink machine is broken, Wednesday has two rushes, Thursday is your eighteenth birthday so you can brew coffee yourself, and Fry Friday is the busiest day. Dignity and drive-thru speed carry halfway back toward their usual start into the next day, so a bad day leaves you worse off but never ends the week. The week saves after each day, so you can stop and come back.",
      badge: "Week",
    },
    {
      title: "Arcade Daily",
      detail:
        "Play daily on the arcade hub opens today's shift seed, the same cars for everyone until midnight UTC. A standard single shift finished on it records its shift score as today's daily best on the hub. Practice scenarios and weeks do not count.",
      badge: "Daily",
    },
  ],
  proTips: [
    "Look at the order screen before you zoom into the register.",
    "Ring the burger before you go looking for the pickles.",
    "Flag Dale the moment a coffee shows up.",
    "When there are no cars, wipe something.",
    "In a week, protect your Dignity early: what you end Monday with, you start Tuesday with.",
    "A walkout takes friends and enough Dignity left to stand up. Siding with the crew all week carries into Friday.",
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
};
