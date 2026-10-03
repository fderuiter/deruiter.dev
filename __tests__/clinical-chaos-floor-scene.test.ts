import { describe, expect, it } from "vitest";
import {
  DESK_FRACTION,
  FLOOR_LOGICAL_HEIGHT,
  FLOOR_LOGICAL_WIDTH,
  FOLDER_FX_MS,
  getChuteIndexAt,
  getChuteSlots,
  getConveyorGeometry,
  getConveyorLogicalSize,
  getFolderFxPose,
  getFolderIndexAt,
  getFolderTabs,
  getOfficeFloorStyle,
  getSightCone,
  getSlotX,
  getVerdictStamp,
  isFolderInCone,
  type FolderFx,
} from "@/components/clinical-trial-chaos/floor-scene";
import {
  createInitialAuditorState,
  getStationsForPhase,
  OFFICES,
  type AuditorState,
  type ClinicalObservation,
} from "@/lib/clinical-trial-chaos";

const obs = (destination: ClinicalObservation["destination"]) =>
  ({
    id: `o-${destination}-${Math.random()}`,
    field: "f",
    rawValue: "x",
    currentValue: "x",
    destination,
    isResolved: true,
  }) as ClinicalObservation;

describe("Clinical Chaos floor scene geometry (#1521)", () => {
  it("uses a fixed desktop size, the 13:5 phone strip and a scaled tablet size", () => {
    expect(getConveyorLogicalSize(1440)).toEqual({
      width: FLOOR_LOGICAL_WIDTH,
      height: FLOOR_LOGICAL_HEIGHT,
    });
    expect(getConveyorLogicalSize(768)).toEqual({ width: 760, height: 260 });
    // A 1280-1440 cabinet gives the floor about 675px: still the fixed size.
    expect(getConveyorLogicalSize(675)).toEqual({ width: 760, height: 260 });
    expect(getConveyorLogicalSize(330)).toEqual({ width: 330, height: 127 });
    const tablet = getConveyorLogicalSize(600);
    expect(tablet.width).toBe(600);
    expect(tablet.height).toBe(Math.round((600 * 260) / 760));
  });

  it("keeps the phone strip's historical slot hit targets", () => {
    const g = getConveyorGeometry(330, 127);
    expect(g.compact).toBe(true);
    expect(getSlotX(g, 0)).toBe(28);
    // The UI test taps x=135, y=55 on a 330px strip and expects slot 1.
    expect(getFolderIndexAt(g, 135, 55, 3)).toBe(1);
    expect(getChuteIndexAt(g, 330, 4, 100, 120)).toBe(-1);
  });

  it("puts the desktop belt above the chutes and the floor below them", () => {
    const g = getConveyorGeometry(760, 260);
    expect(g.compact).toBe(false);
    expect(g.catwalkY).toBeLessThan(g.subjectTop);
    expect(g.subjectTop + g.subjectHeight).toBeLessThanOrEqual(g.beltY);
    expect(g.beltY).toBeLessThan(g.chuteTop);
    expect(g.chuteTop).toBeLessThan(g.floorY);
    expect(g.floorY).toBeLessThan(260);
    // Five folders fit between the desk and the inbound hatch.
    const last = getSlotX(g, g.visibleSlots - 1) + g.folderWidth;
    expect(getSlotX(g, 0)).toBeGreaterThan(g.beltLeft);
    expect(last).toBeLessThanOrEqual(g.beltRight);
  });

  it("finds folders and chutes under a point", () => {
    const g = getConveyorGeometry(760, 260);
    const midY = g.subjectTop + g.subjectHeight / 2;
    expect(getFolderIndexAt(g, getSlotX(g, 2) + 5, midY, 5)).toBe(2);
    expect(getFolderIndexAt(g, getSlotX(g, 2) + 5, midY, 2)).toBe(-1);
    expect(getFolderIndexAt(g, getSlotX(g, 0) + 5, g.chuteTop + 4, 5)).toBe(-1);
    const slots = getChuteSlots(760, 4, g.beltLeft);
    expect(getChuteIndexAt(g, 760, 4, slots[3].cx, g.chuteTop + 6)).toBe(3);
    expect(getChuteIndexAt(g, 760, 4, slots[3].cx, midY)).toBe(-1);
  });

  it("lines chutes up with a strip inset by the desk fraction", () => {
    const slots = getChuteSlots(760, 8, 760 * DESK_FRACTION);
    expect(slots).toHaveLength(8);
    expect(slots[0].x).toBeCloseTo(76);
    expect(slots[7].x + slots[7].w).toBeCloseTo(760);
    slots.forEach((slot) => {
      expect(slot.mouth).toBeLessThan(slot.w);
      expect(slot.cx).toBeCloseTo(slot.x + slot.w / 2);
    });
    expect(getChuteSlots(760, 0)).toEqual([]);
  });
});

