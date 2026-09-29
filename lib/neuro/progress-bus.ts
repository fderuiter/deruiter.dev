/**
 * NeuroRecon Event-Driven Progress Bus
 * Pub/Sub Event Bus for real-time external 3D asset download progress streaming.
 */

import { logger } from "@/lib/logger";
import { formatBytes as formatSharedBytes } from "@/lib/utils/number-format";

export interface AssetProgressEvent {
  url: string;
  loaded: number;
  total: number;
  percentage: number; // 0 to 100
  status: "loading" | "complete" | "error";
  error?: string;
}

export type ProgressSubscriber = (event: AssetProgressEvent) => void;

export class ProgressBus {
  private subscribers: Set<ProgressSubscriber> = new Set();

  /**
   * Subscribe to asset download progress events.
   * Returns an unsubscribe function.
   */
  subscribe(callback: ProgressSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Publish a progress event to all active subscribers.
   */
  publish(event: AssetProgressEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        logger.error("Error in progress listener subscriber:", err);
      }
    });
  }

  /**
   * Remove all active subscribers.
   */
  clear(): void {
    this.subscribers.clear();
  }
}

export const progressBus = new ProgressBus();

/**
 * Format raw byte counts into human-readable string (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  return formatSharedBytes(bytes, { decimals });
}
