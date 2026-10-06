/**
 * Patty's Drive-Thru: the headless booth-shift engine (ADR 0059). The 3D
 * scene renders this state and forwards player input; every rule lives here.
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
} from "./internal/engine";
