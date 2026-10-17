"use client"

import { useMemo, useState } from "react"
import { CircleAlert, CircleCheck, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatAddress, formatCurrency, formatFeePercent, isArcAddress, isArcTxnHash } from "@/lib/formatters"
import { getErrorMessage } from "@/lib/api-client"
import { useCirclePayouts, usePayoutPreview, useTriggerPayout } from "@/hooks/use-payouts"
import type { Circle, CircleMember, PayoutPreview } from "@/types"
import { displayNameOf } from "@/lib/profile/names"

interface CirclePayoutTriggerProps {
  circle: Circle
  members: CircleMember[]
  isOrganizer: boolean
}

/**
 * Organizer-only distribution trigger for the due round.
 *
 * Two steps: 1) preview the computed distribution (gross, 0.5% protocol fee,
 * net, Arc fee estimate), 2) paste the Arc distribution receipt (0x tx hash)
 * and distribute. Arc USDC only — non-USDC circles stay disabled.
 */
export function CirclePayoutTrigger({ circle, members, isOrganizer }: CirclePayoutTriggerProps) {
  const [recipientId, setRecipientId] = useState("")
  const [txnHash, setTxnHash] = useState("")
  const [preview, setPreview] = useState<PayoutPreview | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const previewMutation = usePayoutPreview(circle.id)
  const triggerMutation = useTriggerPayout(circle.id)

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  )
  // Full payout history for the rotation view (limit 100 = max members).
  // Shared cache key with the exit section, so both read one request.
  const { data: rotationData } = useCirclePayouts(
    circle.id,
    { limit: 100 },
    { enabled: isOrganizer && circle.status === "active" },
  )
  const isRandom = circle.payoutType === "random"
  // Undefined while loading (or when disabled): fall back to the full
  // member list so a display query never blocks distribution.
  const rotationPayouts = rotationData?.payouts
  const rotationPaidIds = useMemo(
    () => new Set((rotationPayouts ?? []).map((p) => p.recipientId)),
    [rotationPayouts],
  )
  const remainingMembers = useMemo(
    () => activeMembers.filter((m) => !rotationPaidIds.has(m.userId)),
    [activeMembers, rotationPaidIds],
  )
  const rotationKnown = isRandom && rotationPayouts !== undefined
  const rotationComplete =
    rotationKnown && activeMembers.length > 0 && remainingMembers.length === 0
  const recipientOptions = rotationKnown ? remainingMembers : activeMembers
  const poolEstimate = circle.contributionAmount * Math.max(activeMembers.length, 1)
  const dueRound = Math.max(circle.currentRound, 1)
  const isUsdc = circle.currency === "USDC"

  if (!isOrganizer || circle.status !== "active") return null

  if (!isUsdc) {
    return (
      <section aria-label="Distribute payout" className="border-l-4 border-l-amber-400 pl-4">
        <h3 className="font-heading text-base font-semibold text-foreground">Distribute payout</h3>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          Payouts settle in Arc USDC only — this circle uses an unsupported currency, so
          distribution is disabled.
        </p>
      </section>
    )
  }

  const handlePreview = async () => {
    setFormError(null)
    if (!recipientId) {
      setFormError("Choose the member receiving this round.")
      return
    }
    // Client-side mirror of the backend 409: random rotations never repeat.
    if (rotationKnown && rotationPaidIds.has(recipientId)) {
      setFormError("This member has already been paid in this rotation — pick a remaining member.")
      return
    }
    try {
      const result = await previewMutation.mutateAsync({ recipientId, roundNumber: dueRound })
      setPreview(result)
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  const handleTrigger = async () => {
    setFormError(null)
    if (!preview) {
      setFormError("Preview the distribution first.")
      return
    }
    const hash = txnHash.trim()
    if (!isArcTxnHash(hash)) {
      setFormError("Paste the Arc distribution receipt: 0x followed by 64 hex characters.")
      return
    }
    try {
      await triggerMutation.mutateAsync({
        recipientId: preview.recipients[0]?.recipientId ?? recipientId,
        roundNumber: preview.roundNumber,
        amount: preview.totalGrossAmount,
        feeAmount: preview.protocolFee,
        txnHash: hash,
        payoutType: circle.payoutType,
      })
      setPreview(null)
      setTxnHash("")
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  const busy = previewMutation.isPending || triggerMutation.isPending

  return (
    <section aria-label="Distribute payout" className="border-l-4 border-l-emerald-400 pl-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-base font-semibold text-foreground">Distribute payout</h3>
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 font-mono text-2xs font-semibold text-emerald-400">
          Round {dueRound} due
        </span>
        <span className="rounded-full border border-aurora-violet/40 px-2.5 py-0.5 font-mono text-2xs font-semibold text-aurora-violet">
          USDC · Arc
        </span>
      </div>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        Pool estimate {formatCurrency(poolEstimate, "USDC")} · {activeMembers.length} active member
        {activeMembers.length === 1 ? "" : "s"}
      </p>
      {rotationKnown && !rotationComplete && (
        <p className="mt-1 font-body text-xs text-muted-foreground" role="status">
          Rotation: {activeMembers.length - remainingMembers.length} of {activeMembers.length} paid ·{" "}
          {remainingMembers.length} remaining — each member is paid once before anyone is paid again.
        </p>
      )}
      {rotationComplete && (
        <p className="mt-1 font-body text-xs text-emerald-400" role="status">
          Rotation complete — every member has been paid. Withdrawals are now unlocked for members.
        </p>
      )}

      <ol className="mt-4 space-y-4">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-xs font-bold text-emerald-400">1</span>
          <div className="flex-1 space-y-2">
            <label className="block font-body text-xs font-medium text-muted-foreground" htmlFor="payout-recipient">
              Recipient (0x Arc wallet)
            </label>
            <select
              id="payout-recipient"
              value={recipientId}
              onChange={(e) => { setRecipientId(e.target.value); setPreview(null) }}
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 font-body text-sm text-foreground"
            >
              <option value="">Select member…</option>
              {recipientOptions.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {displayNameOf(m) ?? "Circle member"}
                  {m.userAddress && isArcAddress(m.userAddress) ? ` · ${formatAddress(m.userAddress)}` : " · no Arc wallet"}
                </option>
              ))}
              {rotationKnown &&
                activeMembers
                  .filter((m) => rotationPaidIds.has(m.userId))
                  .map((m) => (
                    <option key={m.userId} value={m.userId} disabled>
                      {displayNameOf(m) ?? "Circle member"} · already paid
                    </option>
                  ))}
            </select>
            <Button variant="outline" size="sm" onClick={handlePreview} isLoading={previewMutation.isPending} disabled={busy || rotationComplete}>
              Preview distribution
            </Button>
          </div>
        </li>

        {preview && (
          <li className="rounded-lg border border-emerald-400/30 px-4 py-3" data-testid="payout-preview">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-emerald-400" />
              <p className="font-heading text-sm font-semibold text-foreground">
                Round {preview.roundNumber} · {preview.isDue ? "due now" : "already distributed"}
              </p>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-body text-sm sm:grid-cols-4">
              <div><dt className="text-2xs uppercase tracking-widest text-muted-foreground">Gross</dt><dd className="font-mono font-semibold text-foreground">{formatCurrency(preview.totalGrossAmount, preview.currency)}</dd></div>
              <div><dt className="text-2xs uppercase tracking-widest text-muted-foreground">Fee ({formatFeePercent()})</dt><dd className="font-mono font-semibold text-foreground">{formatCurrency(preview.protocolFee, preview.currency)}</dd></div>
              <div><dt className="text-2xs uppercase tracking-widest text-muted-foreground">Net</dt><dd className="font-mono font-semibold text-emerald-400">{formatCurrency(preview.totalNetAmount, preview.currency)}</dd></div>
              <div><dt className="text-2xs uppercase tracking-widest text-muted-foreground">Arc fee est.</dt><dd className="font-mono font-semibold text-foreground">{formatCurrency(preview.arcFeeEstimate, "USDC")}</dd></div>
            </dl>
          </li>
        )}

        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-xs font-bold text-emerald-400">2</span>
          <div className="flex-1 space-y-2">
            <label className="block font-body text-xs font-medium text-muted-foreground" htmlFor="payout-txnhash">
              Arc distribution receipt
            </label>
            <input
              id="payout-txnhash"
              value={txnHash}
              onChange={(e) => setTxnHash(e.target.value)}
              placeholder="0x… (64 hex characters)"
              spellCheck={false}
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60"
            />
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Send className="h-4 w-4" />}
              onClick={handleTrigger}
              isLoading={triggerMutation.isPending}
              disabled={busy || !preview || !preview.isDue || rotationComplete}
            >
              Sign &amp; distribute
            </Button>
          </div>
        </li>
      </ol>

      {formError && (
        <p role="alert" className="mt-3 flex items-start gap-2 font-body text-sm text-red-400">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {formError}
        </p>
      )}
    </section>
  )
}
