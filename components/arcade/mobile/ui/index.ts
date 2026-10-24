/**
 * Phone UI patterns (#2361): the sheet, HUD, coach marks and tap tips every
 * phone view shares, so games stop building their own.
 */
export { BottomSheet } from "./BottomSheet";
export type { BottomSheetProps, SheetSnap } from "./BottomSheet";
export { PhoneHud, PHONE_HUD_MAX_CHIPS } from "./PhoneHud";
export type { PhoneHudChip, PhoneHudProps } from "./PhoneHud";
export { CoachMarks, ShowTipsAgain, COACH_MARKS_MAX_STEPS } from "./CoachMarks";
export type {
  CoachMarkStep,
  CoachMarksProps,
  ShowTipsAgainProps,
} from "./CoachMarks";
export { TouchTip } from "./TouchTip";
export type { TouchTipProps } from "./TouchTip";
