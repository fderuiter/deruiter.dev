/**
 * Dedicated class of exceptions designed specifically to represent in-game crashes
 * and simulated gameplay failures. These exceptions are globally filtered out from
 * telemetry/monitoring reports.
 */
export class GameEngineException extends Error {
  constructor(message: string = "Simulated gameplay failure") {
    super(message);
    this.name = "GameEngineException";

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, GameEngineException.prototype);

    // Maintain proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
