/**
 * Patty's Drive-Thru: the headless booth-shift engine (ADR 0059). The 3D
 * scene renders this state and forwards player input; every rule lives here,
 * along with the read-only views, the head's look physics and the diary copy
 * the front ends share.
 */

export type * from "./types";
export * from "./presets";
export {
  applyAction,
  computePayStub,
  createShift,
  getKdsBand,
  getOrderAge,
  getPosScreen,
  isAgeLocked,
  isOrderReady,
  isShiftOver,
  replayShift,
  stepShift,
  validatePosTree,
} from "./internal/engine";
export {
  downloadShiftTelemetryCsv,
  downloadShiftTelemetryJson,
  exportShiftTelemetryCsv,
  exportShiftTelemetryJson,
  generateShiftTelemetry,
} from "./internal/telemetry";
export {
  describeOrder,
  formatCents,
  formatClock,
  getKdsTicket,
  getKdsTickets,
  getPosBreadcrumb,
  getTimeLeft,
  scoreShift,
} from "./internal/view";
export {
  aimLook,
  createLook,
  getFacing,
  isLookSettled,
  stepLook,
} from "./internal/look";
export {
  BOOTH_CREW,
  CLOSING_NOTE,
  COMPANION_POST_PATH,
  DIARY_INTRO,
  EVENT_CAPTIONS,
  HEADSET_LINES,
  MANAGER_LINES,
  getHeadsetLine,
  getManagerLine,
  getShiftEnding,
} from "./internal/diary";
