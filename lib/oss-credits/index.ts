export type {
  CreditPackage,
  CreditScope,
  CreditsDataset,
  CreditsDrift,
  DirectAnnotation,
  LockfileEntry,
  LockfileShape,
  NoticeSource,
  PackageMeta,
  RootPackageShape,
} from "./types";
export {
  buildCreditsDataset,
  countByLicense,
  diffCreditsAgainstLockfile,
  findUnannotatedDirect,
  groupDirectRuntimeByPurpose,
  isDriftFree,
} from "./internal/build";
export { renderThirdPartyNotices } from "./internal/notices";
export { normalizeProjectUrl, npmPackageUrl } from "./internal/urls";
