/**
 * Touch-control presets on the action layer (#2359). Each takes action ids
 * from the game's `ActionMap`, so names, hints and the manual agree, and
 * sends through the nearest `ActionSinkProvider`.
 */
export { DpadDock } from "./DpadDock";
export type { DpadDockProps, DpadDirection } from "./DpadDock";
export { StickDock } from "./StickDock";
export type { StickDockProps } from "./StickDock";
export { DragPad } from "./DragPad";
export type { DragPadProps } from "./DragPad";
export { ActionCluster, ACTION_CLUSTER_MAX } from "./ActionCluster";
export type { ActionClusterProps } from "./ActionCluster";
export { ActionStrip } from "./ActionStrip";
export type { ActionStripProps } from "./ActionStrip";
export { HoldButton } from "./HoldButton";
export type { HoldButtonProps } from "./HoldButton";
export { ActionDock } from "./ActionDock";
export type { ActionDockProps } from "./ActionDock";
export {
  DOCK_KEY_PX,
  dockActionLabel,
  useDockHeight,
  type DockSize,
} from "./dock-kit";
export { axisVector } from "./axis-pointer";
