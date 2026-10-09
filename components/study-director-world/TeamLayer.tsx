"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  DELEGATION_VERBS,
  answerCall,
  brushOff,
  decide,
  delegate,
  deskView,
  documentAtDesk,
  edcScreen,
  endMeeting,
  eventDialogue,
  formatClock,
  hallwayCatch,
  ignoreCall,
  markRaised,
  messagesFrom,
  openAtDesk,
  relationshipCard,
  ringingCall,
  sendToVoicemail,
  sponsorAgenda,
  startMeeting,
  talk,
  type DelegationVerb,
  type DialogueLine,
  type EventDialogue,
  type EventVia,
  type InteractionOutcome,
  type MeetingReport,
  type PersonPlacement,
  type WorldRefusal,
  type WorldState,
} from "@/lib/study-director-world";
import { DialogueBox, type Speaker } from "./DialogueBox";
import {
  DialogueLines,
  Overlay,
  OverlayButton,
  RelationshipCardView,
} from "./TeamPieces";

const VERB_LABEL: Record<DelegationVerb, string> = {
  askStatus: "Ask status · 10 min",
  assign: "Assign task · 10 min",
  review: "Review work · 20 min",
  coach: "Coach · 45 min",
  escalate: "Escalate · 10 min",
  takeOver: "Take it yourself · 60 min",
};

const REFUSED: Record<WorldRefusal, string> = {
  "too-late": "It is too late for that. Go home.",
  "too-tired": "You are too tired for that. Have a coffee or go home.",
  "unknown-action": "That can't be done right now.",
  "study-complete": "The study is over.",
  unreachable: "You need to be in the conference room.",
};

type Conversation =
  | { kind: "person"; memberId: string; lines: DialogueLine[] }
  | {
      kind: "event";
      dialogue: EventDialogue;
      after: DialogueLine[] | null;
      /** True when it was opened at the desk, where it can be written up. */
      atDesk: boolean;
    }
  | { kind: "desk"; lines: DialogueLine[] }
  | { kind: "edc" }
  | { kind: "report"; report: MeetingReport };

const DESK_VIAS: readonly EventVia[] = ["mail", "voicemail", "callback"];

/** A speaker for the dialogue box: a team member with a portrait, or anyone else by name. */
function speakerFor(world: WorldState, name: string): Speaker {
  const member = world.study.team.find((m) => m.name === name);
  if (!member) return { name, role: "Outside the team" };
  const card = relationshipCard(world, member.id);
  return {
    name,
    role: card?.role ?? member.role,
    member: { role: member.role, workload: member.workload },
    hearts: card?.hearts,
  };
}

/** The device a conversation is held on: the phone, a screen, or none (face to face). */
function deviceForEvent(via: EventVia): "phone" | "monitor" | undefined {
  if (via === "phone") return "phone";
  if (DESK_VIAS.includes(via) || via === "meeting") return "monitor";
  return undefined;
}

/**
 * The team, the phone and the stations on top of the floor (#1688, #1689):
 * conversations, delegation, calls, the desk, the EDC and meetings. World
 * rules live in `lib/study-director-world`; this keeps what is open and
 * turns buttons into world calls.
 */
