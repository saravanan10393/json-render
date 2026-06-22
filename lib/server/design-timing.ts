/**
 * Tool-level timing for the design stage. The chat-driven design turn is a
 * single `agent.stream(...)` where the agent freely interleaves
 * applyDesignSystem → saveSitemap → saveDesignArtifact ×N as tool calls.
 * Post-hoc wall-clock measurement would lump the whole turn under one
 * artifact; this module lets each tool stamp `durationMs = now - prevTool`
 * onto its OWN artifact, giving accurate per-stage chips even when the
 * agent does everything in one breath.
 *
 *   runStageTurn (design) → installDesignTiming(requestContext)
 *                             ↓
 *   applyDesignSystem fires  → stampNextDuration(ctx, setThemeDuration)
 *   saveSitemap fires        → stampNextDuration(ctx, setSitemapDuration)
 *   saveDesignArtifact fires → stampNextDuration(ctx, setMockupDuration)
 *
 * No-op when the ref isn't installed (so backend/frontend tool calls keep
 * working unchanged).
 */

// Structural type — sidesteps `RequestContext<T>` generic-variance friction
// that bites when callers parameterize the context differently per call site.
// `{}` (= non-nullable) matches Mastra's set signature exactly.
interface CtxLike {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  set: (k: string, v: {}) => void;
  get: (k: string) => unknown;
}

const KEY = "__designTimingRef";

interface TimingRef {
  /** performance.now() at the last tool boundary (or the install point). */
  prevAt: number;
}

/** Install a fresh design-stage timing reference into a RequestContext. */
export function installDesignTiming(ctx: CtxLike): void {
  ctx.set(KEY, { prevAt: performance.now() } satisfies TimingRef);
}

/** Stamp the elapsed milliseconds since the previous boundary onto whatever
 *  artifact `set` writes to, then advance the boundary. Safe no-op when the
 *  timing ref isn't installed (backend/frontend stages). */
export function stampNextDuration(
  ctx: CtxLike,
  set: (durationMs: number) => void,
): void {
  const ref = ctx.get(KEY) as TimingRef | undefined;
  if (!ref) return;
  const now = performance.now();
  set(Math.round(now - ref.prevAt));
  ref.prevAt = now;
}