describe("Clinical Chaos folder art mappings (#1521)", () => {
  const stations = getStationsForPhase(1, "campaign");

  it("gives each distinct domain one tab, in CRF order, in its station colour", () => {
    const tabs = getFolderTabs(
      { observations: [obs("VS"), obs("DM"), obs("VS"), obs("CM")] },
      stations
    );
    expect(tabs.map((t) => t.domain)).toEqual(["VS", "DM", "CM"]);
    expect(tabs[0].color).toBe(stations.find((s) => s.id === "VS")?.color);
    // CM has no open station in phase 1: a neutral steel tab.
    expect(tabs[2].color).toBe("#94a3b8");
    expect(
      getFolderTabs(
        { observations: [obs("DM"), obs("VS"), obs("AE"), obs("LB")] },
        stations
      )
    ).toHaveLength(3);
  });

  it("casts the sight-cone the way the auditor walks, and none on a break", () => {
    const g = getConveyorGeometry(760, 260);
    const base = {
      ...createInitialAuditorState(),
      x: 0.5,
    } as AuditorState;
    const right = getSightCone({ ...base, direction: 1 }, g, 760);
    const left = getSightCone({ ...base, direction: -1 }, g, 760);
    expect(right && left).toBeTruthy();
    expect(right!.farX).toBeGreaterThan(right!.apexX);
    expect(left!.farX).toBeLessThan(left!.apexX);
    expect(right!.baseY).toBe(g.beltY);
    expect(
      getSightCone({ ...base, behavior: "coffee_break" }, g, 760)
    ).toBeNull();
    expect(getSightCone(base, getConveyorGeometry(330, 127), 330)).toBeNull();

    const calm = getSightCone({ ...base, suspicion: 0 }, g, 760)!;
    const hot = getSightCone(
      { ...base, suspicion: 90, behavior: "issuing_483" },
      g,
      760
    )!;
    expect(hot.alpha).toBeGreaterThan(calm.alpha);
    expect(hot.color).toBe("#ef4444");

    expect(isFolderInCone(right, right!.apexX + 20, right!.apexX + 60)).toBe(
      true
    );
    expect(isFolderInCone(right, 0, 10)).toBe(false);
    expect(isFolderInCone(null, 0, 760)).toBe(false);
  });

  it("gives every office its own floor and wall, tinted by floorColor", () => {
    const styles = OFFICES.map((o) => getOfficeFloorStyle(o.id, o.floorColor));
    expect(new Set(styles.map((s) => s.floor)).size).toBe(OFFICES.length);
    expect(new Set(styles.map((s) => s.wall)).size).toBe(OFFICES.length);
    styles.forEach((style, i) =>
      expect(style.wallBase).toBe(OFFICES[i].floorColor)
    );
    expect(getOfficeFloorStyle("biotech-garage", "#000").floor).toBe("dock");
  });
});

