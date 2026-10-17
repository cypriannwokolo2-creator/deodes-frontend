"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { useTranslate } from "@/lib/locale/context"
import { useAuthStore } from "@/stores/auth-store"
import { useUIStore } from "@/stores/ui-store"
import { useWalletOverview } from "./hooks/useWalletOverview"
import { PortfolioHero } from "./components/PortfolioHero"
import { CustodyBadge } from "./components/CustodyBadge"
import { WalletActions } from "./components/WalletActions"
import { ReceiveModal } from "./components/ReceiveModal"
import { ActivityList } from "./components/ActivityList"
import { WalletEmptyState } from "./components/WalletEmptyState"

/**
 * Wallet — standard fintech layout.
 *
 * One wallet per account: the hosted Deodes wallet. External wallets can
 * no longer be connected, so every address shown here is the hosted one —
 * the same address deposits land on and sends leave from.
 *
 * Section order: header → custody badge → portfolio hero (total + single
 * USDC-on-Arc row) → Send/Receive/Deposit/Withdraw actions → recent
 * activity. No XLM is rendered anywhere.
 */
export default function WalletPage() {
  const { locale } = useTranslate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const authLoading = useAuthStore((s) => s.isLoading)
  const addToast = useUIStore((s) => s.addToast)
  const {
    balance,
    transactions,
    hostedWallet,
    loading,
  } = useWalletOverview()
  const [showReceive, setShowReceive] = useState(false)

  const hostedAddress = hostedWallet?.publicKey ?? null
  const hasWallet = Boolean(hostedAddress)
  const receiveAddress = hostedAddress

  const handleCopied = () => addToast({ type: "info", title: "Address copied" })
  const handleCopyError = () =>
    addToast({
      type: "error",
      title: "Clipboard unavailable",
      description: "Select the address and copy it manually.",
    })

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
      <PageHeader title="Wallet" description="Your USDC on Arc, in one place." />

      {authLoading || (isAuthenticated && loading && !hasWallet) ? (
        <div className="space-y-4" aria-label="Loading wallet">
          <div className="h-6 w-44 animate-pulse rounded-full bg-white/10" />
          <div className="h-44 animate-pulse rounded-xl bg-white/5" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      ) : !isAuthenticated ? (
        <WalletEmptyState signedIn={false} />
      ) : !hasWallet ? (
        <WalletEmptyState signedIn />
      ) : (
        <>
          <CustodyBadge
            hostedAddress={hostedAddress}
            loading={loading}
            onCopied={handleCopied}
            onCopyError={handleCopyError}
          />
          <PortfolioHero usdc={balance?.usdc} loading={loading} locale={locale} />
          <WalletActions onReceive={() => setShowReceive(true)} />
          <div
            aria-hidden="true"
            className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />
          <ActivityList transactions={transactions} loading={loading} locale={locale} />
        </>
      )}

      <ReceiveModal
        address={receiveAddress}
        open={showReceive}
        onClose={() => setShowReceive(false)}
      />
    </div>
  )
}
