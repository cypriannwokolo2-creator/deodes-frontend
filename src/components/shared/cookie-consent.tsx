"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/api-client";
import { logger } from "@/lib/logger";

const CONSENT_KEY = "deodes_analytics_consent";
const SESSION_KEY = "deodes_consent_session";

function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `anon-${crypto.randomUUID()}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

/**
 * GDPR cookie consent banner (T080). Choice is stored locally (read by the
 * analytics gate in layout) AND recorded server-side via POST /v1/consent
 * (anonymous sessionId before login, user-bound after).
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CONSENT_KEY) === null) setVisible(true);
    } catch {
      /* storage unavailable: stay hidden, analytics gate defaults off */
    }
  }, []);

  if (!visible) return null;

  const choose = (analytics: boolean) => {
    try {
      localStorage.setItem(CONSENT_KEY, String(analytics));
    } catch {}
    setVisible(false);
    post("/consent", { analytics, marketing: false, sessionId: sessionId() }).catch((e) =>
      logger.warn("[consent] Failed to record choice:", e),
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-2xl border border-white/10 bg-card/95 p-5 shadow-2xl backdrop-blur-xl"
    >
      <p className="font-heading text-sm font-semibold text-foreground">
        Cookies & privacy
      </p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        We use strictly-necessary cookies to keep you signed in, and optional
        analytics cookies to improve Deodes. Your choice is saved on this
        device and in your account record.
      </p>
      <div className="mt-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => choose(false)}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={() => choose(true)}
          className="rounded-xl bg-aurora-violet/20 border border-aurora-violet/40 px-4 py-2 text-sm font-medium text-aurora-violet hover:bg-aurora-violet/30 transition-colors"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
