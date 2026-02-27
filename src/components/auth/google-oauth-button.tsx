import * as React from "react"

import { cn } from "@/lib/utils"

type GoogleOAuthButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  isLoading?: boolean
  loadingLabel?: string
}

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path
        fill="#EA4335"
        d="M12 11.1v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.2H12Z"
      />
      <path
        fill="#34A853"
        d="M3 7.5l3.2 2.4C7 8 9.3 6.6 12 6.6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 4 14.5 3 12 3 8.2 3 4.9 5.1 3 7.5Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21c2.4 0 4.5-.8 6-2.3l-2.8-2.3c-.8.6-1.9 1.1-3.2 1.1-2.7 0-4.9-1.8-5.7-4.3l-3.3 2.6C4.9 18.7 8.2 21 12 21Z"
      />
      <path
        fill="#4285F4"
        d="M20.6 12.3c0-.6-.1-1-.2-1.2H12v3.9h5.5c-.3 1.4-1.2 2.5-2.3 3.3l2.8 2.3c1.6-1.5 2.6-3.8 2.6-6.9Z"
      />
    </svg>
  )
}

function GoogleOAuthButton({
  className,
  children,
  disabled,
  isLoading = false,
  loadingLabel = "Redirecting...",
  ...props
}: GoogleOAuthButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center justify-center gap-3 rounded-full border-2 border-black bg-white px-6 py-3 text-base font-semibold tracking-wide text-black shadow-[4px_4px_0_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      <GoogleLogo />
      <span>{isLoading ? loadingLabel : children ?? "Continue with Google"}</span>
    </button>
  )
}

export { GoogleOAuthButton }
