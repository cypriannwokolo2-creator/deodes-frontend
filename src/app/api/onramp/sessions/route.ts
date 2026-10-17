import { NextResponse } from "next/server";
import {
  createAppServerKit,
  createSessionRouteHandler,
} from "@circle-fin/app-kit/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/session-cookies";
import { logger } from "@/lib/logger";
import {
  circleApiBaseUrl,
  circleApiKeyFor,
  circleWidgetBaseUrl,
  resolveCircleEnv,
} from "@/lib/onramp/env";

/**
 * Circle App Kit Onramp sessions — fiat → USDC on Arc.
 *
 * POST /api/onramp/sessions { appUserId, destinationAddress, assets? }
 *
 * The Circle API key mints sessions server-side only and never reaches the
 * browser; the client receives a short-lived session token for the widget.
 * Fail-closed: 503 when CIRCLE_API_KEY is unset (onramp disabled).
 *
 * Auth: the caller must hold our HttpOnly access-token cookie AND request a
 * session for its own subject (body.appUserId === JWT sub). The cookie value
 * alone is self-asserted — anyone can curl a forged JWT — so the bearer is
 * additionally verified against the backend (/v1/me validates the signature
 * and session); the backend-reported user id must agree with both.
 * This stops one user minting onramp sessions attributed to someone else.
 *
 * NOTE (webhooks): browser DEPOSIT_SETTLED events are best-effort UX only.
 * Reconcile final state from Circle webhooks once configured in Console —
 * add POST /api/onramp/webhook with signature verification per
 * docs.arc.io/app-kit/references/onramp-hosting-requirements before going
 * live. Not shipped yet on purpose: no unverified receiver.
 */

export const runtime = "nodejs";

function readJwtSub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

function isArcAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Confirms the presented bearer with the backend: GET /v1/me validates the
 * JWT signature and session server-side and echoes the subject. Returns true
 * only when the backend agrees the token belongs to `sub`.
 */
async function isBackendSession(token: string, sub: string): Promise<boolean> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (base === "") return false;
  try {
    const res = await fetch(`${base}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as {
      data?: { user?: { id?: unknown } };
    };
    return json?.data?.user?.id === sub;
  } catch {
    return false;
  }
}

/** Bare hostname for the widget's frame-ancestors allowlist (no scheme/port). */
function referrerDomain(request: Request): string {
  let host = "localhost";
  try {
    // Same-origin fallback: the embedding page lives on this host.
    // Set ONRAMP_REFERRER_DOMAIN explicitly in production (required for
    // debit card / Apple Pay / Google Pay — 403 otherwise).
    host = new URL(request.url).hostname;
  } catch {
    // keep localhost fallback
  }
  const configured = (process.env.ONRAMP_REFERRER_DOMAIN ?? "").trim();
  if (configured === "") return host;
  // A stale ONRAMP_REFERRER_DOMAIN (e.g. app.deodes.com while serving
  // deodes.com) makes Circle reject card/Apple-Pay/Google-Pay with 403 and
  // renders a blank widget. Prefer the actual embedding host when they
  // disagree — the widget is always same-origin mounted.
  if (configured !== host) {
    logger.warn("onramp referrer domain mismatch, using request host", {
      configured,
      host,
    });
    return host;
  }
  return configured;
}

function unauthorized(): Response {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

async function buildHandler(request: Request) {
  const env = resolveCircleEnv();
  const apiKey = circleApiKeyFor(env);
  if (apiKey === "") {
    return NextResponse.json(
      { error: `Onramp is not configured for ${env} (missing key)` },
      { status: 503 },
    );
  }

  const server = createAppServerKit({
    onramp: {
      apiKey,
      baseUrl: circleApiBaseUrl(env),
      widgetBaseUrl: circleWidgetBaseUrl(env),
      referrerDomain: referrerDomain(request),
    },
  });

  const handle = createSessionRouteHandler(server.onramp, {
    authorize: async (req) => {
      const cookie = req.headers.get("cookie") ?? "";
      const match = cookie.match(
        new RegExp(`(?:^|;\\s*)${ACCESS_TOKEN_COOKIE}=([^;]+)`),
      );
      const raw = match ? decodeURIComponent(match[1]) : null;
      const sub = raw ? readJwtSub(raw) : null;
      if (sub === null || raw === null) return false;
      try {
        const body = (await req.clone().json()) as {
          appUserId?: unknown;
          destinationAddress?: unknown;
        };
        if (body.appUserId !== sub) return false;
        if (!isArcAddress(body.destinationAddress)) return false;
        return await isBackendSession(raw, sub);
      } catch {
        return false;
      }
    },
    onError: (error, req) => {
      logger.error("onramp session mint failed", {
        url: req.url,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await buildHandler(request);
  } catch (error) {
    logger.error("onramp session route failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return unauthorized();
  }
}

/**
 * Public env probe so the UI can badge testnet-vs-live money.
 * Returns the active Circle env only — never keys. Harmless to expose:
 * it tells users whether deposits move real money. `widgetBaseUrl` is the
 * exact widget origin the browser must mount (sandbox vs production), so
 * the client stays in sync with CIRCLE_ENV without its own flag.
 */
export async function GET(): Promise<Response> {
  const env = resolveCircleEnv();
  const configured = circleApiKeyFor(env) !== "";
  return NextResponse.json(
    { env, configured, widgetBaseUrl: circleWidgetBaseUrl(env) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
