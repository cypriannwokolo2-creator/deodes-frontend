import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import {
  GOOGLE_STATE_COOKIE,
  cookieDomain,
  defaultNext,
  exchangeCode,
  publicOrigin,
  splitState,
  verifyIdToken,
} from "@/lib/auth/google-server"
import { API_BASE_URL } from "@/lib/constants"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session-cookies"

function clientIp(request: NextRequest): string {
  return (
    (request as NextRequest & { ip?: string }).ip?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

/**
 * Explicit audit log for Google sign-ins (operator-requested).
 * NOTE: intentionally uses direct stdout instead of @/lib/logger, because
 * the shared logger redacts emails to "[email]". M3: the email is logged as
 * a SHA-256 hash (correlation without PII retention) — never plaintext,
 * never codes, tokens, or secrets.
 */
function auditGoogleLogin(fields: Record<string, unknown>): void {
  const line = JSON.stringify({ tag: "google-login", ts: new Date().toISOString(), ...fields })
  // eslint-disable-next-line no-console
  console.info(line)
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
}

function fail(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/login", publicOrigin(request.url))
  url.searchParams.set("error", reason)
  const response = NextResponse.redirect(url)
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", ...cookieDomain(), maxAge: 0 })
  return response
}

/** Google OAuth callback: verify identity, mint a DEODES session, go home. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  if (params.get("error") !== null) return fail(request, "google-cancelled")

  const { state, next } = splitState(params.get("state"))
  const cookieState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value
  if (!state || !cookieState || state !== cookieState) {
    return fail(request, "google-bad-state")
  }

  const code = params.get("code")
  if (!code) return fail(request, "google-no-code")

  try {
    const tokens = await exchangeCode(code)
    if (!tokens.id_token) {
      auditGoogleLogin({ ok: false, reason: "google-no-token", ip: clientIp(request) })
      return fail(request, "google-no-token")
    }
    const profile = await verifyIdToken(tokens.id_token)
    auditGoogleLogin({
      ok: true,
      email_hash: hashEmail(profile.email),
      google_sub: profile.sub,
      ip: clientIp(request),
      ua: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    })

    // Exchange the Google identity for a BACKEND-issued session. The backend
    // verifies the ID token against Google itself and signs RS256 tokens only
    // it can mint — the frontend must never mint session JWTs, or the backend
    // rejects every call and the user bounces between hosts appearing logged out.
    let token: string
    let refreshToken: string
    let backendCsrfToken = ""
    try {
      const upstream = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: tokens.id_token }),
      })
      if (!upstream.ok) throw new Error(`backend google exchange failed: ${upstream.status}`)
      const payload = (await upstream.json().catch(() => null)) as {
        data?: { token?: unknown; refreshToken?: unknown; csrfToken?: unknown }
        token?: unknown
        refreshToken?: unknown
        csrfToken?: unknown
      } | null
      const data = payload?.data ?? payload ?? {}
      if (typeof data.token !== "string" || data.token.length === 0) {
        throw new Error("backend returned no token")
      }
      token = data.token
      refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : ""
      // Persist the backend-issued CSRF token, never a local random: the
      // backend binds it to this access token and rejects anything else.
      if (typeof data.csrfToken === "string" && data.csrfToken.length > 0) {
        backendCsrfToken = data.csrfToken
      }
    } catch (err) {
      auditGoogleLogin({ ok: false, reason: "google-exchange-failed", ip: clientIp(request) })
      return fail(request, "google-failed")
    }

    const response = NextResponse.redirect(
      next === "/" ? defaultNext() : new URL(next, publicOrigin(request.url)),
    )
    response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    if (backendCsrfToken.length > 0) {
      response.cookies.set(CSRF_TOKEN_COOKIE, backendCsrfToken, {
        ...SESSION_COOKIE_OPTIONS,
        httpOnly: false,
        maxAge: CSRF_TOKEN_MAX_AGE,
      })
    }
    // The backend always returns a refresh token for Google sessions; fall
    // back gracefully if a future backend version stops doing so.
    if (refreshToken.length > 0) {
      response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      })
    }
    response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", ...cookieDomain(), maxAge: 0 })
    return response
  } catch (err) {
    auditGoogleLogin({ ok: false, reason: "google-failed", ip: clientIp(request), err: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200) })
    return fail(request, "google-failed")
  }
}
