type Bucket = {
  hits: number
  resetAtMs: number
}

const globalRateLimitState = globalThis as unknown as {
  sfuRateLimitBuckets?: Map<string, Bucket>
}

const buckets = globalRateLimitState.sfuRateLimitBuckets ?? new Map<string, Bucket>()
globalRateLimitState.sfuRateLimitBuckets = buckets

export function checkRateLimit(
  key: string,
  options: { maxHits: number; windowMs: number }
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAtMs <= now) {
    buckets.set(key, {
      hits: 1,
      resetAtMs: now + options.windowMs,
    })
    return { ok: true, retryAfterSeconds: 0 }
  }

  existing.hits += 1
  buckets.set(key, existing)

  if (existing.hits <= options.maxHits) {
    return { ok: true, retryAfterSeconds: 0 }
  }

  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000)),
  }
}

