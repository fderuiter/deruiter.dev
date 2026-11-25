import { vi } from "vitest";
import type { FeedbackNotificationPayload } from "@/lib/email-templates";
import type { ContactSubmission, ResendWebhookEvent } from "@/lib/schemas";
import * as S from "@/lib/services";

export * from "@/lib/services";

export type EmailRetryResult = S.ProcessRetryQueueResult;

export interface EmailDispatchResult {
  success: boolean;
  data?: { id: string };
  error?: string;
  simulated?: boolean;
  queued?: boolean;
  deferred?: boolean;
  retryable?: boolean;
  errorCode?: "RECIPIENT_ELIGIBILITY_UNKNOWN";
  queueId?: string;
}

export interface ContactDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  adminResult: EmailDispatchResult;
  confirmationResult?: EmailDispatchResult;
}

export interface NewsletterSubscribeResult {
  success: boolean;
  confirmationSent: boolean;
  simulated?: boolean;
  error?: string;
}

export interface LegacyFeedbackSubmitResponse {
  rateLimited: boolean;
  success: boolean;
  replayed?: boolean;
  message: string;
  feedback?: {
    id: string;
    caseStudySlug: string;
    takeaways: string[];
    comments: string;
    createdAt: Date | string;
  };
}

export interface LegacyBlogSubmitReactionResponse {
  success: boolean;
  notFound?: boolean;
  duplicate?: boolean;
  message?: string;
  reactionType: string;
  counts: Record<string, number>;
  userReactions: string[];
}

const reentrant = new Set<string>();

function unwrapOrThrow<T>(res: S.ServiceResult<T, string>): T {
  if (res.success) return res.data;
  if (res.error.details instanceof Error) {
    throw res.error.details;
  }
  const err = new Error(res.error.message || res.error.code);
  (err as Error & { code?: string }).code = res.error.code;
  throw err;
}

function isServiceEnvelope<T, E extends string>(
  value: unknown
): value is S.ServiceResult<T, E> {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.success !== "boolean") return false;
  if (rec.success === false) {
    return (
      typeof rec.error === "object" &&
      rec.error !== null &&
      "code" in (rec.error as Record<string, unknown>)
    );
  }
  return "data" in rec;
}

function toEmailDispatchResult(res: S.SendRawEmailResult): EmailDispatchResult {
  if (res.success) {
    return {
      success: true,
      data: { id: res.data.id },
      ...(res.data.simulated !== undefined
        ? { simulated: res.data.simulated }
        : {}),
      ...(res.data.queued !== undefined ? { queued: res.data.queued } : {}),
      ...(res.data.deferred !== undefined
        ? { deferred: res.data.deferred }
        : {}),
      ...(res.data.queueId !== undefined ? { queueId: res.data.queueId } : {}),
    };
  }
  if (res.error.code === "RECIPIENT_ELIGIBILITY_UNKNOWN") {
    return {
      success: false,
      error: res.error.message,
      errorCode: "RECIPIENT_ELIGIBILITY_UNKNOWN",
      retryable: true,
    };
  }
  const errDetails =
    res.error.details && typeof res.error.details === "object"
      ? (res.error.details as { queued?: boolean; queueId?: string })
      : undefined;
  return {
    success: false,
    error: res.error.message,
    ...(res.error.recoverable ? { retryable: true } : {}),
    ...(errDetails?.queued ? { queued: true } : {}),
    ...(errDetails?.queueId !== undefined
      ? { queueId: errDetails.queueId }
      : {}),
  };
}

function fromEmailDispatchResult(
  val: EmailDispatchResult | S.SendRawEmailResult
): S.SendRawEmailResult {
  if (!val.success) {
    if (isServiceEnvelope<S.SendRawEmailData, S.SendRawEmailErrorCode>(val)) {
      return val;
    }
    const legacy = val as EmailDispatchResult;
    const code: S.SendRawEmailErrorCode =
      legacy.errorCode === "RECIPIENT_ELIGIBILITY_UNKNOWN"
        ? "RECIPIENT_ELIGIBILITY_UNKNOWN"
        : "DELIVERY_FAILED";
    return S.createFailure(code, legacy.error ?? "Delivery failed", {
      recoverable: legacy.retryable ?? true,
    });
  }
  const dataObj = val.data as Partial<S.SendRawEmailData> | undefined;
  const legacy = val as EmailDispatchResult;
  return S.createSuccess({
    id: dataObj?.id ?? "mock_email_id",
    simulated: legacy.simulated ?? dataObj?.simulated,
    queued: legacy.queued ?? dataObj?.queued,
    deferred: legacy.deferred ?? dataObj?.deferred,
    queueId: legacy.queueId ?? dataObj?.queueId,
  });
}

type AsyncMethodFn = (...args: never[]) => Promise<unknown>;

interface SliceBindingOptions<
  TInput,
  TResult extends S.ServiceResult<unknown, string>,
  TLegacyArgs extends unknown[],
  TLegacyReturn,
> {
  key: string;
  HandlerCtor: {
    new (): { execute(input: TInput): Promise<TResult> };
    prototype: { execute(input: TInput): Promise<TResult> };
  };
  toSliceInput: (...args: TLegacyArgs) => TInput;
  fromSliceInput: (input: TInput) => readonly unknown[];
  fromSliceResult: (res: TResult) => TLegacyReturn | Promise<TLegacyReturn>;
  toSliceResult: (val: TLegacyReturn | TResult) => TResult;
  onRejectResult: (err: unknown) => TResult;
}

function bindAsyncSlice<
  TTarget extends object,
  TMethod extends {
    [K in keyof TTarget]: TTarget[K] extends AsyncMethodFn ? K : never;
  }[keyof TTarget],
  TInput,
  TResult extends S.ServiceResult<unknown, string>,
