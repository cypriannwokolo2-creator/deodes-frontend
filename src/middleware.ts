import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { buildCsp, cspMode, CSP_REPORT_PATH, generateNonce } from "@/lib/security/csp"
import { API_CSP } from "@/lib/security/api-csp.mjs"
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_MAX_AGE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session-cookies"
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale/locale-cookie"

// Protected routes that require authentication
const PROTECTED_PATHS = ["/circles", "/communities", "/wallet", "/settings", "/profile", "/notifications", "/contributions", "/payouts", "/admin", "/governance", "/savings", "/people", "/referrals", "/reputation"]

// Dev-only API routes backed by flat-file JSON storage.  These are useful
// for local development but must never be reachable in a deployed environment.
// The middleware blocks them as the first line of defence; each handler also
// calls blockInProduction() as defence-in-depth.
const DEV_ONLY_API_PATHS = [
  "/api/auth/login",
  "/api/auth/setup",
  "/api/upload",
  "/api/auth/logout",
  "/api/auth",
]

/** Request header the root layout reads to nonce its inline <script> tags. */
export const NONCE_HEADER = "x-nonce"
export const CSRF_HEADER = "x-csrf-token"

function generateCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
}

function attachCsrfCookie(response: NextResponse, csrfToken: string) {
  response.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    ...SESSION_COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: CSRF_TOKEN_MAX_AGE,
  })
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const origins = new Set([request.nextUrl.origin])
  // Behind Traefik the browser's Origin is `scheme://Host`, but
  // `nextUrl.origin` is NOT reliably the public origin here — empirically it
  // never matches `https://app.deodes.com`, which 403'd every state-changing
  // request from the app host (onramp sessions included). Reconstruct the
  // origin the browser actually sends from the edge's forwarded headers
  // (Traefik: passHostHeader + X-Forwarded-Proto on the websecure entrypoint).
  const host = (request.headers.get("host") ?? "").trim()
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http")
    origins.add(`${proto}://${host}`)
  }
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "https://deodes.com" : undefined)
  if (configuredAppUrl) {
    try {
      origins.add(new URL(configuredAppUrl).origin)
    } catch {
      origins.add(configuredAppUrl)
    }
  }
  // Canonical hosts, derived independently of runtime env, so the app host is
  // never excluded by a missing/mis-set NEXT_PUBLIC_APP_URL.
  if (process.env.NODE_ENV === "production") {
    origins.add("https://deodes.com")
    origins.add("https://app.deodes.com")
    origins.add("https://www.deodes.com")
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000")
    origins.add("http://localhost:1110")
    origins.add("http://127.0.0.1:3000")
    origins.add("http://127.0.0.1:1110")
  }
  return origins
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block dev-only API routes in production at the middleware level.
  // Returns 404 so the routes' existence is never advertised.
  if (process.env.NODE_ENV === "production") {
    for (const path of DEV_ONLY_API_PATHS) {
      if (pathname === path || pathname.startsWith(path + "/")) {
        // /api/auth is the dev-only session-check handler.  Production
        // sub-routes (/api/auth/session, /api/auth/refresh, …) must not be
        // blocked, so require an exact match for the bare /api/auth path.
        if (path === "/api/auth" && pathname !== path) continue
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }
  }

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value

  // API routes return JSON, never HTML, so they must not receive the page CSP
  // with its per-request script nonce and third-party script sources. They get
  // the static, minimal API policy instead (same one next.config.mjs serves via
  // headers()). The nonce is still minted — it travels on the request for
  // pages that render inline scripts — but the API response advertises no
  // script allowances at all.
  const nonce = generateNonce()
  const isApiRoute = pathname.startsWith("/api/")
  const mode = cspMode()
  const csp = isApiRoute ? API_CSP : buildCsp(nonce, undefined, mode)
  // Report-only mode swaps which header carries the page policy. Same string,
  // but the browser reports violations instead of blocking the resource, which
  // is what makes a candidate policy safe to deploy ahead of promotion.
  //
  // API routes are excluded deliberately. The API policy is a different,
  // narrower policy with no per-request nonce and no reporting directives, and
  // it is also served statically from next.config.mjs under the enforcing
  // header. Letting the mode rename that header would put two CSP headers with
  // different semantics on every JSON response and silently un-enforce it.
  const cspHeaderName = !isApiRoute && mode === "report-only"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy"
  const csrfToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value || generateCsrfToken()
  const shouldSetCsrfCookie = !request.cookies.has(CSRF_TOKEN_COOKIE)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(NONCE_HEADER, nonce)
  requestHeaders.set(CSRF_HEADER, csrfToken)
  
  // #211: Add locale header for dynamic lang attribute. The cookie is the only
  // locale state the server can see, and it is written the moment the visitor
  // picks a language — so this survives the login redirect instead of falling
  // back to English on every document request.
  //
  // resolveLocale() rather than the raw value: the cookie is attacker-settable
  // and this header ends up in the <html lang> attribute, so an unvalidated
  // value must never be forwarded as-is.
  const locale = resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value)
  requestHeaders.set("x-locale", locale)

  // Log ingestion is a same-origin, non-state-changing telemetry endpoint. It
  // intentionally bypasses the session CSRF handshake because sendBeacon cannot
  // attach custom headers; the route validates and redacts its payload instead.
  //
  // CSP violation reports are in the same category for the same reason: the
  // *browser* generates the POST, so it cannot carry x-csrf-token either. Both
  // endpoints are treated as one class because the failure mode is identical —
  // without the carve-out the double-submit check 403s every single report and
  // the endpoint silently collects nothing, which is worse than not shipping it
  // because it looks like it is working.
  const isTelemetryRoute = pathname === "/api/logs" || pathname === CSP_REPORT_PATH
  if (isTelemetryRoute) {
    const origin = request.headers.get("origin")
    if (origin && !getAllowedOrigins(request).has(origin)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    }
  }

  // Circle onramp webhooks are server-to-server: Circle cannot send an
  // Origin allowlist entry or our double-submit token. The route verifies
  // the HMAC signature itself (401 on bad signature, 503 without secret),
  // so it bypasses both checks exactly like the telemetry routes above.
  const isWebhookRoute = pathname === "/api/onramp/webhook"

  // #207: CSRF protection for mutating API routes
  if (isApiRoute && !isTelemetryRoute && !isWebhookRoute && ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const origin = request.headers.get("origin")
    if (!origin || !getAllowedOrigins(request).has(origin)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    }

    const clientCsrf = request.headers.get("x-csrf-token")
    if (clientCsrf !== csrfToken) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }
  }

  // ── Apex/app host split ──────────────────────────────────────────────
  // Marketing lives on deodes.com; the authenticated app lives on
  // app.deodes.com. Cookies are shared across .deodes.com, so a login on
  // either host is visible on both:
  //   apex + session cookie → app host, same path (all page visits)
  //   app host, no cookie → apex: /login for protected paths, apex home
  //   for public pages (marketing has one canonical home)
  // API/static/telemetry traffic is never redirected. Only GET/HEAD — a
  // form POST must never turn into a cross-host redirect.
  if (!isApiRoute && (request.method === "GET" || request.method === "HEAD")) {
    const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase()
    const isAppHost = host === "app.deodes.com"
    const isApexHost = host === "deodes.com" || host === "www.deodes.com"
    if (isAppHost || isApexHost) {
      const go = (target: URL): NextResponse => {
        target.port = ""
        const redirect = NextResponse.redirect(target)
        redirect.headers.set(cspHeaderName, csp)
        if (shouldSetCsrfCookie) attachCsrfCookie(redirect, csrfToken)
        return redirect
      }
      if (isApexHost && token) {
        const target = new URL(request.url)
        target.hostname = "app.deodes.com"
        target.protocol = "https:"
        return go(target)
      }
      if (isAppHost && !token) {
        const isProtected = PROTECTED_PATHS.some(
          (p) => pathname === p || pathname.startsWith(p + "/"),
        )
        const target = new URL(request.url)
        target.hostname = "deodes.com"
        target.protocol = "https:"
        target.pathname = isProtected ? "/login" : target.pathname
        return go(target)
      }
    }
  }

  // Redirect unauthenticated users to login for protected routes
  if (!token) {
    for (const path of PROTECTED_PATHS) {
      if (pathname === path || pathname.startsWith(path + "/")) {
        const url = new URL("/login", request.url)
        const redirect = NextResponse.redirect(url)
        redirect.headers.set(cspHeaderName, csp)
        if (shouldSetCsrfCookie) attachCsrfCookie(redirect, csrfToken)
        return redirect
      }
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(cspHeaderName, csp)
  if (shouldSetCsrfCookie) attachCsrfCookie(response, csrfToken)
  return response
}

export const config = {
  // Every HTML document must carry the CSP header, so the matcher covers all
  // page routes and excludes only framework internals and static assets.
  // The dev-only API paths are listed explicitly so the middleware can block
  // them in production before any route handler executes.
  matcher: [
    "/((?!_next|favicon|static|locale|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2|json)$).*)",
    "/api/auth/login",
    "/api/auth/setup",
    "/api/upload",
    "/api/auth/logout",
    "/api/auth",
  ],
}
