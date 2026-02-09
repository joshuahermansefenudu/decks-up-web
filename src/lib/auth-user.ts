import type { User } from "@supabase/supabase-js"

import { supabaseAdmin } from "@/lib/supabase-admin"

type AuthUserResult = {
  user: User | null
  error: string | null
}

async function parseAuthUser(
  request: Request,
  options: { required: boolean }
): Promise<AuthUserResult> {
  const authorization = request.headers.get("authorization")
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return options.required
      ? { user: null, error: "Missing auth token." }
      : { user: null, error: null }
  }

  const accessToken = authorization.slice("Bearer ".length).trim()
  if (!accessToken) {
    return options.required
      ? { user: null, error: "Missing auth token." }
      : { user: null, error: null }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data.user) {
    return options.required
      ? { user: null, error: "Invalid auth token." }
      : { user: null, error: null }
  }

  return { user: data.user, error: null }
}

export async function getAuthUser(request: Request): Promise<AuthUserResult> {
  return parseAuthUser(request, { required: true })
}

export async function getOptionalAuthUser(
  request: Request
): Promise<AuthUserResult> {
  return parseAuthUser(request, { required: false })
}