>(
  target: TTarget,
  methodName: TMethod,
  opts: SliceBindingOptions<
    TInput,
    TResult,
    Parameters<Extract<TTarget[TMethod], AsyncMethodFn>>,
    Awaited<ReturnType<Extract<TTarget[TMethod], AsyncMethodFn>>>
  >
): void {
  type TLegacyArgs = Parameters<Extract<TTarget[TMethod], AsyncMethodFn>>;
  type TLegacyReturn = Awaited<
    ReturnType<Extract<TTarget[TMethod], AsyncMethodFn>>
  >;
  const origExecute = opts.HandlerCtor.prototype.execute;

  Object.defineProperty(opts.HandlerCtor.prototype, "execute", {
    configurable: true,
    writable: true,
    value: async function (input: TInput): Promise<TResult> {
      const candidate: unknown = target[methodName];
      if (
        !reentrant.has(opts.key) &&
        typeof candidate === "function" &&
        vi.isMockFunction(candidate)
      ) {
        reentrant.add(opts.key);
        try {
          const legacyArgs = opts.fromSliceInput(input);
          const mockOut = (await Reflect.apply(
            candidate,
            target,
            legacyArgs
          )) as TLegacyReturn | TResult;
          return opts.toSliceResult(mockOut);
        } catch (err) {
          return opts.onRejectResult(err);
        } finally {
          reentrant.delete(opts.key);
        }
      }
      return origExecute.call(this, input);
    },
  });

  (target as Record<PropertyKey, unknown>)[methodName] = async (
    ...args: TLegacyArgs
  ): Promise<TLegacyReturn> => {
    reentrant.add(opts.key);
    try {
      const handler = new opts.HandlerCtor();
      const res = await origExecute.call(handler, opts.toSliceInput(...args));
      return await opts.fromSliceResult(res);
    } finally {
      reentrant.delete(opts.key);
    }
  };
}

export const PrivacyService = {
  extractHeaderValue: S.extractHeaderValue,
  extractClientIp: S.extractClientIp,
  generateClientConnectionHash: S.generateClientConnectionHash,
  generateClientConnectionHashSync: S.generateClientConnectionHashSync,
  getConnectionHashFromRequest: S.getConnectionHashFromRequest,
};

export const TelemetryService = {
  clearAggregateCache(): void {
    S._testCache.clearAggregateCache();
  },
  clearAggregateStatsCache(): void {
    S._testCache.clearAggregateStatsCache();
  },
  isRateLimited: async (
    _req: S.RequestOrHeaders
  ): Promise<{ limited: boolean; headers?: Record<string, string> }> => ({
    limited: false,
  }),
  recordEvent: async (
    _data: S.RecordTelemetryEventInput
  ): Promise<{ event: S.BufferedTelemetryEvent; buffered: boolean }> => {
    throw new Error("unbound");
  },
  getAggregateStats: async (): Promise<S.TelemetryAggregateStats> => ({}),
  computeAggregateStats: async (): Promise<S.TelemetryAggregateStats> => ({}),
  refreshAggregateStats: async (): Promise<S.TelemetryAggregateRefreshResult> =>
    S.createSuccess({ projects: 0 }),
  syncBufferedEvents: async (
    _batchSize: number
  ): Promise<S.TelemetrySyncResult> =>
    S.createSuccess({ processed: 0, inserted: 0 }),
  rollupAndPruneRawEvents: async (
    _before: Date
  ): Promise<S.TelemetryRetentionResult> =>
    S.createSuccess({ rollupsUpserted: 0, rawEventsDeleted: 0 }),
};

