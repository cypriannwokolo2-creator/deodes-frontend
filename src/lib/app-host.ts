/**
 * Apex ↔ app host helpers.
 *
 * Marketing lives on deodes.com; the authenticated app lives on
 * app.deodes.com. The middleware already 302s full page loads
 * (apex + cookie → app), but client-side auth transitions (login,
 * register) never hit the middleware — without this, a fresh login on
 * the apex renders the dashboard on the wrong host.
 *
 * All helpers are prod-only and no-op on localhost / previews.
 */

export const APP_HOST = "app.deodes.com";
const APEX_HOSTS = new Set(["deodes.com", "www.deodes.com"]);

export function currentHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

export function isApexHost(host = currentHostname()): boolean {
  return APEX_HOSTS.has(host);
}

/** Hard navigation to the same path on the app host (no-op off apex). */
export function redirectToApp(path = "/"): void {
  if (typeof window === "undefined") return;
  if (!isApexHost()) return;
  window.location.href = `https://${APP_HOST}${path}`;
}

/**
 * After login/register: on apex prod go to the app host, otherwise
 * fall back to the in-app router navigation (dev, previews, app host).
 */
export function navigatePostAuth(
  routerReplace: (href: string) => void,
  path = "/",
): void {
  // A circle invite waiting behind auth wins over the default landing page.
  const pending = takePendingInvite(path);
  if (typeof window !== "undefined" && isApexHost()) {
    redirectToApp(pending);
    return;
  }
  routerReplace(pending);
}

const PENDING_INVITE_KEY = "deodes_pending_invite";

/** Remember a circle invite link across the register/login detour. */
export function savePendingInvite(path: string): void {
  try {
    if (typeof window !== "undefined" && path.startsWith("/invite/")) {
      sessionStorage.setItem(PENDING_INVITE_KEY, path);
    }
  } catch {}
}

/** Consume the remembered invite, falling back to `fallback`. */
export function takePendingInvite(fallback = "/"): string {
  try {
    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (pending && pending.startsWith("/invite/")) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        return pending;
      }
    }
  } catch {}
  return fallback;
}

/** Peek without consuming (OAuth buttons build `?next=` from this). */
export function getPendingInvite(): string | null {
  try {
    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (pending && pending.startsWith("/invite/")) return pending;
    }
  } catch {}
  return null;
}

/** Drop the remembered invite (called on arrival at the invite page). */
export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}
}
