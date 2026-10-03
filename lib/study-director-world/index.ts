/**
 * Study Director world: the walkable workplace on top of the study model.
 *
 * The study in `@/lib/study-director` stays authoritative. This module adds
 * the clock, the player's energy and focus, the day's rhythm, the CRO floor
 * the player walks, and the translation of world actions into study
 * actions. Everything here is pure and deterministic (ADR 0055). Internals
 * under `internal/` are private.
 */
export * from "./types";
export {
  ACTION_COSTS,
  actionCost,
  drinkCoffee,
  fatigueFrom,
  formatClock,
  spend,
  weekdayFor,
} from "./internal/clock";
export { createWorld, goHome, newWorld, startDay } from "./internal/day";
export { WORLD_SAVE_KEY, parseWorld, serializeWorld } from "./internal/save";
export {
  CRO_FLOOR,
  WORLD_MAPS,
  getRoom,
  getStation,
  isWalkable,
  roomAt,
  stationAt,
  stepFrom,
  tileAt,
} from "./internal/floor";
export {
  WALK_MINUTES_PER_TILE,
  facingToward,
  followRoute,
  isBlocked,
  planRoute,
  step,
} from "./internal/movement";
export { TIDY_ROOM, placeTeam, roomConditions } from "./internal/people";
export {
  BIN_FIRE_BELOW,
  BIN_SMOKE_BELOW,
  PLAYER_MUG,
  binFor,
  countMarks,
  describeDressing,
  dressFloor,
  examineSelf,
  lowestMeter,
  moodFor,
  paperStacksFor,
  plantFor,
  redMarksFor,
  stickyNotesFor,
  teamHours,
  type DressingInput,
} from "./internal/dressing";
export {
  DEFAULT_INTERACTIONS,
  describeSurroundings,
  hudReadout,
  interact,
  officeDirectory,
  targetInFront,
} from "./internal/interact";
export { SITE_IDS, SITE_MAPS } from "./internal/site-maps";
export {
  PI_LEAVES,
  SITE_CHECKS,
  SITE_CLOSES,
  SITE_INTERACTIONS,
  carOutcome,
  checkAtStation,
  checkBlocker,
  closeVisit,
  coordinatorProfile,
  currentMap,
  performCheck,
  siteRefusalText,
  travel,
  travelMinutes,
  travelOptions,
} from "./internal/sites";
export {
  OPEN_TRUST,
  ROLE_LABEL,
  STREAM_FOR_ROLE,
  STREAM_LABEL,
  TRUST_EFFECTS,
  WARY_TRUST,
  adjustTrust,
  bondFor,
  daySchedule,
  describePerson,
  initialBond,
  observe,
  pendingFrom,
  personState,
  placePeople,
  positionAt,
  relationshipCard,
  senderOf,
  walkPath,
  workHours,
  withBond,
} from "./internal/team";
export {
  dialogueLines,
  talk,
  undocumentedDecisions,
} from "./internal/dialogue";
export {
  RETRY_MINUTES,
  answerCall,
  brushOff,
  channelFor,
  decide,
  deskView,
  documentAtDesk,
  edcScreen,
  eventDialogue,
  hallwayCatch,
  ignoreCall,
  markRaised,
  messagesFrom,
  openAtDesk,
  phoneCalls,
  ringingCall,
  sendToVoicemail,
} from "./internal/channels";
export {
  ASSIGNMENT_LOAD,
  OWNERSHIP_COACHING,
  OWNERSHIP_TRUST,
  assignmentsFor,
  delegate,
  nightlyCapacity,
  workTheNight,
} from "./internal/delegation";
export {
  MEETING_MINUTES,
  endMeeting,
  sponsorAgenda,
  startMeeting,
} from "./internal/meetings";
export { TEAM_INTERACTIONS } from "./internal/handlers";
