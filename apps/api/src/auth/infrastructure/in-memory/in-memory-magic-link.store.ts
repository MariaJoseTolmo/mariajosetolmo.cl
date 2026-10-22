import type { Clock } from '../../../shared/application/ports/clock.port';
import type {
  MagicLinkPayload,
  MagicLinkStore,
} from '../../application/ports/magic-link-store.port';

interface Entry {
  readonly payload: MagicLinkPayload;
  readonly ttlSeconds: number;
  readonly expiresAt: number;
}

/** Test double with the same contract as the Redis store (TTL, once-only, NX). */
export class InMemoryMagicLinkStore implements MagicLinkStore {
  private readonly entriesByKey = new Map<string, Entry>();

  constructor(private readonly clock: Clock) {}

  save(
    tokenHash: string,
    payload: MagicLinkPayload,
    ttlSeconds: number,
  ): Promise<void> {
    const live = this.live(tokenHash);
    if (live) return Promise.reject(new Error('Magic link key already exists'));
    this.entriesByKey.set(tokenHash, {
      payload,
      ttlSeconds,
      expiresAt: this.clock.now().getTime() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  consume(tokenHash: string): Promise<MagicLinkPayload | null> {
    // Synchronous read-and-delete: no await between them, so it is atomic.
    const entry = this.live(tokenHash);
    this.entriesByKey.delete(tokenHash);
    return Promise.resolve(entry?.payload ?? null);
  }

  /** What is stored, for specs that assert on keys and TTLs. */
  entries(): { key: string; ttlSeconds: number; payload: MagicLinkPayload }[] {
    return [...this.entriesByKey.entries()]
      .filter(([key]) => this.live(key) !== null)
      .map(([key, { payload, ttlSeconds }]) => ({ key, ttlSeconds, payload }));
  }

  private live(tokenHash: string): Entry | null {
    const entry = this.entriesByKey.get(tokenHash);
    if (!entry) return null;
    return entry.expiresAt > this.clock.now().getTime() ? entry : null;
  }
}
