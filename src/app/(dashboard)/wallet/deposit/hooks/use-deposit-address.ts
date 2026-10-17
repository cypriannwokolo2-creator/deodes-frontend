"use client";

import { useCallback, useEffect, useState } from "react";

export function isArcAddress(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
}

/**
 * Prefer hosted, then the primary 0x wallet, then any linked 0x wallet:
 * Circle can pay USDC to any Arc address the user controls. The old
 * `(hosted || primary) && 0x` filter dropped a valid linked address when
 * no hosted row existed yet, leaving the modal with no destination.
 */
export function pickDepositAddress(wallets: Record<string, unknown>[]): string | null {
  const addrs = wallets
    .map((w) => ({
      raw: String(w.publicKey ?? ""),
      type: String(w.walletType ?? ""),
      primary: w.isPrimary === true,
    }))
    .filter((w) => isArcAddress(w.raw));
  if (addrs.length === 0) return null;
  return (
    addrs.find((w) => w.type === "hosted")?.raw ??
    addrs.find((w) => w.primary)?.raw ??
    addrs[0]?.raw ??
    null
  );
}

async function readWalletList(): Promise<Record<string, unknown>[]> {
  const { get } = await import("@/lib/api-client");
  const res = await get<unknown>("/wallets");
  const data = (res as Record<string, unknown>)?.data ?? res;
  const list = (data as Record<string, unknown>)?.wallets;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

/**
 * Deposit destination: always the hosted Arc wallet every account owns.
 * External wallets are never used here — buys must land where the balance
 * and sends read from, otherwise purchases become invisible. Tries the
 * wallet list first, then ensure (creates it when missing). `resolving`
 * drives the "Setting up…" copy so a hung GET/POST can still be retried.
 */
export function useDepositAddress() {
  const [hostedAddress, setHostedAddress] = useState<string | null>(null);
  const [hostedError, setHostedError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setHostedError(null);
    (async () => {
      try {
        const picked = pickDepositAddress(await readWalletList());
        if (cancelled) return;
        if (picked) {
          setHostedAddress(picked);
          setResolving(false);
          return;
        }
        const { ensureHostedArcWallet } = await import("@/lib/wallet/ensure-hosted");
        const w = await ensureHostedArcWallet();
        if (cancelled) return;
        if (w && isArcAddress(w.publicKey)) {
          setHostedAddress(w.publicKey);
          setResolving(false);
        } else {
          setHostedError("no-arc-wallet");
          setResolving(false);
        }
      } catch (e) {
        if (!cancelled) {
          const { getErrorMessage } = await import("@/lib/api-client");
          setHostedError(getErrorMessage(e));
          setResolving(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const retryHosted = useCallback(() => {
    setHostedError(null);
    setHostedAddress(null);
    setResolving(true);
    (async () => {
      try {
        try {
          const picked = pickDepositAddress(await readWalletList());
          if (picked) {
            setHostedAddress(picked);
            setResolving(false);
            return;
          }
        } catch {
          // Fall through to ensure — the list read is best-effort.
        }
        const { ensureHostedArcWallet } = await import("@/lib/wallet/ensure-hosted");
        const w = await ensureHostedArcWallet();
        if (w && isArcAddress(w.publicKey)) setHostedAddress(w.publicKey);
        else setHostedError("no-arc-wallet");
      } catch (e) {
        const { getErrorMessage } = await import("@/lib/api-client");
        setHostedError(getErrorMessage(e));
      } finally {
        setResolving(false);
      }
    })();
  }, []);

  return {
    hostedAddress,
    hostedError,
    resolving,
    depositAddress: hostedAddress,
    retryHosted,
  };
}
