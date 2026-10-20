/**
 * Finisher Medals, Aid Station checkpoints and secret exits for Monkey C
 * Mayhem (#2025).
 *
 * Every stage hides three Finisher Medals: one may sit in a PR Board (a
 * brick that must be broken), one in the bonus room behind an enterable
 * Water Station, and the rest high above a ledge, a block row or the lane,
 * each within a jump of the footing under it. An Aid Station checkpoint
 * stands at the stage's halfway point; a life lost after touching it
 * restarts the stage there. Some stages hide a second, secret finish pole
 * at the end of a bonus room. The engine in `lib/garmin/engine.ts` applies
 * these rules; this module holds the pure placement.
 */
import {
  BLOCK_SIZE,
  MEDAL_SIZE,
  courseRandom,
  stagePoleX,
  stageStartX,
  STAGE_COUNT,
  type CourseCheckpoint,
  type CourseLayout,
  type CourseMedal,
} from "./course";
import { propFootings, type CourseProps } from "./props";
import { SECOND_WIND_KINDS } from "./second-wind";
import { SWIM_SURFACE_Y } from "./swim";
import { isWaterTheme, type StageTheme } from "./themes";

export { MEDAL_SIZE };

/** Finisher Medals hidden on every stage. */
export const MEDALS_PER_STAGE = 3;
/** Points for finding a Finisher Medal. */
export const MEDAL_SCORE = 500;
/** Toast the first time a run touches an Aid Station. */
export const CHECKPOINT_TOAST = "Aid station!";
/** Banner on touching an Aid Station checkpoint. */
export const CHECKPOINT_BANNER = "AID STATION · CHECKPOINT";
/** Banner on grabbing a secret exit's pole. */
export const SECRET_EXIT_BANNER = "SECRET EXIT · SHORTCUT FOUND";
/** How far a medal floats above a ledge or block-row top it is reached from, in px (to its top). */
export const MEDAL_RISE = 56;
/** How far a lane medal floats above the lane, in px (to its top). */
export const MEDAL_LANE_RISE = 80;
/** A room medal's offset from the room's start x, and its top above the lane. */
export const ROOM_MEDAL_DX = 450;
export const ROOM_MEDAL_RISE = 80;
/** A secret pole stands this far before the room's far wall, in px. */
export const SECRET_POLE_INSET = 80;

/** The medal id for `slot` (1 to 3) of `stage`: stage × 10 + slot. */
export function medalId(stage: number, slot: number): number {
  return stage * 10 + slot;
}

/** The stage a medal id belongs to. */
export function medalStage(id: number): number {
  return Math.floor(id / 10);
}

/** How many of `stage`'s medals are among the `found` ids. */
export function stageMedalCount(
  found: readonly number[] | undefined,
  stage: number
): number {
  return (found ?? []).filter((id) => medalStage(id) === stage).length;
}

/** Which of `stage`'s three medal slots are found, in slot order. */
export function stageMedalSlots(
  found: readonly number[] | undefined,
  stage: number
): boolean[] {
  const ids = new Set(found ?? []);
  return Array.from({ length: MEDALS_PER_STAGE }, (_, i) =>
    ids.has(medalId(stage, i + 1))
  );
}

/** Whether a medal's box overlaps the box `left`..`right`, `top`..`bottom`. */
export function medalHit(
  medal: Pick<CourseMedal, "x" | "y">,
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  return (
    right > medal.x &&
    left < medal.x + MEDAL_SIZE &&
    bottom > medal.y &&
    top < medal.y + MEDAL_SIZE
  );
}

/**
 * The checkpoint for a stage starting at `start` with its pole at `pole`:
 * the first x from the halfway point on where a runner `bodyWidth` wide
 * stands on clear lane, 30 px past any gap and 120 px short of the next, 8 px
 * from any prop or rack,
 * outside every stretch a bonus room skips.
 * Null if none fits before the last quarter.
 */
function placeCheckpoint(
  course: CourseLayout,
  props: CourseProps,
  stage: number,
  groundY: number,
  bodyWidth: number
): CourseCheckpoint | null {
  const start = stageStartX(stage) + 450;
  const pole = stagePoleX(stage);
  const footings = propFootings(props, 0, groundY);
  const clear = (x: number) =>
    // A gap ahead gets a full run-up, so a restart is never a forced jump.
    !course.gaps.some(
      (g) => x + bodyWidth + 120 > g.x && x - 30 < g.x + g.width
    ) &&
    !footings.some((f) => x + bodyWidth + 8 > f.left && x - 8 < f.right) &&
    !(course.ceilings ?? []).some(
      (c) => x + bodyWidth + 8 > c.x && x - 8 < c.x + c.width
    ) &&
    // Not in a stretch a bonus room skips, or coming out past it would miss it.
    !props.stations.some(
      (st) => st.enterable && x + bodyWidth + 8 > st.x && x < st.exitX + 40
    );
  const last = pole - (pole - start) / 4;
  for (let x = Math.round((start + pole) / 2); x < last; x += 4) {
    if (clear(x)) return { x, stage };
  }
  return null;
}

