export {
  TOUCH_DEVICE_QUERY,
  PHONE_QUERY,
  PHONE_WIDTH_QUERY,
  useTouchDevice,
  usePhone,
} from "./immersive";
export { useInputModality, type InputModality } from "./input-modality";
export { TouchControlsGate } from "./TouchControlsGate";
export { InputModalityAttribute } from "./InputModalityAttribute";
export type { TouchControlsGateProps } from "./TouchControlsGate";
export {
  useOrientationMismatch,
  lockScreenOrientation,
  type MobileOrientation,
  type LockedOrientation,
} from "./orientation";
export {
  controlHint,
  resolveControlHint,
  useTouchHint,
  useControlHint,
  type ControlHint,
} from "./touch-hint";
export { RotateDevicePrompt } from "./RotateDevicePrompt";
export type { RotateDevicePromptProps } from "./RotateDevicePrompt";
export { TouchButton } from "./TouchButton";
export type { TouchButtonProps } from "./TouchButton";
export { DockFrame } from "./DockFrame";
export type { Handedness, DockFrameProps } from "./DockFrame";
export { useCabinetAutoPause } from "./useCabinetAutoPause";
export {
  createHoldRepeater,
  HOLD_REPEAT_DELAY_MS,
  HOLD_REPEAT_INTERVAL_MS,
  type HoldRepeater,
  type HoldRepeatOptions,
  type HoldRepeatTimers,
} from "./holdRepeat";
export { useHoldRepeat } from "./useHoldRepeat";
export { HoldDpad } from "./HoldDpad";
export type { HoldDpadProps } from "./HoldDpad";
export {
  swipeDirection,
  SWIPE_THRESHOLD_PX,
  type SwipeDirection,
} from "./swipe";
export { CabinetTouchContext, useCabinetTouch } from "./CabinetTouchContext";
