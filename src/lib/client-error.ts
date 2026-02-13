export async function formatResponseError(
  response: Response,
  label: string
) {
  const requestId =
    response.headers.get("x-vercel-id") ?? response.headers.get("cf-ray") ?? ""

  let detail = ""

  try {
    const raw = await response.text()
    if (!raw) {
      detail = response.statusText || "Empty response body"
    } else {
      try {
        const parsed = JSON.parse(raw) as {
          error?: unknown
          message?: unknown
          code?: unknown
          name?: unknown
          meta?: unknown
        }
        if (typeof parsed.error === "string") {
          detail = parsed.error

          if (typeof parsed.code === "string" && parsed.code) {
            detail += ` | code=${parsed.code}`
          }

          if (typeof parsed.name === "string" && parsed.name) {
            detail += ` | name=${parsed.name}`
          }

          if (parsed.meta) {
            detail += ` | meta=${JSON.stringify(parsed.meta)}`
          }
        } else if (typeof parsed.message === "string") {
          detail = parsed.message
        } else {
          detail = raw
        }
      } catch {
        detail = raw
      }
    }
  } catch {
    detail = response.statusText || "Unable to read response body"
  }

  return [
    `${label}`,
    `status=${response.status}`,
    requestId ? `requestId=${requestId}` : "",
    `detail=${detail}`,
  ]
    .filter(Boolean)
    .join(" | ")
}

export function formatThrownError(error: unknown, label: string) {
  return `${label} | detail=${String((error as Error)?.message ?? error)}`
}