/**
 * Places the medals, the checkpoint and the secret exit of #2025 on a laid
 * out stage, from their own random stream so the stage's other draws are
 * untouched. Returns new course and props; the inputs are not mutated.
 *
 * Slot order: a PR Board medal (land stages with a board after a Protein
 * Shake block), a bonus room medal (stages with an enterable station), then
 * free medals over a ledge, a block row or the lane, at least 60 px apart,
 * clear of racks and props and of the stretch the room skips. On stages 1 to
 * `STAGE_COUNT - 1`, most with an enterable station past the Aid Station end
 * the last such station's bonus room at a secret pole; then every course
 * medal sits before that station.
 */
export function placeStageExtras(
  course: CourseLayout,
  props: CourseProps,
  stage: number,
  seed: number,
  groundY: number,
  theme: StageTheme,
  bodyWidth: number
): { course: CourseLayout; props: CourseProps } {
  const rand = courseRandom(seed * 71 + stage * 160033 + 41);
  const footings = propFootings(props, 0, groundY);
  const start = stageStartX(stage) + 450;
  const end = stagePoleX(stage) - 360;
  const roomIdx = props.stations.findIndex((st) => st.enterable);
  const room = roomIdx === -1 ? null : props.stations[roomIdx];
  const checkpoint = placeCheckpoint(course, props, stage, groundY, bodyWidth);
  // A secret exit hides behind the last enterable station past the Aid
  // Station, so the shortcut skips less than half a stage.
  const secretIdx =
    stage < STAGE_COUNT && checkpoint
      ? props.stations.findLastIndex(
          (st) => st.enterable && st.x > checkpoint.x
        )
      : -1;
  const secretSt = secretIdx === -1 ? null : props.stations[secretIdx];
  const wantSecret = secretSt !== null && rand() < 0.75;
  const skipped = (x: number, st: CourseProps["stations"][number] | null) =>
    st !== null && x + MEDAL_SIZE > st.x - 8 && x < st.exitX + 8;

  // Lays the medals out; with a secret exit every course medal sits before
  // the station, since its room never leads back to the rest of the stage.
  const attempt = (secret: boolean) => {
    const blocks = course.blocks.slice();
    const medals: CourseMedal[] = [];
    let slot = 1;
    const taken: number[] = [];
    const freeX = (x: number) =>
      x >= start &&
      x + MEDAL_SIZE <= end &&
      !(course.ceilings ?? []).some(
        (c) => x + MEDAL_SIZE + 8 > c.x && x - 8 < c.x + c.width
      ) &&
      !footings.some((f) => x + MEDAL_SIZE + 4 > f.left && x - 4 < f.right) &&
      // Nothing in the stretch the room skips, so taking the room medal
      // never costs a course medal; nothing past a secret exit's station.
      !skipped(x, room) &&
      !(secret && secretSt && x + MEDAL_SIZE > secretSt.x - 8) &&
      !taken.some((t) => Math.abs(t - x) < 60);

    // A PR Board medal, on land: a plain brick with a Protein Shake block
    // before it, so even a Dev Mode runner (no Burpee Slam) can break it.
    if (!isWaterTheme(theme)) {
      const boards = blocks
        .map((b, i) => ({ b, i }))
        .filter(
          ({ b }) =>
            b.kind === "brick" &&
            !b.fromKudos &&
            b.contents === "kudos" &&
            blocks.some(
              (p) => p.kind === "sync" && p.contents === "power" && p.x < b.x
            ) &&
            freeX(b.x)
        );
      if (boards.length > 0) {
        const { b, i } = boards[Math.floor(rand() * boards.length)];
        blocks[i] = {
          ...b,
          contents: "medal",
          medalId: medalId(stage, slot++),
        };
        taken.push(b.x);
      }
    }

    // The bonus room medal behind the first enterable station.
    const roomMedal = room ? medalId(stage, slot++) : undefined;

    // A Second Wind on about half the land stages: a Sync Block that held
    // Kudos starts a stage event whose goal pays out a medal (#2026).
    if (!isWaterTheme(theme) && rand() < 0.5) {
      const plain = blocks
        .map((b, i) => ({ b, i }))
        .filter(
          ({ b }) => b.kind === "sync" && b.contents === "kudos" && freeX(b.x)
        );
      if (plain.length > 0) {
        const { b, i } = plain[Math.floor(rand() * plain.length)];
        blocks[i] = {
          ...b,
          contents: "wind",
          medalId: medalId(stage, slot++),
          windKind:
            SECOND_WIND_KINDS[Math.floor(rand() * SECOND_WIND_KINDS.length)],
        };
        taken.push(b.x);
      }
    }

    // Free medals: over a ledge first, then a block row, in shuffled order.
    // Under water nothing floats above the surface.
    const shuffle = <T>(items: T[]): T[] => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };
    const centred = (x: number, width: number) =>
      Math.round(x + (width - MEDAL_SIZE) / 2);
    const spots = [
      ...shuffle(
        course.ledges.map((l) => ({
          x: centred(l.x, l.width),
          y: l.y - MEDAL_RISE,
        }))
      ),
      ...shuffle(
        blocks
          .filter((b) => b.kind === "sync")
          .map((b) => ({ x: centred(b.x, BLOCK_SIZE), y: b.y - MEDAL_RISE }))
      ),
    ].filter((sp) => !isWaterTheme(theme) || sp.y >= SWIM_SURFACE_Y);
    for (const sp of spots) {
      if (slot > MEDALS_PER_STAGE) break;
      if (!freeX(sp.x)) continue;
      medals.push({ id: medalId(stage, slot++), stage, ...sp });
      taken.push(sp.x);
    }
    // Lane medals: over clear lane, a jump up from it.
    for (let tries = 0; tries < 60 && slot <= MEDALS_PER_STAGE; tries++) {
      const x = Math.round(
        start + rand() * Math.max(0, end - start - MEDAL_SIZE)
      );
      const overGap = course.gaps.some(
        (g) => x + MEDAL_SIZE + 20 > g.x && x - 20 < g.x + g.width
      );
      const underBlock = blocks.some(
        (b) => x + MEDAL_SIZE + 8 > b.x && x - 8 < b.x + BLOCK_SIZE
      );
      if (overGap || underBlock || !freeX(x)) continue;
      medals.push({
        id: medalId(stage, slot++),
        stage,
        x,
        y: groundY - MEDAL_LANE_RISE,
      });
      taken.push(x);
    }
    return { blocks, medals, roomMedal, placed: slot - 1 };
  };

  // A secret exit that would crowd the medals out is dropped.
  let secretExit = wantSecret;
  let laid = attempt(secretExit);
  if (secretExit && laid.placed < MEDALS_PER_STAGE) {
    secretExit = false;
    laid = attempt(false);
  }
  const { blocks, medals, roomMedal } = laid;
  const stations = props.stations.map((st, i) => {
    const next = i === roomIdx ? { ...st, medalId: roomMedal } : st;
    return secretExit && i === secretIdx ? { ...next, secretExit: true } : next;
  });

  return {
    course: {
      ...course,
      blocks,
      medals: [...(course.medals ?? []), ...medals],
      checkpoints: [
        ...(course.checkpoints ?? []),
        ...(checkpoint ? [checkpoint] : []),
      ],
    },
    props: { ...props, stations },
  };
}

/**
 * The course and props with every medal in `found` taken out, so a stage
 * laid out again after a lost life never offers a medal twice: free medals
 * go, a PR Board keeps its board but loses the medal, and a station's bonus
 * room loses its medal.
 */
export function hideFoundMedals(
  course: CourseLayout,
  props: CourseProps,
  found: readonly number[] | undefined
): { course: CourseLayout; props: CourseProps } {
  if (!found || found.length === 0) return { course, props };
  const ids = new Set(found);
  const blocks = course.blocks.map((b) => {
    if (b.medalId === undefined || !ids.has(b.medalId)) return b;
    const plain = { ...b, contents: "kudos" as const };
    delete plain.medalId;
    delete plain.windKind;
    return plain;
  });
  const stations = props.stations.map((st) => {
    if (st.medalId === undefined || !ids.has(st.medalId)) return st;
    const plain = { ...st };
    delete plain.medalId;
    return plain;
  });
  const next: CourseLayout = { ...course, blocks };
  if (course.medals) next.medals = course.medals.filter((m) => !ids.has(m.id));
  return { course: next, props: { ...props, stations } };
}
