"use client"

import Link from "next/link"
import { Wallet as WalletIcon } from "lucide-react"

interface WalletEmptyStateProps {
  signedIn: boolean
}

/**
 * Empty states: visitors who are not signed in get a sign-in CTA,
 * signed-in users without a hosted wallet yet get pointed at deposit,
 * which creates the hosted wallet on demand.
 */
export function WalletEmptyState({ signedIn }: WalletEmptyStateProps) {
  return (
    <div
      data-testid="wallet-empty-state"
      className="flex flex-col items-center gap-4 border-y border-white/10 px-6 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-aurora-violet/10"
      >
        <WalletIcon className="h-6 w-6 text-aurora-violet" />
      </span>
      {!signedIn ? (
        <>
          <h2 className="font-heading text-xl font-bold text-foreground">
            Sign in to view your wallet
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your USDC balance on Arc, recent activity, and deposit options live here.
          </p>
          <Link
            href="/login"
            data-testid="wallet-sign-in-cta"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-medium gradient-bg-extended text-white holo-glow"
          >
            Sign in
          </Link>
        </>
      ) : (
        <>
          <h2 className="font-heading text-xl font-bold text-foreground">
            No wallet yet
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your Deodes hosted wallet is created automatically when you make
            your first deposit.
          </p>
          <Link
            href="/wallet/deposit"
            data-testid="wallet-setup-cta"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-medium gradient-bg-extended text-white holo-glow"
          >
            Set up my wallet
          </Link>
        </>
      )}
    </div>
  )
}
