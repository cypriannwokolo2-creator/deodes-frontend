"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import {
  createOnrampAppKit,
  fetchOnrampSession,
  fetchOnrampWidgetBaseUrl,
} from "@/lib/onramp/session";
import { cn } from "@/lib/cn";

export interface DepositSettledPayload {
  paymentId?: string;
  amount?: string;
  [key: string]: unknown;
}

interface OnrampWidgetProps {
  appUserId: string;
  destinationAddress: string;
  widgetBaseUrl?: string;
  onSettled?: (payload: DepositSettledPayload) => void;
  onNotCompleted?: (code: string) => void;
  onError?: (message: string) => void;
  className?: string;
}

type WidgetState = "loading" | "ready" | "error";

/**
 * Circle App Kit Onramp widget (iframe mode) — buy USDC on Arc with fiat.
 *
 * The container needs an explicit height or the iframe collapses to 0px
 * (Circle hosting requirement). Sessions are minted server-side; the API
 * key never reaches the browser. Invalid (non-0x) destinations are refused
 * before any network call.
 */
export function OnrampWidget({
  appUserId,
  destinationAddress,
  widgetBaseUrl,
  onSettled,
  onNotCompleted,
  onError,
  className,
}: OnrampWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ close: () => void } | null>(null);
  const callbacksRef = useRef({ onSettled, onNotCompleted, onError });
  callbacksRef.current = { onSettled, onNotCompleted, onError };
  const [state, setState] = useState<WidgetState>("loading");
  const [error, setError] = useState("");
  const [popupBusy, setPopupBusy] = useState(false);

  const fail = useCallback((message: string) => {
    setError(message);
    setState("error");
    callbacksRef.current.onError?.(message);
  }, []);

  // Fallback for embeds the browser or an extension/AV web-shield refuses to
  // load inside the page (Chrome shows "onramp.arc.io refused to connect" in
  // the frame while a plain top-level visit works). A popup is a first-party
  // navigation to the same widget URL, which those blockers allow.
  const openInNewWindow = async () => {
    if (popupBusy) return;
    setPopupBusy(true);
    try {
      const status = await openOnrampPopup({
        appUserId,
        destinationAddress,
        widgetBaseUrl,
        onSettled: (payload) => callbacksRef.current.onSettled?.(payload),
        onNotCompleted: (code) => callbacksRef.current.onNotCompleted?.(code),
      });
      if (status === "blocked") {
        fail("Your browser blocked the payment window — allow popups for this site, then try again.");
      } else if (status === "error") {
        fail("Could not open the payment window — please try again.");
      }
    } finally {
      setPopupBusy(false);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress)) {
      fail("Connect an Arc wallet first — onramp needs a 0x destination address.");
      return;
    }
    if (!appUserId) {
      fail("Sign in first — onramp sessions are per-user.");
      return;
    }

    let cancelled = false;

    const mount = async (remount = false) => {
      try {
        const resolvedBase = await fetchOnrampWidgetBaseUrl(widgetBaseUrl);
        if (cancelled) return;
        const kit = createOnrampAppKit(resolvedBase);
        const session = await fetchOnrampSession({ appUserId, destinationAddress });
        if (cancelled) return;
        widgetRef.current?.close();
        widgetRef.current = kit.onramp.mountIframe({
          session,
          container,
          onDepositSettled: ({ payload }) =>
            callbacksRef.current.onSettled?.(
              (payload ?? {}) as DepositSettledPayload,
            ),
          onDepositNotCompleted: ({ code }) =>
            callbacksRef.current.onNotCompleted?.(String(code ?? "unknown")),
          onSessionExpired: async () => {
            if (!cancelled) await mount(true);
          },
        });
        if (!cancelled && !remount) setState("ready");
      } catch (err) {
        if (cancelled) return;
        fail(
          err instanceof Error ? err.message : "Failed to start onramp session",
        );
      }
    };

    void mount();
    const stop = () => {
      cancelled = true;
      widgetRef.current?.close();
      widgetRef.current = null;
    };
    window.addEventListener("beforeunload", stop);
    return () => {
      window.removeEventListener("beforeunload", stop);
      stop();
    };
  }, [appUserId, destinationAddress, widgetBaseUrl, fail]);

  return (
    <div className={cn("w-full", className)}>
      {state === "error" && (
        <div role="alert" className="mb-2 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </div>
      )}
      {/* Circle requires the mount target to already have an explicit height
          or the iframe collapses to 0px and no card/bank input ever appears.
          Keep h-[720px] mounted at all times; the spinner overlays it while
          the session mints instead of swapping in a h-0 container. */}
      <div className="relative h-[720px] w-full">
        <div
          ref={containerRef}
          id="onramp-root"
          className="h-[720px] w-full overflow-hidden rounded-xl border border-white/10"
        />
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-white/10 bg-background/80">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading onramp…</span>
          </div>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          Card and bank payments are processed by Circle. Deodes charges nothing on deposits.
        </span>
        <button
          type="button"
          onClick={openInNewWindow}
          disabled={popupBusy}
          className="text-aurora-violet underline decoration-dotted underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          Widget not loading?{" "}
          {popupBusy ? "opening…" : "open in a new window →"}
        </button>
      </p>
    </div>
  );
}

/**
 * Popup mode — call directly from a click handler or the browser blocks it.
 * Returns 'opened' | 'blocked'.
 */
export async function openOnrampPopup(args: {
  appUserId: string;
  destinationAddress: string;
  widgetBaseUrl?: string;
  onSettled?: (payload: DepositSettledPayload) => void;
  onNotCompleted?: (code: string) => void;
}): Promise<"opened" | "blocked" | "error"> {
  try {
    const resolvedBase = await fetchOnrampWidgetBaseUrl(args.widgetBaseUrl);
    const kit = createOnrampAppKit(resolvedBase);
    const session = await fetchOnrampSession({
      appUserId: args.appUserId,
      destinationAddress: args.destinationAddress,
    });
    const result = await kit.onramp.openWindow({
      session,
      onDepositSettled: ({ payload }) =>
        args.onSettled?.((payload ?? {}) as DepositSettledPayload),
      onDepositNotCompleted: ({ code }) =>
        args.onNotCompleted?.(String(code ?? "unknown")),
    });
    return result.status === "blocked" ? "blocked" : "opened";
  } catch {
    return "error";
  }
}
