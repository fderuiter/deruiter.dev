export type {
  CreditPackage,
  CreditScope,
  CreditsDataset,
  DirectAnnotation,
  FactsDrift,
  FactsStore,
  LicenseTextKind,
  LicenseTextRef,
  LockedPackage,
  LockfileEntry,
  LockfileShape,
  NoticeSource,
  PackageFacts,
  RootPackageShape,
} from "./types";
export {
  buildCreditsDataset,
  countByLicense,
  findUnannotatedDirect,
  groupDirectRuntimeByPurpose,
} from "./internal/build";
export {
  diffFactsAgainstLockfile,
  fillSpdxTemplate,
  isFactsDriftFree,
  listLockedPackages,
  noticeSourcesFromFacts,
  spdxIdsOf,
  templateNeedsHolder,
} from "./internal/facts";
export {
  listNoticedPackages,
  MIN_LICENSE_BODY_CHARS,
  renderThirdPartyNotices,
} from "./internal/notices";
export { normalizeProjectUrl, npmPackageUrl } from "./internal/urls";
