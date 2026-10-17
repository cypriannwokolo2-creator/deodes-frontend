"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CircleAlert, ArrowRight, AtSign, Wallet } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUIStore } from "@/stores/ui-store"
import { get, post, getErrorMessage } from "@/lib/api-client"
import { formatAddress } from "@/lib/formatters"
import { TransferConfirmation } from "./components/TransferConfirmation"

type Tab = "internal" | "external"

const ARC_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

interface LookupResult {
  displayName: string
  emailVerified: boolean
}

function WalletTransferContent() {
  const searchParams = useSearchParams()
  const initialRecipient = searchParams.get("recipient") || searchParams.get("address") || ""

  const addToast = useUIStore((s) => s.addToast)

  const [tab, setTab] = useState<Tab>(() =>
    initialRecipient && !ARC_ADDRESS_RE.test(initialRecipient.trim()) ? "internal" : "external",
  )
  const [recipient, setRecipient] = useState(initialRecipient)
  const [amount, setAmount] = useState("")
  const currency = "USDC" as const
  const [memo, setMemo] = useState("")
  const [step, setStep] = useState<"form" | "confirm" | "success">("form")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txnHash, setTxnHash] = useState<string | null>(null)
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  // Idempotency key for the intent under review. Minted on review, reused
  // across Confirm retries, replaced on the next review.
  const idempotencyKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    get<{ balance?: { usdc?: number } } | { usdc?: number }>("/wallets/balance")
      .then((res) => {
        if (cancelled) return
        const bal =
          (res as { balance?: { usdc?: number } })?.balance?.usdc ??
          (res as { usdc?: number })?.usdc ??
          null
        if (typeof bal === "number") setBalance(bal)
      })
      .catch(() => {})
    get<{ remainingUsd?: number; data?: { remainingUsd?: number } }>("/wallets/allowance")
      .then((res) => {
        if (cancelled) return
        const remaining =
          (res as { remainingUsd?: number })?.remainingUsd ??
          (res as { data?: { remainingUsd?: number } })?.data?.remainingUsd ??
          null
        if (typeof remaining === "number") setDailyRemaining(remaining)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const maxAvailable = Math.min(
    balance ?? Number.POSITIVE_INFINITY,
    dailyRemaining ?? Number.POSITIVE_INFINITY,
  )
  const hasCap = Number.isFinite(maxAvailable)

  function newIdempotencyKey(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResolvedName(null)
    const to = recipient.trim()

    if (tab === "external") {
      if (!ARC_ADDRESS_RE.test(to)) {
        setError("Enter a valid Arc address (0x + 40 hex characters).")
        return
      }
    } else {
      if (!isEmail(to) && !ARC_ADDRESS_RE.test(to)) {
        setError("Enter a Deodes user email or an Arc address.")
        return
      }
      if (isEmail(to)) {
        setIsResolving(true)
        try {
          const res = await get<{ user?: LookupResult } | LookupResult>(
            `/users/lookup?email=${encodeURIComponent(to)}`,
          )
          const user = (res as { user?: LookupResult })?.user ?? (res as LookupResult)
          setResolvedName(user?.displayName || to)
        } catch (err: unknown) {
          setError(getErrorMessage(err))
          setIsResolving(false)
          return
        }
        setIsResolving(false)
      }
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid transfer amount greater than 0.")
      return
    }
    if (hasCap && numAmount > maxAvailable) {
      setError(`Amount exceeds your available limit of ${maxAvailable} ${currency}.`)
      return
    }
    // Mint the idempotency key once per review: every Confirm click for this
    // exact intent replays the same key, so a retry after an ambiguous
    // timeout/network error can never execute a second on-chain transfer.
    // A fresh review (edited recipient/amount) mints a fresh key.
    idempotencyKeyRef.current = newIdempotencyKey()
    setStep("confirm")
  }

  const handleConfirm = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const key =
        idempotencyKeyRef.current ?? (idempotencyKeyRef.current = newIdempotencyKey())
      const res = await post<{ txHash?: string; data?: { txHash?: string } }>(
        "/wallets/transfer",
        { to: recipient.trim(), amount: parseFloat(amount), memo: memo.trim() || undefined },
        { headers: { "Idempotency-Key": key } },
      )
      const txHash = res.txHash ?? res.data?.txHash
      if (!txHash) throw new Error("Transfer failed. Please try again.")
      setTxnHash(txHash)
      setStep("success")
      addToast({ type: "success", title: "Transfer completed successfully" })
    } catch (err: unknown) {
      // Stay on the confirm step: the error renders inline and a retry
      // reuses the same idempotency key (see above). Only an explicit Back
      // + Review starts a new intent with a fresh key.
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const recipientLabel = tab === "internal" ? "Email or Arc address" : "Recipient Address"

  return (
    <div data-testid="wallet-transfer-page" className="max-w-2xl mx-auto space-y-8 pb-12">
      <PageHeader
        title="Transfer Assets"
        description="Send USDC to Deodes members or any Arc wallet."
        action={
          <ButtonLink href="/wallet" variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Wallet
          </ButtonLink>
        }
      />

      {/* Internal / External tabs */}
      <div role="tablist" aria-label="Transfer type" className="flex gap-2">
        {(
          [
            { id: "internal", label: "Deodes user", icon: AtSign },
            { id: "external", label: "External wallet", icon: Wallet },
          ] as { id: Tab; label: string; icon: typeof AtSign }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setError(null)
              setStep("form")
            }}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              tab === id
                ? "bg-aurora-violet/20 text-aurora-violet border border-aurora-violet/40"
                : "border border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
          <CircleAlert className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {step === "form" && (
        <form onSubmit={handleReview} className="glass-card p-6 md:p-8 rounded-3xl space-y-6">
          <div>
            <label htmlFor="recipient-address" className="block text-sm font-medium mb-2">{recipientLabel}</label>
            <Input
              id="recipient-address"
              aria-label={tab === "internal" ? "Recipient email or Arc address" : "Recipient Arc address"}
              data-testid="recipient-input"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={tab === "internal" ? "ada@example.com or 0x…" : "0x… (Arc address)"}
            />
            {tab === "internal" && (
              <p className="text-xs text-muted-foreground mt-2">
                Email sends to a Deodes member&apos;s wallet; a 0x address sends on-chain.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="transfer-amount" className="block text-sm font-medium mb-2">Amount</label>
            <div className="flex gap-3">
              <Input
                id="transfer-amount"
                aria-label="Transfer amount"
                data-testid="amount-input"
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <span
                aria-label="Transfer currency: USDC"
                className="bg-background border border-border rounded-xl px-4 py-2 font-medium text-foreground inline-flex items-center"
              >
                USDC
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Available: {balance === null ? "…" : `${balance} ${currency}`}
              {dailyRemaining !== null && ` · Daily send room: ${dailyRemaining} ${currency}`}
            </p>
          </div>

          <div>
            <label htmlFor="payment-memo" className="block text-sm font-medium mb-2">Memo (Optional)</label>
            <Input
              id="payment-memo"
              aria-label="Payment memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Payment memo or reference"
            />
          </div>

          <Button
            data-testid="review-transfer-button"
            type="submit"
            className="w-full"
            size="lg"
            disabled={isResolving}
          >
            {isResolving ? "Finding member…" : "Review Transfer"} {!isResolving && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </form>
      )}

      {step === "confirm" && (
        <div data-testid="confirm-transfer-step" className="glass-card p-6 md:p-8 rounded-3xl space-y-6">
          <h3 className="text-xl font-heading font-semibold text-foreground">Confirm Transfer</h3>
          <div className="space-y-3 bg-card/50 p-4 rounded-2xl border border-border/50 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Recipient</span>
              <span className="font-mono font-medium text-right break-all">
                {resolvedName ?? formatAddress(recipient)}
              </span>
            </div>
            {resolvedName && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Destination</span>
                <span className="font-mono text-xs text-muted-foreground text-right break-all">{recipient.trim()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{amount} {currency}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              className="w-1/2"
            >
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-1/2"
            >
              {isSubmitting ? "Sending..." : "Confirm & Send"}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && txnHash && (
        <div
          data-testid="transfer-success-step"
          className="overflow-hidden rounded-3xl border border-border/50 bg-card"
        >
          <TransferConfirmation
            txnHash={txnHash}
            amount={amount}
            currency={currency}
            recipient={resolvedName ?? recipient}
            networkFee={0}
          />
        </div>
      )}
    </div>
  )
}

export default function WalletTransferPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading transfer...</div>}>
      <WalletTransferContent />
    </Suspense>
  )
}
