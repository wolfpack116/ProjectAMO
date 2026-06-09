/**
 * Wraps fetch() with an AbortController-based timeout.
 * Returns the raw Response — callers decide how to read the body.
 */
export async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