bindAsyncSlice(TelemetryService, "isRateLimited", {
  key: "tel.isRateLimited",
  HandlerCtor: S.CheckTelemetryRateLimitHandler,
  toSliceInput: (request) => ({ request }),
  fromSliceInput: (input) => [input.request],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(TelemetryService, "recordEvent", {
  key: "tel.recordEvent",
  HandlerCtor: S.RecordTelemetryEventHandler,
  toSliceInput: (data) => data,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(TelemetryService, "getAggregateStats", {
  key: "tel.getAggregateStats",
  HandlerCtor: S.GetTelemetryAggregateStatsHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("AGGREGATE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(TelemetryService, "computeAggregateStats", {
  key: "tel.computeAggregateStats",
  HandlerCtor: S.ComputeTelemetryAggregateStatsHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("AGGREGATE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(TelemetryService, "refreshAggregateStats", {
  key: "tel.refreshAggregateStats",
  HandlerCtor: S.RefreshTelemetryAggregateStatsHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("AGGREGATE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(TelemetryService, "syncBufferedEvents", {
  key: "tel.syncBufferedEvents",
  HandlerCtor: S.SyncBufferedTelemetryEventsHandler,
  toSliceInput: (batchSize) => ({ batchSize }),
  fromSliceInput: (input) => [input.batchSize],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("PERSISTENCE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(TelemetryService, "rollupAndPruneRawEvents", {
  key: "tel.rollupAndPruneRawEvents",
  HandlerCtor: S.RollupAndPruneTelemetryEventsHandler,
  toSliceInput: (before) => ({ before }),
  fromSliceInput: (input) => [input.before],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("RETENTION_FAILED", String(err), { details: err }),
});

export const ProjectImageService = {
  extractMediaKeyFromUrl: S.extractMediaKeyFromUrl,
  saveMediaAsset: async (
    _key: string,
    _buffer: Buffer,
    _contentType: string
  ): Promise<S.SaveMediaAssetResult> =>
    S.createFailure("INVALID_INPUT", "unbound"),
  getMediaAsset: async (_key: string): Promise<S.GetMediaAssetResult> =>
    S.createSuccess(null),
  deleteMediaAsset: async (_key: string): Promise<S.DeleteMediaAssetResult> =>
    S.createSuccess(null),
  uploadProjectImage: async (
    _slug: string,
    _fileBuffer: Buffer,
    _mimeType: string
  ): Promise<S.ProjectImageResult> =>
    S.createFailure("STORAGE_FAILED", "unbound"),
};

bindAsyncSlice(ProjectImageService, "saveMediaAsset", {
  key: "img.saveMediaAsset",
  HandlerCtor: S.SaveMediaAssetHandler,
  toSliceInput: (key, buffer, contentType) => ({ key, buffer, contentType }),
  fromSliceInput: (input) => [input.key, input.buffer, input.contentType],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(ProjectImageService, "getMediaAsset", {
  key: "img.getMediaAsset",
  HandlerCtor: S.GetMediaAssetHandler,
  toSliceInput: (key) => ({ key }),
  fromSliceInput: (input) => [input.key],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("READ_FAILED", String(err), { details: err }),
});

bindAsyncSlice(ProjectImageService, "deleteMediaAsset", {
  key: "img.deleteMediaAsset",
  HandlerCtor: S.DeleteMediaAssetHandler,
  toSliceInput: (key) => ({ key }),
  fromSliceInput: (input) => [input.key],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("DELETE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(ProjectImageService, "uploadProjectImage", {
  key: "img.uploadProjectImage",
  HandlerCtor: S.UploadProjectImageHandler,
  toSliceInput: (slug, fileBuffer, mimeType) => ({
    slug,
    fileBuffer,
    mimeType,
  }),
  fromSliceInput: (input) => [input.slug, input.fileBuffer, input.mimeType],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("STORAGE_FAILED", String(err), { details: err }),
});

const CaseStudyAsyncMethods = {
  getAllPublishedCaseStudies: async (): Promise<S.CaseStudyData[]> => [],
  getCaseStudyBySlug: async (_slug: string): Promise<S.CaseStudyData | null> =>
    null,
  evictCaseStudyCache: async (_slug: string): Promise<boolean> => false,
  getPublishedCaseStudies: async (): Promise<S.CaseStudySearchSummary[]> => [],
  submitCaseStudy: async (
    _input: S.CaseStudySubmissionInput
  ): Promise<S.CaseStudyDbRowLike> => {
    throw new Error("unbound");
  },
  updateCaseStudyImage: async (
    _slug: string,
    _heroImageUrl: string | null
  ): Promise<S.UpdateCaseStudyImageResult> =>
    S.createFailure("PERSISTENCE_FAILED", "unbound"),
  getFeedback: async (
    _slug: string,
    _connectionHash: string
  ): Promise<S.GetCaseStudyFeedbackData> => ({
    caseStudySlug: "",
    feedback: [],
    hasSubmitted: false,
    totalFeedback: 0,
  }),
  submitFeedback: async (
    _input: S.FeedbackSubmissionInput,
    _connectionHash: string,
    _operationKey?: string
  ): Promise<LegacyFeedbackSubmitResponse> => ({
    rateLimited: false,
    success: true,
    message: "",
  }),
  getReactions: async (
    _slug: string,
    _connectionHash: string
  ): Promise<{ success: true } & S.GetCaseStudyReactionsData> => ({
    success: true,
    caseStudySlug: "",
    counts: {},
    userReactions: [],
  }),
  submitReaction: async (
    _input: S.ReactionSubmissionInput,
    _connectionHash: string
  ): Promise<{ success: true } & S.SubmitCaseStudyReactionData> => ({
    success: true,
    reactionType: "",
    counts: {},
    userReactions: [],
  }),
  flushBufferedReactionsToDatabase: async (
    _batchSize?: number
  ): Promise<S.CaseStudyReactionFlushResult> =>
    S.createSuccess({ processed: 0, inserted: 0 }),
};

export const CaseStudyService = Object.assign(CaseStudyAsyncMethods, {
  getAllPublishedSlugs: async (): Promise<string[]> => {
    const studies = await CaseStudyService.getAllPublishedCaseStudies();
    return studies.map((s) => s.slug);
  },
});

bindAsyncSlice(CaseStudyAsyncMethods, "getAllPublishedCaseStudies", {
  key: "cs.getAllPublishedCaseStudies",
  HandlerCtor: S.GetAllPublishedCaseStudiesHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => (res.success ? res.data : []),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "getCaseStudyBySlug", {
  key: "cs.getCaseStudyBySlug",
  HandlerCtor: S.GetCaseStudyBySlugHandler,
  toSliceInput: (slug) => ({ slug, allowFallbackOnError: true }),
  fromSliceInput: (input) => [input.slug],
  fromSliceResult: (res) => (res.success ? res.data : null),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "evictCaseStudyCache", {
  key: "cs.evictCaseStudyCache",
  HandlerCtor: S.EvictCaseStudyCacheHandler,
  toSliceInput: (slug) => ({ slug }),
  fromSliceInput: (input) => [input.slug],
  fromSliceResult: (res) => (res.success ? res.data.evicted : false),
  toSliceResult: (val) =>
    isServiceEnvelope(val) ? val : S.createSuccess({ evicted: val }),
  onRejectResult: () => S.createSuccess({ evicted: false }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "getPublishedCaseStudies", {
  key: "cs.getPublishedCaseStudies",
  HandlerCtor: S.GetPublishedCaseStudiesHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => (res.success ? res.data : []),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "submitCaseStudy", {
  key: "cs.submitCaseStudy",
  HandlerCtor: S.SubmitCaseStudyHandler,
  toSliceInput: (input) => input,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "updateCaseStudyImage", {
  key: "cs.updateCaseStudyImage",
  HandlerCtor: S.UpdateCaseStudyImageHandler,
  toSliceInput: (slug, heroImageUrl) => ({ slug, heroImageUrl }),
  fromSliceInput: (input) => [input.slug, input.heroImageUrl],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("PERSISTENCE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "getFeedback", {
  key: "cs.getFeedback",
  HandlerCtor: S.GetCaseStudyFeedbackHandler,
  toSliceInput: (caseStudySlug, connectionHash) => ({
    caseStudySlug,
    connectionHash,
  }),
  fromSliceInput: (input) => [input.caseStudySlug, input.connectionHash],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "submitFeedback", {
  key: "cs.submitFeedback",
  HandlerCtor: S.SubmitCaseStudyFeedbackHandler,
  toSliceInput: (input, connectionHash, operationKey) => ({
    ...input,
    connectionHash,
    ...(operationKey !== undefined ? { operationKey } : {}),
  }),
  fromSliceInput: (input) => [
    {
      caseStudySlug: input.caseStudySlug,
      takeaways: input.takeaways,
      comments: input.comments,
    },
    input.connectionHash,
    input.operationKey,
  ],
  fromSliceResult: (res) => {
    if (res.success) {
      return {
        rateLimited: false,
        success: true,
        replayed: res.data.replayed,
        message: res.data.message,
        feedback: res.data.feedback,
      };
    }
    if (res.error.code === "RATE_LIMITED") {
      return {
        rateLimited: true,
        success: false,
        message: res.error.message,
      };
    }
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (
      isServiceEnvelope<
        S.SubmitCaseStudyFeedbackData,
        S.SubmitCaseStudyFeedbackErrorCode
      >(val) &&
      !("rateLimited" in val)
    ) {
      return val;
    }
    const legacy = val as LegacyFeedbackSubmitResponse;
    if (legacy.rateLimited) {
      return S.createFailure("RATE_LIMITED", legacy.message, {
        recoverable: true,
      });
    }
    return S.createSuccess({
      replayed: legacy.replayed ?? false,
      message: legacy.message,
      feedback: legacy.feedback ?? {
        id: "mock",
        caseStudySlug: "",
        takeaways: [],
        comments: "",
        createdAt: new Date(),
      },
    });
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "getReactions", {
  key: "cs.getReactions",
  HandlerCtor: S.GetCaseStudyReactionsHandler,
  toSliceInput: (slug, connectionHash) => ({ slug, connectionHash }),
  fromSliceInput: (input) => [input.slug, input.connectionHash],
  fromSliceResult: (res) => {
    const data = unwrapOrThrow(res);
    return { success: true as const, ...data };
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    return S.createSuccess({
      caseStudySlug: val.caseStudySlug,
      counts: val.counts,
      userReactions: val.userReactions,
    });
  },
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "submitReaction", {
  key: "cs.submitReaction",
  HandlerCtor: S.SubmitCaseStudyReactionHandler,
  toSliceInput: (input, connectionHash) => ({ ...input, connectionHash }),
  fromSliceInput: (input) => [
    { caseStudySlug: input.caseStudySlug, reactionType: input.reactionType },
    input.connectionHash,
  ],
  fromSliceResult: (res) => {
    const data = unwrapOrThrow(res);
    return { success: true as const, ...data };
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    return S.createSuccess({
      reactionType: val.reactionType,
      counts: val.counts,
      userReactions: val.userReactions,
    });
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(CaseStudyAsyncMethods, "flushBufferedReactionsToDatabase", {
  key: "cs.flushBufferedReactionsToDatabase",
  HandlerCtor: S.FlushCaseStudyReactionsHandler,
  toSliceInput: (batchSize = 500) => ({ batchSize }),
  fromSliceInput: (input) => [input?.batchSize ?? 500],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("FLUSH_FAILED", String(err), { details: err }),
});

export const BlogPostService = {
  getAllBlogPostsAdmin: async (): Promise<S.BlogPostDbRecord[]> => [],
  getDraftBlogPosts: async (
    _pagination: S.BlogDraftPagination
  ): Promise<S.GetDraftBlogPostsData> => ({
    drafts: [],
    total: 0,
  }),
  createDraftBlogPost: async (
    _input: S.CreateBlogDraftInput
  ): Promise<S.BlogPostDbRecord> => {
    throw new Error("unbound");
  },
  getBlogPostById: async (_id: string): Promise<S.BlogPostDbRecord | null> =>
    null,
  getDraftBlogPostById: async (
    _id: string
  ): Promise<S.BlogPostDbRecord | null> => null,
  updateDraftBlogPost: async (
    _id: string,
    _input: S.UpdateBlogDraftInput
  ): Promise<S.BlogPostDbRecord | null> => null,
  deleteBlogPost: async (_id: string): Promise<S.BlogPostDbRecord | null> =>
    null,
  getAllPublishedBlogPosts: async (): Promise<S.BlogPostData[]> => [],
  getBlogPostBySlug: async (_slug: string): Promise<S.BlogPostData | null> =>
    null,
  evictBlogPostCache: async (_slug: string): Promise<boolean> => false,
  getReactions: async (
    _slug: string,
    _connectionHash: string
  ): Promise<{ success: true } & S.GetBlogReactionsData> => ({
    success: true,
    blogPostSlug: "",
    counts: {},
    userReactions: [],
  }),
  submitReaction: async (
    _input: S.BlogPostReactionSubmissionInput,
    _connectionHash: string
  ): Promise<LegacyBlogSubmitReactionResponse> => ({
    success: true,
    reactionType: "",
    counts: {},
    userReactions: [],
  }),
  flushBufferedReactionsToDatabase: async (
    _batchSize?: number
  ): Promise<S.BlogReactionFlushResult> =>
    S.createSuccess({ processed: 0, inserted: 0 }),
  hydrateBlogReactionCounts: async (
    _slug: string
  ): Promise<Record<string, number>> => ({}),
};

bindAsyncSlice(BlogPostService, "getAllBlogPostsAdmin", {
  key: "blog.getAllBlogPostsAdmin",
  HandlerCtor: S.GetAllBlogPostsAdminHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "getDraftBlogPosts", {
  key: "blog.getDraftBlogPosts",
  HandlerCtor: S.GetDraftBlogPostsHandler,
  toSliceInput: (pagination) => pagination,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "createDraftBlogPost", {
  key: "blog.createDraftBlogPost",
  HandlerCtor: S.CreateDraftBlogPostHandler,
  toSliceInput: (input) => input,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "getBlogPostById", {
  key: "blog.getBlogPostById",
  HandlerCtor: S.GetBlogPostByIdHandler,
  toSliceInput: (id) => ({ id }),
  fromSliceInput: (input) => [input.id],
  fromSliceResult: (res) => {
    if (res.success) return res.data;
    if (res.error.code === "NOT_FOUND" || res.error.code === "INVALID_INPUT") {
      return null;
    }
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) return S.createFailure("NOT_FOUND", "Not found");
    return S.createSuccess(val);
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "getDraftBlogPostById", {
  key: "blog.getDraftBlogPostById",
  HandlerCtor: S.GetDraftBlogPostByIdHandler,
  toSliceInput: (id) => ({ id }),
  fromSliceInput: (input) => [input.id],
  fromSliceResult: (res) => {
    if (res.success) return res.data;
    if (res.error.code === "NOT_FOUND" || res.error.code === "INVALID_INPUT") {
      return null;
    }
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) return S.createFailure("NOT_FOUND", "Not found");
    return S.createSuccess(val);
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "updateDraftBlogPost", {
  key: "blog.updateDraftBlogPost",
  HandlerCtor: S.UpdateDraftBlogPostHandler,
  toSliceInput: (id, patch) => ({ id, patch }),
  fromSliceInput: (input) => [input.id, input.patch],
  fromSliceResult: (res) => {
    if (res.success) return res.data;
    if (res.error.code === "NOT_FOUND") return null;
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) return S.createFailure("NOT_FOUND", "Not found");
    return S.createSuccess(val);
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "deleteBlogPost", {
  key: "blog.deleteBlogPost",
  HandlerCtor: S.DeleteBlogPostHandler,
  toSliceInput: (id) => ({ id }),
  fromSliceInput: (input) => [input.id],
  fromSliceResult: (res) => {
    if (res.success) return res.data;
    if (res.error.code === "NOT_FOUND") return null;
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) return S.createFailure("NOT_FOUND", "Not found");
    return S.createSuccess(val);
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "getAllPublishedBlogPosts", {
  key: "blog.getAllPublishedBlogPosts",
  HandlerCtor: S.GetAllPublishedBlogPostsHandler,
  toSliceInput: () => ({}),
  fromSliceInput: () => [],
  fromSliceResult: (res) => (res.success ? res.data : []),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "getBlogPostBySlug", {
  key: "blog.getBlogPostBySlug",
  HandlerCtor: S.GetBlogPostBySlugHandler,
  toSliceInput: (slug) => ({ slug }),
  fromSliceInput: (input) => [input.slug],
  fromSliceResult: (res) => (res.success ? res.data : null),
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) return S.createFailure("NOT_FOUND", "Not found");
    return S.createSuccess(val);
  },
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "evictBlogPostCache", {
  key: "blog.evictBlogPostCache",
  HandlerCtor: S.EvictBlogPostCacheHandler,
  toSliceInput: (slug) => ({ slug }),
  fromSliceInput: (input) => [input.slug],
  fromSliceResult: (res) => (res.success ? res.data.evicted : false),
  toSliceResult: (val) =>
    isServiceEnvelope(val) ? val : S.createSuccess({ evicted: val }),
  onRejectResult: () => S.createSuccess({ evicted: false }),
});

bindAsyncSlice(BlogPostService, "getReactions", {
  key: "blog.getReactions",
  HandlerCtor: S.GetBlogReactionsHandler,
  toSliceInput: (slug, connectionHash) => ({ slug, connectionHash }),
  fromSliceInput: (input) => [input.slug, input.connectionHash],
  fromSliceResult: (res) => {
    const data = unwrapOrThrow(res);
    return { success: true as const, ...data };
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    return S.createSuccess({
      blogPostSlug: val.blogPostSlug,
      counts: val.counts,
      userReactions: val.userReactions,
    });
  },
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "submitReaction", {
  key: "blog.submitReaction",
  HandlerCtor: S.SubmitBlogReactionHandler,
  toSliceInput: (input, connectionHash) => ({ ...input, connectionHash }),
  fromSliceInput: (input) => [
    { blogPostSlug: input.blogPostSlug, reactionType: input.reactionType },
    input.connectionHash,
  ],
  fromSliceResult: (res) => {
    if (res.success) {
      return { success: true, ...res.data };
    }
    if (res.error.code === "RATE_LIMITED") {
      const details = res.error.details as
        S.DuplicateBlogReactionDetails | undefined;
      return {
        success: false,
        duplicate: true,
        message: res.error.message,
        reactionType: details?.reactionType ?? "",
        counts: details?.counts ?? S.getDefaultBlogReactionCounts(),
        userReactions: details?.userReactions ?? [],
      };
    }
    if (res.error.code === "NOT_FOUND") {
      return {
        success: false,
        notFound: true,
        message: res.error.message,
        reactionType: "",
        counts: S.getDefaultBlogReactionCounts(),
        userReactions: [],
      };
    }
    return {
      success: false,
      message: res.error.message,
      reactionType: "",
      counts: S.getDefaultBlogReactionCounts(),
      userReactions: [],
    };
  },
  toSliceResult: (val) => {
    if (
      isServiceEnvelope<
        S.SubmitBlogReactionData,
        S.SubmitBlogReactionErrorCode
      >(val)
    ) {
      return val;
    }
    const legacy = val as LegacyBlogSubmitReactionResponse;
    if (legacy.success) {
      return S.createSuccess({
        reactionType: legacy.reactionType,
        counts: legacy.counts,
        userReactions: legacy.userReactions,
      });
    }
    if (legacy.duplicate) {
      return S.createFailure(
        "RATE_LIMITED",
        legacy.message ?? "Duplicate reaction",
        {
          recoverable: true,
          details: {
            reactionType: legacy.reactionType,
            counts: legacy.counts,
            userReactions: legacy.userReactions,
          },
        }
      );
    }
    if (legacy.notFound) {
      return S.createFailure("NOT_FOUND", legacy.message ?? "Not found");
    }
    return S.createFailure(
      "STORAGE_UNAVAILABLE",
      legacy.message ?? "Storage unavailable"
    );
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "flushBufferedReactionsToDatabase", {
  key: "blog.flushBufferedReactionsToDatabase",
  HandlerCtor: S.FlushBlogReactionsHandler,
  toSliceInput: (batchSize = 500) => ({ batchSize }),
  fromSliceInput: (input) => [input?.batchSize ?? 500],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("FLUSH_FAILED", String(err), { details: err }),
});

bindAsyncSlice(BlogPostService, "hydrateBlogReactionCounts", {
  key: "blog.hydrateBlogReactionCounts",
  HandlerCtor: S.HydrateBlogReactionCountsHandler,
  toSliceInput: (slug) => ({ slug }),
  fromSliceInput: (input) => [input.slug],
  fromSliceResult: (res) =>
    res.success ? res.data.counts : S.getDefaultBlogReactionCounts(),
  toSliceResult: (val) =>
    isServiceEnvelope(val) ? val : S.createSuccess({ counts: val }),
  onRejectResult: () => S.createSuccess({ counts: {} }),
});

const EmailAsyncMethods = {
  checkRecipientEligibility: async (
    _email: string
  ): Promise<S.RecipientEligibility> => ({ status: "eligible" }),
  getSuppressedEmails: async (_emails: string[]): Promise<Set<string>> =>
    new Set(),
  recordSuppression: async (
    _email: string,
    _reason: S.SuppressionReason
  ): Promise<void> => {},
  enqueueEmail: async (
    _options: S.RawEmailOptions,
    _client?: S.OutboundEmailQueueWriterLike
  ): Promise<string | null> => null,
  queueOutboundEmail: async (
    _options: S.RawEmailOptions,
    _fromAddress?: string,
    _errorReason?: string
  ): Promise<string | null> => null,
  processRetryQueue: async (
    _options?: S.ProcessRetryQueueInput
  ): Promise<S.ProcessRetryQueueResult> =>
    S.createSuccess({ processed: 0, succeeded: 0, failed: 0, deferred: 0 }),
  getRetryQueueHealth: async (
    _now?: Date
  ): Promise<S.EmailRetryQueueHealthData> => ({
    depth: 0,
    oldestPendingAgeMs: null,
    terminalFailures: 0,
    retryExhausted: 0,
    eligibilityDeferred: 0,
  }),
  handleWebhookEvent: async (
    _event: ResendWebhookEvent
  ): Promise<{ handled: boolean; suppressed?: boolean; reason?: string }> => ({
    handled: false,
  }),
  sendRawEmail: async (
    _options: S.RawEmailOptions
  ): Promise<EmailDispatchResult> => ({ success: true }),
  sendContactInquiry: async (
    _submission: ContactSubmission,
    _connectionHash?: string
  ): Promise<ContactDispatchResult> => ({
    success: true,
    adminResult: { success: true },
  }),
  sendFeedbackNotification: async (
    _payload: FeedbackNotificationPayload
  ): Promise<EmailDispatchResult> => ({ success: true }),
};

export const EmailService = Object.assign(EmailAsyncMethods, {
  EMAIL_RETRY_BATCH_SIZE: S.EMAIL_RETRY_BATCH_SIZE,
  resetClient(): void {
    S.resetEmailClient();
  },
});

bindAsyncSlice(EmailAsyncMethods, "checkRecipientEligibility", {
  key: "email.checkRecipientEligibility",
  HandlerCtor: S.CheckRecipientEligibilityHandler,
  toSliceInput: (email) => ({ email }),
  fromSliceInput: (input) => [input.email],
  fromSliceResult: (res) =>
    res.success
      ? res.data
      : {
          status: "unknown" as const,
          code: "SUPPRESSION_LOOKUP_FAILED" as const,
        },
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: () =>
    S.createSuccess({
      status: "unknown" as const,
      code: "SUPPRESSION_LOOKUP_FAILED" as const,
    }),
});

bindAsyncSlice(EmailAsyncMethods, "getSuppressedEmails", {
  key: "email.getSuppressedEmails",
  HandlerCtor: S.GetSuppressedEmailsHandler,
  toSliceInput: (emails) => ({ emails }),
  fromSliceInput: (input) => [input.emails],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure(
      "STORAGE_UNAVAILABLE",
      err instanceof Error ? err.message : String(err),
      { details: err }
    ),
});

bindAsyncSlice(EmailAsyncMethods, "recordSuppression", {
  key: "email.recordSuppression",
  HandlerCtor: S.RecordEmailSuppressionHandler,
  toSliceInput: (email, reason) => ({ email, reason }),
  fromSliceInput: (input) => [input.email, input.reason],
  fromSliceResult: () => undefined,
  toSliceResult: (val) =>
    isServiceEnvelope(val)
      ? val
      : S.createSuccess({ email: "", reason: "BOUNCE" as const }),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(EmailAsyncMethods, "enqueueEmail", {
  key: "email.enqueueEmail",
  HandlerCtor: S.EnqueueEmailHandler,
  toSliceInput: (options, client) => ({ options, client }),
  fromSliceInput: (input) => [input.options, input.client],
  fromSliceResult: (res) => (res.success ? res.data.queueId : null),
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) {
      return S.createFailure("ENQUEUE_FAILED", "Could not enqueue email");
    }
    return S.createSuccess({ queueId: val });
  },
  onRejectResult: (err) =>
    S.createFailure("ENQUEUE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(EmailAsyncMethods, "queueOutboundEmail", {
  key: "email.queueOutboundEmail",
  HandlerCtor: S.QueueOutboundEmailHandler,
  toSliceInput: (options, fromAddress, errorReason) => ({
    options,
    fromAddress,
    errorReason,
  }),
  fromSliceInput: (input) => [
    input.options,
    input.fromAddress,
    input.errorReason,
  ],
  fromSliceResult: (res) => (res.success ? res.data.queueId : null),
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === null) {
      return S.createFailure("STORAGE_UNAVAILABLE", "Queue unavailable");
    }
    return S.createSuccess({ queueId: val });
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(EmailAsyncMethods, "processRetryQueue", {
  key: "email.processRetryQueue",
  HandlerCtor: S.ProcessRetryQueueHandler,
  toSliceInput: (options = {}) => options,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("QUEUE_LEASE_FAILED", String(err), { details: err }),
});

bindAsyncSlice(EmailAsyncMethods, "getRetryQueueHealth", {
  key: "email.getRetryQueueHealth",
  HandlerCtor: S.GetEmailRetryQueueHealthHandler,
  toSliceInput: (now) => (now ? { now } : {}),
  fromSliceInput: (input) => [input?.now],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(EmailAsyncMethods, "handleWebhookEvent", {
  key: "email.handleWebhookEvent",
  HandlerCtor: S.HandleEmailWebhookEventHandler,
  toSliceInput: (event) => ({ event }),
  fromSliceInput: (input) => [input.event],
  fromSliceResult: (res) =>
    res.success
      ? {
          handled: true,
          suppressed: res.data.suppressed,
          ...(res.data.reason !== undefined ? { reason: res.data.reason } : {}),
        }
      : { handled: false },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (!val.handled) {
      return S.createFailure("STORAGE_UNAVAILABLE", "Webhook event unhandled");
    }
    const reason: S.SuppressionReason | undefined =
      val.reason === "BOUNCE" ||
      val.reason === "COMPLAINT" ||
      val.reason === "UNSUBSCRIBE"
        ? val.reason
        : undefined;
    return S.createSuccess({
      suppressed: val.suppressed ?? false,
      ...(reason !== undefined ? { reason } : {}),
    });
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(EmailAsyncMethods, "sendRawEmail", {
  key: "email.sendRawEmail",
  HandlerCtor: S.SendRawEmailHandler,
  toSliceInput: (options) => options,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => toEmailDispatchResult(res),
  toSliceResult: (val) => fromEmailDispatchResult(val),
  onRejectResult: (err) =>
    S.createFailure(
      "DELIVERY_FAILED",
      err instanceof Error ? err.message : String(err),
      { details: err }
    ),
});

bindAsyncSlice(EmailAsyncMethods, "sendContactInquiry", {
  key: "email.sendContactInquiry",
  HandlerCtor: S.SendContactInquiryHandler,
  toSliceInput: (submission, connectionHash) => ({
    submission,
    ...(connectionHash !== undefined ? { connectionHash } : {}),
  }),
  fromSliceInput: (input) => [input.submission, input.connectionHash],
  fromSliceResult: (res) => {
    if (res.success) {
      return {
        success: true,
        messageId: res.data.messageId,
        simulated: res.data.simulated,
        adminResult: toEmailDispatchResult(res.data.adminResult),
        confirmationResult: toEmailDispatchResult(res.data.confirmationResult),
      };
    }
    return {
      success: false,
      error: res.error.message,
      adminResult: { success: false, error: res.error.message },
    };
  },
  toSliceResult: (val) => {
    if (
      isServiceEnvelope<
        S.SendContactInquiryData,
        S.SendContactInquiryErrorCode
      >(val)
    ) {
      return val;
    }
    const legacy = val as ContactDispatchResult;
    if (legacy.success) {
      const id = legacy.messageId ?? legacy.adminResult?.data?.id ?? "msg_mock";
      return S.createSuccess({
        messageId: id,
        simulated: legacy.simulated,
        adminResult: fromEmailDispatchResult(
          legacy.adminResult ?? { success: true, data: { id } }
        ),
        confirmationResult: fromEmailDispatchResult(
          legacy.confirmationResult ?? {
            success: true,
            data: { id: "msg_confirm_mock" },
          }
        ),
      });
    }
    return S.createFailure(
      "DELIVERY_FAILED",
      legacy.error ?? legacy.adminResult?.error ?? "Failed to send inquiry"
    );
  },
  onRejectResult: (err) =>
    S.createFailure(
      "DELIVERY_FAILED",
      err instanceof Error ? err.message : String(err),
      { details: err }
    ),
});

bindAsyncSlice(EmailAsyncMethods, "sendFeedbackNotification", {
  key: "email.sendFeedbackNotification",
  HandlerCtor: S.SendFeedbackNotificationHandler,
  toSliceInput: (payload) => payload,
  fromSliceInput: (input) => [input],
  fromSliceResult: (res) => toEmailDispatchResult(res),
  toSliceResult: (val) => fromEmailDispatchResult(val),
  onRejectResult: (err) =>
    S.createFailure(
      "DELIVERY_FAILED",
      err instanceof Error ? err.message : String(err),
      { details: err }
    ),
});

const NewsletterAsyncMethods = {
  subscribe: async (
    _rawEmail: string,
    _now?: Date
  ): Promise<NewsletterSubscribeResult> => ({
    success: true,
    confirmationSent: false,
  }),
  confirm: async (
    _token: string,
    _now?: Date
  ): Promise<S.NewsletterTokenOutcome> => "invalid",
  unsubscribe: async (
    _token: string,
    _now?: Date
  ): Promise<S.NewsletterTokenOutcome> => "invalid",
  queuePostAnnouncement: async (_blogPostId: string): Promise<void> => {},
  dispatchDue: async (_now?: Date): Promise<S.DispatchDueNewsletterResult> =>
    S.createSuccess({
      queued: 0,
      skippedSuppressed: 0,
      completedDispatches: 0,
      openDispatches: 0,
      capacity: S.NEWSLETTER_DISPATCH_CAP,
    }),
  auditNullQueueDeliveries: async (
    _options?: S.NullQueueDeliveriesAuditOptions
  ): Promise<S.AuditNullQueueDeliveriesResult> => {
    throw new Error("unbound");
  },
};

export const NewsletterService = Object.assign(NewsletterAsyncMethods, {
  NEWSLETTER_DISPATCH_CAP: S.NEWSLETTER_DISPATCH_CAP,
  CONFIRMATION_RESEND_INTERVAL_MS: S.CONFIRMATION_RESEND_INTERVAL_MS,
  unsubscribeUrl: S.unsubscribeUrl,
  listUnsubscribeHeaders: S.listUnsubscribeHeaders,
});

bindAsyncSlice(NewsletterAsyncMethods, "subscribe", {
  key: "nl.subscribe",
  HandlerCtor: S.SubscribeNewsletterHandler,
  toSliceInput: (email, now) => ({
    email,
    ...(now !== undefined ? { now } : {}),
  }),
  fromSliceInput: (input) =>
    input.now !== undefined ? [input.email, input.now] : [input.email],
  fromSliceResult: (res) => {
    if (res.success) {
      return {
        success: true,
        confirmationSent: res.data.confirmationSent,
        ...(res.data.simulated !== undefined
          ? { simulated: res.data.simulated }
          : {}),
      };
    }
    return {
      success: false,
      confirmationSent: false,
      error: res.error.message,
    };
  },
  toSliceResult: (val) => {
    if (
      isServiceEnvelope<
        S.SubscribeNewsletterData,
        S.SubscribeNewsletterErrorCode
      >(val)
    ) {
      return val;
    }
    const legacy = val as NewsletterSubscribeResult;
    if (legacy.success) {
      return S.createSuccess({
        confirmationSent: legacy.confirmationSent,
        simulated: legacy.simulated,
      });
    }
    return S.createFailure(
      "DELIVERY_FAILED",
      legacy.error ?? "Subscription failed"
    );
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(NewsletterAsyncMethods, "confirm", {
  key: "nl.confirm",
  HandlerCtor: S.ConfirmSubscriberHandler,
  toSliceInput: (token, now) => ({
    token,
    ...(now !== undefined ? { now } : {}),
  }),
  fromSliceInput: (input) =>
    input.now !== undefined ? [input.token, input.now] : [input.token],
  fromSliceResult: (res) => {
    if (res.success) return res.data.outcome;
    if (res.error.code === "NOT_FOUND" || res.error.code === "INVALID_INPUT") {
      return "invalid";
    }
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === "invalid") {
      return S.createFailure("NOT_FOUND", "Unknown confirmation token");
    }
    return S.createSuccess({
      outcome:
        val === "already_confirmed"
          ? ("already_confirmed" as const)
          : ("confirmed" as const),
    });
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(NewsletterAsyncMethods, "unsubscribe", {
  key: "nl.unsubscribe",
  HandlerCtor: S.UnsubscribeSubscriberHandler,
  toSliceInput: (token, now) => ({
    token,
    ...(now !== undefined ? { now } : {}),
  }),
  fromSliceInput: (input) =>
    input.now !== undefined ? [input.token, input.now] : [input.token],
  fromSliceResult: (res) => {
    if (res.success) return res.data.outcome;
    if (res.error.code === "NOT_FOUND" || res.error.code === "INVALID_INPUT") {
      return "invalid";
    }
    return unwrapOrThrow(res);
  },
  toSliceResult: (val) => {
    if (isServiceEnvelope(val)) return val;
    if (val === "invalid") {
      return S.createFailure("NOT_FOUND", "Unknown unsubscribe token");
    }
    return S.createSuccess({
      outcome:
        val === "already_unsubscribed"
          ? ("already_unsubscribed" as const)
          : ("unsubscribed" as const),
    });
  },
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(NewsletterAsyncMethods, "queuePostAnnouncement", {
  key: "nl.queuePostAnnouncement",
  HandlerCtor: S.QueuePostAnnouncementHandler,
  toSliceInput: (blogPostId) => ({ blogPostId }),
  fromSliceInput: (input) => [input.blogPostId],
  fromSliceResult: (res) => {
    if (!res.success) unwrapOrThrow(res);
  },
  toSliceResult: (val) =>
    isServiceEnvelope(val) ? val : S.createSuccess({ blogPostId: "queued" }),
  onRejectResult: (err) =>
    S.createFailure("STORAGE_UNAVAILABLE", String(err), { details: err }),
});

bindAsyncSlice(NewsletterAsyncMethods, "dispatchDue", {
  key: "nl.dispatchDue",
  HandlerCtor: S.DispatchDueNewsletterHandler,
  toSliceInput: (now) => (now !== undefined ? { now } : {}),
  fromSliceInput: (input) => [input?.now],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure(
      "DISPATCH_FAILED",
      err instanceof Error ? err.message : String(err),
      { details: err }
    ),
});

bindAsyncSlice(NewsletterAsyncMethods, "auditNullQueueDeliveries", {
  key: "nl.auditNullQueueDeliveries",
  HandlerCtor: S.AuditNullQueueDeliveriesHandler,
  toSliceInput: (options = {}) => options,
  fromSliceInput: (input) => [input ?? {}],
  fromSliceResult: (res) => res,
  toSliceResult: (val) => val,
  onRejectResult: (err) =>
    S.createFailure("AUDIT_FAILED", String(err), { details: err }),
});

export const MaintenanceService = {
  run: async (
    _options?: S.RunMaintenanceInput
  ): Promise<S.MaintenanceSummary> =>
    unwrapOrThrow(await new S.RunMaintenanceHandler().execute(_options ?? {})),
};

bindAsyncSlice(MaintenanceService, "run", {
  key: "maint.run",
  HandlerCtor: S.RunMaintenanceHandler,
  toSliceInput: (options = {}) => options,
  fromSliceInput: (input) => [input ?? {}],
  fromSliceResult: (res) => unwrapOrThrow(res),
  toSliceResult: (val) => (isServiceEnvelope(val) ? val : S.createSuccess(val)),
  onRejectResult: (err) =>
    S.createFailure("INVALID_INPUT", String(err), { details: err }),
});
