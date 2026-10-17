"use client";

import { useEffect, useState } from "react";
import { useBackendConfig } from "@/hooks/use-backend-config";
import { getPendingInvite } from "@/lib/app-host";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** "Continue with Google" — starts the OAuth flow in ../api/auth/google.
 * Hidden when the backend reports google_enabled: false (Phase 2.3: no
 * GOOGLE_CLIENT_ID → the endpoint 503s, so offering the button is a trap).
 * Fail-open: renders while loading or when the config is unreachable. */
export function GoogleButton({ mode }: { mode: "signin" | "signup" }) {
  const { googleEnabled } = useBackendConfig()
  const [startHref, setStartHref] = useState("/api/auth/google/start")
  // A circle invite waiting behind auth rides along as OAuth `next`, so the
  // callback lands back on /invite/<code> instead of the home page.
  useEffect(() => {
    const pending = getPendingInvite()
    if (pending) setStartHref(`/api/auth/google/start?next=${encodeURIComponent(pending)}`)
  }, [])
  if (!googleEnabled) return null
  return (
    <a
      data-testid="google-button"
      href={startHref}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.03] text-sm font-heading font-semibold text-foreground transition-all hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-foreground"
    >
      <GoogleMark />
      {mode === "signin" ? "Continue with Google" : "Sign up with Google"}
    </a>
  );
}
