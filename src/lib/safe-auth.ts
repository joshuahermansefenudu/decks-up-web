import { supabaseBrowser } from "@/lib/supabase-browser"

export async function getAccessTokenSafe() {
  try {
    const { data, error } = await supabaseBrowser.auth.getSession()
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.log("SUPABASE_GET_SESSION_ERROR", error.message)
      }
      return ""
    }

    return data.session?.access_token ?? ""
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.log("SUPABASE_GET_SESSION_FAILED", error)
    }
    return ""
  }
}