describe("Clinical Chaos floor feedback (#1521, #1326)", () => {
  const g = getConveyorGeometry(760, 260);
  const fx = (kind: FolderFx["kind"], duration: number): FolderFx => ({
    kind,
    subjectId: "s",
    label: "SUBJ-1001",
    isSAE: false,
    clean: true,
    tabs: [],
    fromX: 200,
    toX: 600,
    startedAt: 1000,
    duration,
    stampUntil:
      kind === "bounce" ? 1000 + duration + FOLDER_FX_MS.stampHold : 1000,
  });

  it("drops a routed folder into its chute mouth and sinks it", () => {
    const drop = fx("drop", FOLDER_FX_MS.drop);
    const start = getFolderFxPose(drop, 1000, g, g.folderWidth);
    expect(start).toMatchObject({ x: 200, y: g.subjectTop, scale: 1 });
    const mid = getFolderFxPose(drop, 1000 + FOLDER_FX_MS.drop * 0.2, g, 100);
    // It lifts off the belt before it falls.
    expect(mid.y).toBeLessThan(g.subjectTop);
    const end = getFolderFxPose(drop, 1000 + FOLDER_FX_MS.drop, g, 100);
    expect(end.x).toBeCloseTo(600 - 50);
    expect(end.y).toBeCloseTo(g.chuteTop - 4);
    expect(end.scale).toBeLessThan(1);
    expect(end.alpha).toBe(0);
    expect(end.done).toBe(true);
    expect(end.stamp).toBe(false);
  });

  it("bounces a wrong route back to its slot with a stamp that outlasts the motion", () => {
    const bounce = fx("bounce", FOLDER_FX_MS.bounce);
    const early = getFolderFxPose(bounce, 1100, g, 100);
    expect(early.stamp).toBe(false);
    const back = getFolderFxPose(bounce, 1000 + FOLDER_FX_MS.bounce, g, 100);
    expect(back.x).toBeCloseTo(200);
    expect(back.y).toBeCloseTo(g.subjectTop);
    expect(back.stamp).toBe(true);
    expect(back.settled).toBe(true);
    expect(back.done).toBe(false);
    expect(getFolderFxPose(bounce, bounce.stampUntil, g, 100).done).toBe(true);
  });

  it("with reduced motion a bounce is only the stamp", () => {
    const calm = fx("bounce", 1);
    calm.stampUntil = 1000 + 1 + FOLDER_FX_MS.stampHold;
    const pose = getFolderFxPose(calm, 1001, g, 100);
    expect(pose).toMatchObject({ x: 200, settled: true, stamp: true });
  });

  it("slides an expired folder off the belt with a stamp", () => {
    const expire = fx("expire", FOLDER_FX_MS.expire);
    const end = getFolderFxPose(expire, 1000 + FOLDER_FX_MS.expire, g, 100);
    expect(end.x).toBeLessThan(200);
    expect(end.alpha).toBe(0);
    expect(end.stamp).toBe(true);
    expect(end.done).toBe(true);
  });

  it("slams the inspection verdict on a phase lock or shift end", () => {
    expect(getVerdictStamp("playing", null, "auditor")).toBeNull();
    expect(getVerdictStamp("idle", "NAI (x)", "auditor")).toBeNull();
    expect(
      getVerdictStamp(
        "phase_cleared",
        "NAI (No Action Indicated - Approved)",
        "auditor"
      )
    ).toMatchObject({ code: "NAI", tone: "good" });
    expect(
      getVerdictStamp(
        "phase_cleared",
        "VAI (Voluntary Action Indicated)",
        "auditor"
      )
    ).toMatchObject({ code: "VAI", tone: "warn" });
    expect(
      getVerdictStamp(
        "phase_cleared",
        "OAI (Official Action Indicated - Form 483 Issued)",
        "auditor"
      )
    ).toMatchObject({ code: "OAI", tone: "bad" });
    expect(getVerdictStamp("game_over", null, "auditor")).toMatchObject({
      code: "OAI",
    });
    expect(getVerdictStamp("game_over", "NAI", "sponsor")).toMatchObject({
      code: "VOID",
      tone: "bad",
    });
  });
});
