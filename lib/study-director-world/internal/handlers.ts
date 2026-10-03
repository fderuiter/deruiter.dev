import { deskView, edcScreen } from "./channels";
import { describePerson, personState } from "./team";
import type { InteractionHandlers } from "../types";

/**
 * What E does once the team and its messages are in the world (issues
 * 1688 and 1689): facing a person opens a conversation, the phone opens your desk
 * (voicemail, mail, calls to return and write-ups), and the EDC workstation
 * opens the dashboard beside what you have seen. Opening a screen is free;
 * what you do on it costs time. Pass these to `interact`; anything they
 * leave alone falls through to the defaults.
 */
export const TEAM_INTERACTIONS: InteractionHandlers = {
  person: (world, target) => {
    if (target.kind !== "person") return null;
    const p = personState(world, target.person.memberId);
    return {
      world,
      title: target.person.name,
      lines: [describePerson(world, target.person)],
      tone: p?.mood === "overloaded" ? "bad" : "neutral",
      panel: { kind: "dialogue", memberId: target.person.memberId },
    };
  },
  station: {
    phone: (world) => {
      const desk = deskView(world);
      const waiting =
        desk.voicemail.length + desk.mail.length + desk.callbacks.length;
      return {
        world,
        title: "Your desk",
        lines: [
          waiting === 0
            ? "Nothing waiting on the desk."
            : `${waiting} waiting: ${desk.voicemail.length} voicemail, ${desk.mail.length} mail, ${desk.callbacks.length} to call back.`,
          desk.undocumented.length === 0
            ? "Everything you decided is written up."
            : `${desk.undocumented.length} decision${desk.undocumented.length === 1 ? "" : "s"} to write up.`,
        ],
        tone: desk.undocumented.length > 0 ? "bad" : "neutral",
        panel: { kind: "desk" },
      };
    },
    edc: (world) => {
      const rows = edcScreen(world);
      const red = rows.filter((r) => r.health === "red").length;
      return {
        world,
        title: "EDC workstation",
        lines: [
          "The dashboard as the sites report it, beside what you have seen yourself.",
        ],
        tone: red > 0 ? "bad" : "neutral",
        panel: { kind: "edc" },
      };
    },
  },
};