export function useTeamLayer({
  world,
  setWorld,
  announce,
  refocus,
}: {
  world: WorldState;
  setWorld: (world: WorldState) => void;
  announce: (text: string) => void;
  refocus: () => void;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const ringing = useMemo(() => ringingCall(world), [world]);

  const close = useCallback(() => {
    setConversation(null);
    refocus();
  }, [refocus]);

  const refuse = useCallback(
    (reason: WorldRefusal) => announce(REFUSED[reason]),
    [announce]
  );

  const openEvent = useCallback(
    (w: WorldState, eventId: string, via: EventVia) => {
      const dialogue = eventDialogue(w, eventId, via);
      if (!dialogue) return false;
      setConversation({
        kind: "event",
        dialogue,
        after: null,
        atDesk: DESK_VIAS.includes(via),
      });
      announce(`${dialogue.speaker}: ${dialogue.subject}`);
      return true;
    },
    [announce]
  );

  /** Opens the screen an interaction asked for. False if it asked for none. */
  const open = useCallback(
    (outcome: InteractionOutcome) => {
      const panel = outcome.panel;
      if (!panel) return false;
      if (panel.kind === "dialogue") {
        const result = talk(outcome.world, panel.memberId);
        if (!result.ok) {
          refuse(result.reason);
          return true;
        }
        setWorld(result.world);
        setConversation({
          kind: "person",
          memberId: panel.memberId,
          lines: result.lines,
        });
        announce(
          `${outcome.title}: ${result.lines.map((l) => l.text).join(" ")}`
        );
      } else if (panel.kind === "desk") {
        setWorld(outcome.world);
        setConversation({ kind: "desk", lines: [] });
        announce("Your desk.");
      } else {
        setWorld(outcome.world);
        setConversation({ kind: "edc" });
        announce("EDC workstation.");
      }
      return true;
    },
    [announce, refuse, setWorld]
  );

  /**
   * Checks whether anyone stops the player after a move. Returns true when
   * someone did, so the caller stops walking.
   */
  const catchUp = useCallback(
    (next: WorldState, people: readonly PersonPlacement[]) => {
      if (conversation) return false;
      const caught = hallwayCatch(next, people);
      if (!caught) return false;
      const marked = markRaised(next, caught.eventId);
      setWorld(marked);
      return openEvent(marked, caught.eventId, "hallway");
    },
    [conversation, openEvent, setWorld]
  );

  const choose = useCallback(
    (optionId: string) => {
      if (conversation?.kind !== "event" || conversation.after) return;
      const { dialogue } = conversation;
      const result = decide(world, dialogue.eventId, optionId, dialogue.via);
      if (!result.ok) {
        refuse(result.reason);
        return;
      }
      setWorld(result.world);
      setConversation({ ...conversation, after: result.lines });
      announce(result.lines.map((l) => l.text).join(" "));
    },
    [announce, conversation, refuse, setWorld, world]
  );

  const leaveEvent = useCallback(() => {
    if (conversation?.kind === "event" && !conversation.after) {
      if (conversation.dialogue.via === "hallway") {
        setWorld(brushOff(world, conversation.dialogue.eventId));
        announce(`${conversation.dialogue.speaker} will catch you later.`);
      }
    }
    if (conversation?.kind === "event" && conversation.atDesk) {
      setConversation({ kind: "desk", lines: conversation.after ?? [] });
      return;
    }
    close();
  }, [announce, close, conversation, setWorld, world]);

  const verb = useCallback(
    (memberId: string, v: DelegationVerb) => {
      const result = delegate(world, memberId, v);
      if (!result.ok) {
        refuse(result.reason);
        return;
      }
      setWorld(result.world);
      setConversation({ kind: "person", memberId, lines: result.lines });
      announce(result.lines.map((l) => l.text).join(" "));
    },
    [announce, refuse, setWorld, world]
  );

  const writeUp = useCallback(
    (eventId: string) => {
      const result = documentAtDesk(world, eventId);
      if (!result.ok) {
        refuse(result.reason);
        return;
      }
      setWorld(result.world);
      setConversation({ kind: "desk", lines: result.lines });
      announce(result.lines.map((l) => l.text).join(" "));
    },
    [announce, refuse, setWorld, world]
  );

  const deskOpen = useCallback(
    (eventId: string, via: "mail" | "voicemail" | "callback") => {
      const result = openAtDesk(world, eventId, via);
      if (!result.ok) {
        refuse(result.reason);
        return;
      }
      setWorld(result.world);
      openEvent(result.world, eventId, via);
    },
    [openEvent, refuse, setWorld, world]
  );

  const phone = useCallback(
    (action: "answer" | "ignore" | "voicemail") => {
      if (!ringing) return;
      if (action === "answer") {
        const result = answerCall(world, ringing.eventId);
        if (!result.ok) {
          refuse(result.reason);
          return;
        }
        setWorld(result.world);
        openEvent(result.world, ringing.eventId, "phone");
        return;
      }
      setWorld(
        action === "ignore"
          ? ignoreCall(world, ringing.eventId)
          : sendToVoicemail(world, ringing.eventId)
      );
      announce(
        action === "ignore"
          ? `You let it ring. ${ringing.from} will call back.`
          : `${ringing.from} goes to voicemail. It will be on your desk.`
      );
      refocus();
    },
    [announce, openEvent, refocus, refuse, ringing, setWorld, world]
  );

  const meet = useCallback(
    (kind: "team" | "sponsor", attendees: string[]) => {
      const result = startMeeting(world, kind, attendees);
      if (!result.ok) {
        refuse(result.reason);
        return;
      }
      setWorld(result.world);
      announce(
        kind === "team"
          ? "The meeting starts. Everyone takes a seat."
          : "The sponsor is on the line."
      );
    },
    [announce, refuse, setWorld, world]
  );

  const adjourn = useCallback(() => {
    const result = endMeeting(world);
    if (!result.ok) {
      refuse(result.reason);
      return;
    }
    setWorld(result.world);
    setConversation({ kind: "report", report: result.report });
    announce(`Meeting over. ${result.report.verdict}`);
  }, [announce, refuse, setWorld, world]);

  const meetingDecide = useCallback(
    (eventId: string, optionId: string) => {
      const result = decide(world, eventId, optionId, "meeting");
      if (!result.ok) {
        refuse(result.reason);
        return;
      }
      setWorld(result.world);
      announce(result.lines[0]?.text ?? "Decided.");
    },
    [announce, refuse, setWorld, world]
  );

  return {
    conversation,
    ringing,
    blocking: conversation !== null || ringing !== null,
    open,
    catchUp,
    close,
    choose,
    leaveEvent,
    verb,
    writeUp,
    deskOpen,
    phone,
    meet,
    adjourn,
    meetingDecide,
    openEvent,
  };
}

type TeamLayer = ReturnType<typeof useTeamLayer>;

/** The ringing phone: answer, let it ring, or send it to voicemail. */
const PhoneOverlay: React.FC<{
  team: TeamLayer;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}> = ({ team, returnFocusTo }) => {
  const answerRef = useRef<HTMLButtonElement>(null);
  const call = team.ringing;
  if (!call) return null;
  return (
    <Overlay
      titleId="sd-phone-title"
      title="The phone is ringing"
      subtitle={`${call.from}, about "${call.subject}". Calls take ten minutes.`}
      testId="world-phone"
      role="alertdialog"
      device="phone"
      onClose={() => team.phone("ignore")}
      initialFocusRef={answerRef}
      returnFocusTo={returnFocusTo}
    >
      <div className="flex flex-wrap gap-2">
        <OverlayButton
          ref={answerRef}
          primary
          onClick={() => team.phone("answer")}
        >
          Answer
        </OverlayButton>
        <OverlayButton onClick={() => team.phone("voicemail")}>
          Send to voicemail
        </OverlayButton>
        <OverlayButton onClick={() => team.phone("ignore")}>
          Let it ring
        </OverlayButton>
      </div>
    </Overlay>
  );
};

const ChoiceList: React.FC<{
  choices: Array<{ id: string; label: string }>;
  onChoose: (id: string) => void;
  firstRef?: React.RefObject<HTMLButtonElement | null>;
}> = ({ choices, onChoose, firstRef }) => (
  <ol className="space-y-1">
    {choices.map((c, i) => (
      <li key={c.id}>
        <OverlayButton
          ref={i === 0 ? firstRef : undefined}
          className="w-full"
          onClick={() => onChoose(c.id)}
        >
          <span className="mr-2 text-[var(--sd-amber)]">{i + 1}</span>
          {c.label}
        </OverlayButton>
      </li>
    ))}
  </ol>
);

const numberKey = (
  e: React.KeyboardEvent,
  count: number,
  run: (index: number) => void
) => {
  const n = Number(e.key);
  if (Number.isInteger(n) && n >= 1 && n <= count) {
    e.preventDefault();
    run(n - 1);
  }
};

/** Whatever the team layer has open: a conversation, the desk, the EDC or a report. */
export const TeamOverlay: React.FC<{
  team: TeamLayer;
  world: WorldState;
  returnFocusTo: React.RefObject<HTMLElement | null>;
  reducedMotion: boolean;
}> = ({ team, world, returnFocusTo, reducedMotion }) => {
  const firstRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  if (team.ringing)
    return <PhoneOverlay team={team} returnFocusTo={returnFocusTo} />;
  const c = team.conversation;
  if (!c) return null;

  if (c.kind === "person") {
    const card = relationshipCard(world, c.memberId);
    const member = world.study.team.find((m) => m.id === c.memberId);
    const waiting = messagesFrom(world, c.memberId);
    return (
      <DialogueBox
        key="person"
        titleId="sd-talk-title"
        speaker={speakerFor(world, member?.name ?? "Conversation")}
        subtitle={`${formatClock(world.minute)} · talking takes ten minutes`}
        lines={c.lines}
        reducedMotion={reducedMotion}
        testId="world-dialogue"
        onClose={team.close}
        initialFocusRef={closeRef}
        returnFocusTo={returnFocusTo}
      >
        {waiting.map((e) => (
          <OverlayButton
            key={e.id}
            primary
            className="w-full"
            onClick={() => team.openEvent(world, e.id, "talk")}
          >
            {member?.name} has something for you: {e.subject}
          </OverlayButton>
        ))}
        {card ? <RelationshipCardView card={card} /> : null}
        <div>
          <h4 className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
            Delegate
          </h4>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {DELEGATION_VERBS.map((v) => (
              <OverlayButton key={v} onClick={() => team.verb(c.memberId, v)}>
                {VERB_LABEL[v]}
              </OverlayButton>
            ))}
          </div>
        </div>
        <OverlayButton ref={closeRef} onClick={team.close}>
          Leave
        </OverlayButton>
      </DialogueBox>
    );
  }

  if (c.kind === "event") {
    const { dialogue, after } = c;
    const subtitle = after
      ? "Decided."
      : "Choose an answer: 1 to " + dialogue.choices.length;
    const title = `${dialogue.speaker}: ${dialogue.subject}`;
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) =>
      after
        ? undefined
        : numberKey(e, dialogue.choices.length, (i) =>
            team.choose(dialogue.choices[i].id)
          );
    const actions = after ? (
      <div className="flex flex-wrap gap-2">
        {c.atDesk ? (
          <OverlayButton primary onClick={() => team.writeUp(dialogue.eventId)}>
            Write it up now · 20 min
          </OverlayButton>
        ) : null}
        <OverlayButton ref={closeRef} onClick={team.leaveEvent}>
          {c.atDesk ? "Leave it for later" : "Done"}
        </OverlayButton>
      </div>
    ) : (
      <>
        <ChoiceList
          choices={dialogue.choices}
          onChoose={team.choose}
          firstRef={firstRef}
        />
        <OverlayButton ref={closeRef} onClick={team.leaveEvent}>
          {dialogue.via === "hallway" ? "Not now" : "Decide later"}
        </OverlayButton>
      </>
    );
    // Face to face, the conversation is a dialogue box; on the phone, the
    // desk or in a meeting it is shown on that device.
    if (deviceForEvent(dialogue.via) === undefined)
      return (
        <DialogueBox
          key="event"
          titleId="sd-event-title"
          title={title}
          speaker={speakerFor(world, dialogue.speaker)}
          subtitle={`${dialogue.subject}. ${subtitle}`}
          lines={after ? [...dialogue.lines, ...after] : dialogue.lines}
          reducedMotion={reducedMotion}
          testId="world-dialogue"
          onClose={team.leaveEvent}
          onKeyDown={onKeyDown}
          initialFocusRef={after ? closeRef : firstRef}
          returnFocusTo={returnFocusTo}
        >
          {actions}
        </DialogueBox>
      );
    return (
      <Overlay
        key="event"
        titleId="sd-event-title"
        title={title}
        subtitle={subtitle}
        testId="world-dialogue"
        device={deviceForEvent(dialogue.via)}
        back={
          c.atDesk ? { label: "Back to desk", run: team.leaveEvent } : undefined
        }
        onClose={team.leaveEvent}
        onKeyDown={onKeyDown}
        initialFocusRef={after ? closeRef : firstRef}
        returnFocusTo={returnFocusTo}
      >
        <DialogueLines lines={dialogue.lines} />
        {after ? <DialogueLines lines={after} /> : null}
        {actions}
      </Overlay>
    );
  }

  if (c.kind === "desk") {
    const desk = deskView(world);
    const section = (
      title: string,
      items: Array<{ eventId: string; from: string; subject: string }>,
      action: string,
      via: "mail" | "voicemail" | "callback"
    ) =>
      items.length === 0 ? null : (
        <section>
          <h4 className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
            {title}
          </h4>
          <ul className="mt-1 space-y-1">
            {items.map((m) => (
              <li key={m.eventId}>
                <OverlayButton
                  className="w-full"
                  onClick={() => team.deskOpen(m.eventId, via)}
                >
                  {action}: {m.from}, {m.subject}
                </OverlayButton>
              </li>
            ))}
          </ul>
        </section>
      );
    return (
      <Overlay
        key="desk"
        titleId="sd-desk-title"
        title="Your desk"
        subtitle={`${formatClock(world.minute)} · reading takes ten minutes, writing up twenty`}
        testId="world-desk"
        device="monitor"
        onClose={team.close}
        initialFocusRef={closeRef}
        returnFocusTo={returnFocusTo}
      >
        {c.lines.length > 0 ? <DialogueLines lines={c.lines} /> : null}
        {section("Voicemail", desk.voicemail, "Listen", "voicemail")}
        {section("Calls to return", desk.callbacks, "Call", "callback")}
        {section("Mail", desk.mail, "Read", "mail")}
        <section>
          <h4 className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
            To write up
          </h4>
          {desk.undocumented.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-300">
              Everything you decided is on file.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {desk.undocumented.map((u) => (
                <li key={`${u.eventId}-${u.day}`}>
                  <OverlayButton
                    className="w-full"
                    onClick={() => team.writeUp(u.eventId)}
                  >
                    Write up: {u.label} (day {u.day}) · 20 min
                  </OverlayButton>
                </li>
              ))}
            </ul>
          )}
        </section>
        <OverlayButton ref={closeRef} onClick={team.close}>
          Leave the desk
        </OverlayButton>
      </Overlay>
    );
  }

  if (c.kind === "edc") {
    const rows = edcScreen(world);
    return (
      <Overlay
        key="edc"
        titleId="sd-edc-title"
        title="EDC workstation"
        subtitle="What the sites report, beside what you have seen and been told."
        testId="world-edc"
        device="monitor"
        onClose={team.close}
        initialFocusRef={closeRef}
        returnFocusTo={returnFocusTo}
      >
        <table className="w-full table-fixed border-collapse text-left text-[11px]">
          <thead>
            <tr className="text-[var(--sd-muted)]">
              <th scope="col" className="w-1/4 py-1 pr-2 font-semibold">
                Area
              </th>
              <th scope="col" className="w-1/3 py-1 pr-2 font-semibold">
                Dashboard says
              </th>
              <th scope="col" className="py-1 font-semibold">
                You have seen
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.area}
                className="border-t border-[var(--sd-hairline)] align-top"
              >
                <th
                  scope="row"
                  className="py-1 pr-2 font-semibold text-zinc-200"
                >
                  {r.label}{" "}
                  <span
                    className={
                      r.health === "red"
                        ? "text-[var(--sd-red)]"
                        : r.health === "amber"
                          ? "text-amber-300"
                          : "text-emerald-300"
                    }
                  >
                    ({r.health})
                  </span>
                </th>
                <td className="py-1 pr-2 break-words text-zinc-300">
                  {r.reported}
                </td>
                <td className="py-1 break-words text-zinc-300">
                  {r.seen.length === 0 ? (
                    <span className="text-[var(--sd-muted)]">Nothing yet</span>
                  ) : (
                    r.seen.map((o) => (
                      <span key={o.id} className="block">
                        Day {o.day}, {o.source}: {o.text}
                      </span>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <OverlayButton ref={closeRef} onClick={team.close}>
          Close
        </OverlayButton>
      </Overlay>
    );
  }

  const { report } = c;
  return (
    <Overlay
      key="report"
      titleId="sd-meeting-report"
      title={report.kind === "team" ? "Meeting over" : "Sponsor call over"}
      subtitle={`${report.minutes} minutes, ${report.personMinutes} person-minutes${report.attendees.length > 0 ? ` with ${report.attendees.join(", ")}` : ""}.`}
      testId="world-meeting-report"
      device="monitor"
      onClose={team.close}
      initialFocusRef={closeRef}
      returnFocusTo={returnFocusTo}
    >
      <p className="text-xs font-bold text-amber-300">{report.verdict}</p>
      {report.changes.length === 0 ? (
        <p className="text-xs text-zinc-300">Nothing changed.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-200">
          {report.changes.map((ch, i) => (
            <li key={i} className="break-words">
              {ch}
            </li>
          ))}
        </ul>
      )}
      {report.raised.map((id) => (
        <OverlayButton
          key={id}
          primary
          className="w-full"
          onClick={() => team.openEvent(world, id, "meeting")}
        >
          Answer now: {eventDialogue(world, id, "meeting")?.subject ?? id}
        </OverlayButton>
      ))}
      <OverlayButton ref={closeRef} onClick={team.close}>
        Close
      </OverlayButton>
    </Overlay>
  );
};

/** The conference room's controls: call a meeting, or run the one in progress. */
export const MeetingSection: React.FC<{
  team: TeamLayer;
  world: WorldState;
  people: readonly PersonPlacement[];
}> = ({ team, world, people }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const meeting = world.meeting;
  const agenda = sponsorAgenda(world);
  if (meeting) {
    const names = meeting.attendees
      .map((id) => world.study.team.find((m) => m.id === id)?.name ?? id)
      .join(", ");
    return (
      <section
        aria-labelledby="sd-meeting"
        data-testid="world-meeting"
        className="border border-[var(--sd-amber)]/50 bg-[var(--sd-surface)] p-3"
      >
        <h3 id="sd-meeting" className="text-sm font-bold">
          {meeting.kind === "team" ? "Team meeting" : "Sponsor call"} in
          progress
        </h3>
        <p className="mt-1 text-xs text-zinc-300">
          {names ? `At the table: ${names}.` : "Just you and the speakerphone."}{" "}
          Ends after 45 minutes.
        </p>
        {meeting.kind === "sponsor"
          ? agenda.map((e) => (
              <div key={e.id} className="mt-2">
                <p className="text-xs font-semibold text-zinc-100">
                  {e.subject}
                </p>
                <p className="text-[11px] text-zinc-300">{e.body}</p>
                <div className="mt-1 grid gap-1">
                  {e.options.map((o) => (
                    <OverlayButton
                      key={o.id}
                      onClick={() => team.meetingDecide(e.id, o.id)}
                    >
                      {o.label}
                    </OverlayButton>
                  ))}
                </div>
              </div>
            ))
          : null}
        <OverlayButton primary className="mt-3" onClick={team.adjourn}>
          End the meeting
        </OverlayButton>
      </section>
    );
  }
  const present = people.filter((p) =>
    world.study.team.some((m) => m.id === p.memberId)
  );
  const toggle = (id: string) =>
    setPicked((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  const chosen = picked.filter((id) => present.some((p) => p.memberId === id));
  return (
    <section
      aria-labelledby="sd-meeting"
      data-testid="world-meeting"
      className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
    >
      <h3 id="sd-meeting" className="text-sm font-bold">
        Conference room
      </h3>
      <fieldset className="mt-2">
        <legend className="text-[11px] text-[var(--sd-muted)]">
          Who to invite
        </legend>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {present.map((p) => (
            <label
              key={p.memberId}
              className="flex min-h-[28px] items-center gap-2 text-xs text-zinc-200"
            >
              <input
                type="checkbox"
                checked={chosen.includes(p.memberId)}
                onChange={() => toggle(p.memberId)}
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-2 flex flex-wrap gap-2">
        <OverlayButton
          disabled={chosen.length === 0}
          onClick={() => team.meet("team", chosen)}
        >
          Team meeting · 45 min
        </OverlayButton>
        <OverlayButton onClick={() => team.meet("sponsor", chosen)}>
          Sponsor call · 45 min
          {agenda.length > 0 ? ` (${agenda.length} on the agenda)` : ""}
        </OverlayButton>
      </div>
    </section>
  );
};
