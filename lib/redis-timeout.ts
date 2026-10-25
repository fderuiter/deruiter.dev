/**
 * Raised when an Upstash command outlives its time budget.
 *
 * A timed-out cache read is an ordinary cache miss: callers fall through to
 * the database and keep the error out of Sentry, so a cold Upstash connection
 * does not spend the error quota (#2850).
 */
export class RedisTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisTimeoutError";
  }
}

/**
 * Races a Redis command against a timeout, always clearing the timer so it
 * cannot hold the event loop open.
 *
 * @param promise The pending Redis command.
 * @param ms Time budget in milliseconds.
 * @param message Message for the `RedisTimeoutError` raised when the budget runs out.
 * @returns The command's result if it settles first.
 */
export async function withRedisTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RedisTimeoutError(message));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
