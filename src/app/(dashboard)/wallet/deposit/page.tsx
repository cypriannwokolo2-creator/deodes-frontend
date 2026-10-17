"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, BellRing, CreditCard, Landmark } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { OnrampWidget } from "@/components/onramp/onramp-widget";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/stores/ui-store";
import { ARC_NETWORK } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { useDepositAddress } from "./hooks/use-deposit-address";

const COMING_SOON_RAILS = [
  { code: "NGN", label: "Nigerian Naira", detail: "Bank transfer" },
  { code: "KES", label: "Kenyan Shilling", detail: "M-Pesa" },
  { code: "GHS", label: "Ghanaian Cedi", detail: "Mobile money" },
];

/**
 * Local-currency deposits are coming soon — except Circle card payments,
 * which go live as soon as the Circle key is configured.
 *
 * Bank/mobile-money rails are static copy (no quote calls, no payment
 * state). The Circle widget is gated on NEXT_PUBLIC_ONRAMP_ENABLED and
 * badges sandbox-vs-live money so test funds are never mistaken for real.
 */
export default function DepositPage() {
  const addToast = useUIStore((s) => s.addToast);
  const { user, isLoading: authLoading, checkAuth } = useAuth();
  const onrampEnabled = process.env.NEXT_PUBLIC_ONRAMP_ENABLED === "true";

  const {
    depositAddress,
    hostedError,
    resolving,
    retryHosted,
  } = useDepositAddress();

  const [onrampOpen, setOnrampOpen] = useState(false);
  const [onrampEnv, setOnrampEnv] = useState<"sandbox" | "production" | null>(null);

  const authReady = !authLoading;
  const needsAuth = authReady && !user?.id;

  // Resolve the Circle env for the money badge (testnet vs live).
  useEffect(() => {
    if (!onrampOpen || !onrampEnabled) return;
    let cancelled = false;
    fetch("/api/onramp/sessions", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const env = (data as { env?: unknown } | null)?.env;
        setOnrampEnv(env === "production" ? "production" : "sandbox");
      })
      .catch(() => {
        if (!cancelled) setOnrampEnv(null);
      });
    return () => {
      cancelled = true;
    };
  }, [onrampOpen, onrampEnabled]);

  const envMismatch =
    onrampEnv === "production" && ARC_NETWORK !== "mainnet";

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* ── Back + Title ── */}
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Back to wallet">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Deposit</h1>
          <p className="text-sm text-muted-foreground">Fund your wallet with local currency</p>
        </div>
      </div>

      {/* Timeline-style announcement */}
      <div className="border-l-4 border-l-aurora-violet pl-6 py-2">
        <p className="font-mono text-xs uppercase tracking-widest text-aurora-violet">Coming soon</p>
        <p className="font-heading text-4xl md:text-5xl font-black mt-2">
          ₦ → USDC,<br />made simple.
        </p>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
          Bank transfers and mobile-money deposits are on the way. Deodes itself
          charges nothing on deposits — you will only ever see the rail&apos;s
          own fee, quoted up front before you confirm.
        </p>
      </div>

      {/* Rail pills */}
      <ul aria-label="Upcoming deposit rails" className="flex flex-wrap gap-2">
        {COMING_SOON_RAILS.map((rail) => (
          <li
            key={rail.code}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs"
          >
            <Banknote className="h-3.5 w-3.5 text-aurora-violet" aria-hidden="true" />
            <span className="font-heading font-semibold text-foreground">{rail.code}</span>
            <span className="text-muted-foreground">{rail.label} · {rail.detail}</span>
          </li>
        ))}
      </ul>

      {/* Two long buttons: live Circle rail first, local rails coming soon underneath */}
      <div className="space-y-3">
        {onrampEnabled ? (
          <button
            type="button"
            onClick={() => setOnrampOpen(true)}
            aria-label="Buy USDC with card via Circle"
            className="flex w-full items-center gap-4 rounded-xl border border-aurora-violet/40 bg-aurora-violet/10 px-5 py-4 text-left transition-colors hover:bg-aurora-violet/20"
          >
            <CreditCard className="h-5 w-5 shrink-0 text-aurora-violet" aria-hidden="true" />
            <span className="flex-1">
              <span className="block font-heading text-sm font-semibold text-foreground">
                Buy USDC with card or bank (Circle)
              </span>
              <span className="block text-xs text-muted-foreground">
                Card or bank · USDC lands on Arc · Deodes charges nothing
              </span>
            </span>
            <span aria-hidden="true" className="text-aurora-violet">→</span>
          </button>
        ) : null}
        <button
          type="button"
          disabled
          aria-label="Buy USDC with local bank transfer, coming soon"
          aria-disabled="true"
          className="flex w-full cursor-not-allowed items-center gap-4 rounded-xl border border-dashed border-white/15 px-5 py-4 text-left opacity-80"
        >
          <Landmark className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-heading text-sm font-semibold text-foreground">
              Buy with bank or mobile money
            </span>
            <span className="block text-xs text-muted-foreground">
              NGN bank · KES M-Pesa · GHS mobile money · any amount — Coming soon
            </span>
          </span>
          <span className="rounded-full border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Soon
          </span>
        </button>
      </div>

      {/* Notify strip */}
      <div className="rounded-xl border border-dashed border-white/15 px-5 py-4 flex items-start gap-3">
        <BellRing className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Saving in USDC with your circle already works on-chain today. Watch this
          space — fiat deposits open here first, starting with NGN bank transfer.
        </p>
      </div>

      <Link href="/wallet" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Wallet
      </Link>

      {/* Circle Onramp modal */}
      {onrampEnabled && (
        <Modal
          isOpen={onrampOpen}
          onClose={() => setOnrampOpen(false)}
          title="Buy USDC with card or bank"
          description="Processed by Circle. Deodes charges nothing on deposits."
          size="lg"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px]",
                onrampEnv === "production"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              {onrampEnv === "production" ? "LIVE · real money" : "TESTNET · play money"}
            </span>
            {envMismatch && (
              <span className="text-[11px] text-red-300">
                Warning: Circle is live but this app is on Arc testnet.
              </span>
            )}
          </div>
          {user?.id && depositAddress ? (
            <OnrampWidget
              appUserId={user.id}
              destinationAddress={depositAddress}
              onSettled={() => {
                addToast({ type: "success", title: "Deposit settled", description: "USDC is on its way to your Arc wallet." });
                setOnrampOpen(false);
              }}
              onNotCompleted={(code) =>
                addToast({ type: "info", title: "Deposit not completed", description: code })
              }
              onError={(message) =>
                addToast({ type: "error", title: "Onramp failed", description: message })
              }
            />
          ) : needsAuth ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-200">
                Your session is still loading — sign-in state wasn&apos;t ready when
                the deposit widget asked for it.
              </p>
              <button
                type="button"
                onClick={() => checkAuth()}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              >
                Reload session
              </button>
            </div>
          ) : hostedError ? (
            <div className="space-y-2">
              <p className="text-sm text-red-300">
                Couldn&apos;t prepare your Arc wallet{hostedError !== "no-arc-wallet" ? `: ${hostedError}` : "."}
              </p>
              <button
                type="button"
                onClick={retryHosted}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {authLoading ? "Checking your session…" : "Setting up your Arc wallet…"}
              </p>
              {/* Retry stays visible while resolving: a hung /wallets or
                  hosted-arc/ensure call previously left this copy on screen
                  forever with no way out and no Circle card input. */}
              {authReady && (
                <button
                  type="button"
                  onClick={resolving ? retryHosted : retryHosted}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
                >
                  {resolving ? "Taking too long? Try again" : "Try again"}
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
