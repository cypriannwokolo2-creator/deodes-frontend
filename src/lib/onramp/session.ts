"use client";

import { AppKit } from "@circle-fin/app-kit";
import type { OnrampSession } from "@circle-fin/app-kit";
import { getCsrfHeaders } from "@/lib/auth/csrf";
import { circleWidgetBaseUrlPublicOverride } from "@/lib/onramp/env";

export interface OnrampSessionBody {
  appUserId: string;
  destinationAddress: string;
  assets?: {
    tokens?: string[];
    chains?: string[];
  };
}

export interface OnrampEnvProbe {
  env: "sandbox" | "production";
  configured: boolean;
  widgetBaseUrl?: string;
}

/**
 * Mint a Circle Onramp session via our server route (the Circle API key
 * never leaves the server) and return it for the widget.
 *
 * Scoped to USDC on Arc by default — Deodes only handles that pair.
 *
 * Sends the double-submit CSRF header: our middleware 403s every
 * mutating /api/* POST without `x-csrf-token` matching the CSRF cookie,
 * and the SDK's fetch sends no custom headers on its own — without this
 * the mint fails with HTTP 403 before the route handler ever runs.
 * If the cookie is absent (fresh profile, cleared cookies), one
 * same-origin GET primes it first — the middleware attaches the CSRF
 * cookie to every response that lacks one.
 */
export async function fetchOnrampSession(
  body: OnrampSessionBody,
): Promise<OnrampSession> {
  const kit = new AppKit();
  let headers = getCsrfHeaders();
  if (!headers["x-csrf-token"]) {
    try {
      await fetch("/api/onramp/sessions", { method: "GET", cache: "no-store" });
    } catch {
      // Best-effort: the mint below surfaces the real error.
    }
    headers = getCsrfHeaders();
  }
  return kit.onramp.fetchSession({
    url: "/api/onramp/sessions",
    headers,
    body: {
      appUserId: body.appUserId,
      destinationAddress: body.destinationAddress,
      assets: body.assets ?? { tokens: ["USDC"], chains: ["arc"] },
    },
  });
}

/**
 * Public env probe (`GET /api/onramp/sessions`) — the server's
 * `widgetBaseUrl` for the active CIRCLE_ENV. Never carries keys.
 */
export async function fetchOnrampEnv(): Promise<OnrampEnvProbe> {
  const res = await fetch("/api/onramp/sessions", {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Onramp env probe failed (${res.status})`);
  return (await res.json()) as OnrampEnvProbe;
}

/**
 * Resolve the widget origin the browser must mount.
 * Precedence: explicit arg > NEXT_PUBLIC_* override > server probe.
 * Rejects to undefined (caller falls back to the SDK production default)
 * so a probe failure degrades to default instead of blocking the widget.
 */
export async function fetchOnrampWidgetBaseUrl(
  explicit?: string,
): Promise<string | undefined> {
  const trimmed = (explicit ?? "").trim();
  if (trimmed !== "") return trimmed;
  const override = circleWidgetBaseUrlPublicOverride();
  if (override !== undefined) return override;
  try {
    const probe = await fetchOnrampEnv();
    const probed = (probe.widgetBaseUrl ?? "").trim();
    return probed === "" ? undefined : probed;
  } catch {
    return undefined;
  }
}

/** Client AppKit pinned to the resolved widget origin (sandbox-safe). */
export function createOnrampAppKit(widgetBaseUrl?: string): AppKit {
  const trimmed = (widgetBaseUrl ?? "").trim();
  return trimmed === ""
    ? new AppKit()
    : new AppKit({ onramp: { widgetBaseUrl: trimmed } });
}
