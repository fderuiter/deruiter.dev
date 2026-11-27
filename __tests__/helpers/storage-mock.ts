import { onTestFinished } from "vitest";
import type { RunSnapshotStorage } from "@/lib/arcade";
import { MockStorage } from "../../vitest.setup";

export { MockStorage };

export type MockStorageTarget = "localStorage" | "sessionStorage";

export interface ThrowingStorageOptions {
  readonly initialEntries?: Record<string, string>;
  readonly readError?: () => unknown;
  readonly writeError?: () => unknown;
}

export interface ToggleableMockStorageOptions {
  readonly initialEntries?: Record<string, string>;
  readonly denyReads?: boolean;
  readonly denyWrites?: boolean;
}

export interface ResetMockStorageOptions<
  T extends Storage | undefined = MockStorage,
> {
  readonly target?: MockStorageTarget;
  readonly storage?: T;
}

function defaultSecurityError(): DOMException {
  return new DOMException("The operation is insecure.", "SecurityError");
}

function defaultQuotaExceededError(): DOMException {
  return new DOMException(
    "QuotaExceededError: Quota exceeded.",
    "QuotaExceededError"
  );
}

/**
 * Storage mock whose read and mutation operations throw `SecurityError`
 * `DOMException` instances by default, simulating blocked browser storage.
 */
export class ThrowingStorage extends MockStorage {
  private armed = false;
  private readonly makeReadError: () => unknown;
  private readonly makeWriteError: () => unknown;

  constructor(options: ThrowingStorageOptions = {}) {
    super();
    if (options.initialEntries) {
      for (const [key, value] of Object.entries(options.initialEntries)) {
        super.setItem(key, value);
      }
    }
    this.makeReadError = options.readError ?? defaultSecurityError;
    this.makeWriteError = options.writeError ?? defaultSecurityError;
    this.armed = true;
  }

  override getItem(key: string): string | null {
    if (this.armed) {
      throw this.makeReadError();
    }
    return super.getItem(key);
  }

  override setItem(key: string, value: string): void {
    if (this.armed) {
      throw this.makeWriteError();
    }
    super.setItem(key, value);
  }

  override removeItem(key: string): void {
    if (this.armed) {
      throw this.makeWriteError();
    }
    super.removeItem(key);
  }

  override clear(): void {
    if (this.armed) {
      throw this.makeWriteError();
    }
    super.clear();
  }
}

/**
 * Storage mock that accepts optional pre-seeded entries before rejecting all
 * subsequent `setItem` writes with a `QuotaExceededError` `DOMException`.
 */
export class QuotaExceededStorage extends MockStorage {
  private denyWrites = false;

  constructor(initialEntries: Record<string, string> = {}) {
    super();
    for (const [key, value] of Object.entries(initialEntries)) {
      super.setItem(key, value);
    }
    this.denyWrites = true;
  }

  override setItem(key: string, value: string): void {
    if (this.denyWrites) {
      throw defaultQuotaExceededError();
    }
    super.setItem(key, value);
  }
}

/**
 * Storage mock supporting runtime read/write denial toggles and snapshot entry
 * inspection for offline and upgrade fixtures.
 */
export class ToggleableMockStorage
  extends MockStorage
  implements RunSnapshotStorage
{
  private denyReads = false;
  private denyWrites = false;

  constructor(options: ToggleableMockStorageOptions = {}) {
    super();
    if (options.initialEntries) {
      for (const [key, value] of Object.entries(options.initialEntries)) {
        super.setItem(key, value);
      }
    }
    this.denyReads = options.denyReads ?? false;
    this.denyWrites = options.denyWrites ?? false;
  }

  setDenyReads(deny: boolean): void {
    this.denyReads = deny;
  }

  setDenyWrites(deny: boolean): void {
    this.denyWrites = deny;
  }

  override getItem(key: string): string | null {
    if (this.denyReads) {
      throw defaultSecurityError();
    }
    return super.getItem(key);
  }

  override setItem(key: string, value: string): void {
    if (this.denyWrites) {
      throw defaultQuotaExceededError();
    }
    super.setItem(key, value);
  }

  entries(): Record<string, string> {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < super.length; i += 1) {
      const k = super.key(i);
      if (k !== null) {
        const value = super.getItem(k);
        if (value !== null) {
          snapshot[k] = value;
        }
      }
    }
    return snapshot;
  }
}

function isStorageLike(value: unknown): value is Storage {
  if (typeof value !== "object" || value === null) return false;
  if (value instanceof MockStorage) return true;
  const candidate = value as Partial<Storage>;
  return (
    typeof candidate.getItem === "function" ||
    typeof candidate.setItem === "function"
  );
}

function collectHosts(): object[] {
  const hosts: object[] = [globalThis];
  if (typeof window !== "undefined" && (window as object) !== globalThis) {
    hosts.push(window);
  }
  return hosts;
}

/**
 * Installs a clean `MockStorage` (or caller-supplied storage) onto
 * `localStorage` or `sessionStorage` and restores prior descriptors when the
 * active Vitest test finishes.
 */
export function resetMockStorage(target?: MockStorageTarget): MockStorage;
export function resetMockStorage<T extends Storage>(
  storage: T,
  target?: MockStorageTarget
): T;
export function resetMockStorage<T extends Storage | undefined = MockStorage>(
  options: ResetMockStorageOptions<T>
): T;
export function resetMockStorage(
  first?:
    MockStorageTarget | Storage | ResetMockStorageOptions<Storage | undefined>,
  second?: MockStorageTarget
): Storage | undefined {
  let target: MockStorageTarget = "localStorage";
  let storage: Storage | undefined;

  if (first === undefined || typeof first === "string") {
    target = first ?? "localStorage";
    storage = new MockStorage();
  } else if (isStorageLike(first)) {
    storage = first;
    target = second ?? "localStorage";
  } else {
    target = first.target ?? "localStorage";
    storage = "storage" in first ? first.storage : new MockStorage();
  }

  const hosts = collectHosts();
  const saved = hosts.map((host) => ({
    host,
    descriptor: Object.getOwnPropertyDescriptor(host, target),
  }));

  for (const host of hosts) {
    Object.defineProperty(host, target, {
      value: storage,
      writable: true,
      configurable: true,
    });
  }

  const restore = (): void => {
    for (const { host, descriptor } of saved) {
      if (descriptor) {
        Object.defineProperty(host, target, descriptor);
      } else {
        Reflect.deleteProperty(host, target);
      }
    }
  };

  try {
    onTestFinished(restore);
  } catch {
    // Called outside an active test context (e.g. module setup); keep installed.
  }

  return storage;
}
