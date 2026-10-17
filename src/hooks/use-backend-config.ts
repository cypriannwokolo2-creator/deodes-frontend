"use client"

/**
 * useBackendConfig — public backend feature flags (Phase 2.3).
 *
 * Fetches GET <API_BASE_URL>/config once per page load (module-cached
 * promise, so N buttons cause 1 request) and reports whether a flow the
 * backend may have disabled (Google sign-in without GOOGLE_CLIENT_ID)
 * should render at all.
 *
 * Fail-open visibility: if the backend is unreachable or the payload is
 * unreadable, `googleEnabled` stays true and the button renders — a dead
 * button that 503s is annoying, but hiding login paths on a transient
 * network blip is worse. Only an explicit `google_enabled: false` hides it.
 * Same rule for `emailConfigured`: only explicit `email.configured: false`
 * raises the delivery warning banner.
 */

import { useEffect, useState } from "react"
import { API_BASE_URL } from "@/lib/constants"

export interface BackendConfig {
  googleEnabled: boolean
  emailConfigured: boolean
}

let cachedPromise: Promise<BackendConfig> | null = null

const defaults = (): BackendConfig => ({ googleEnabled: true, emailConfigured: true })

export function fetchBackendConfig(): Promise<BackendConfig> {
  if (!cachedPromise) {
    cachedPromise = fetch(`${API_BASE_URL}/config`, { credentials: "omit" })
      .then(async (res): Promise<BackendConfig> => {
        if (!res.ok) return defaults()
        const json = (await res.json()) as {
          data?: { google_enabled?: unknown; email?: { configured?: unknown } }
        }
        const googleFlag = json?.data?.google_enabled
        const emailFlag = json?.data?.email?.configured
        // Explicit false hides/warns; anything else (true/missing/garbage) stays quiet.
        return {
          googleEnabled: googleFlag !== false,
          emailConfigured: emailFlag !== false,
        }
      })
      .catch(() => defaults())
  }
  return cachedPromise
}

/** Test hook: reset the module cache between cases. */
export function resetBackendConfigCache(): void {
  cachedPromise = null
}

export function useBackendConfig(): BackendConfig {
  const [config, setConfig] = useState<BackendConfig>(defaults())

  useEffect(() => {
    let cancelled = false
    void fetchBackendConfig().then((next) => {
      if (!cancelled) setConfig(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return config
}
