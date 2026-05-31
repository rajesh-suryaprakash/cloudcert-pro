/** Returns the current time as an ISO 8601 string (e.g. "2026-03-22T10:00:00.000Z"). */
export const nowIso = (): string => new Date().toISOString();

/** Returns the current time as milliseconds since the Unix epoch. */
export const nowMs = (): number => Date.now();
