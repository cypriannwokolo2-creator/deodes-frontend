"use client"

import { useState } from "react"
import { LockKeyhole, LockOpen, Snowflake } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAddress } from "@/lib/formatters"
import {
  useAdminFrozenWallets,
  useAdminFreezeAction,
  type FrozenWallet,
} from "@/hooks/use-admin"

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function AdminFrozen({ enabled }: { enabled: boolean }) {
  const [userId, setUserId] = useState("")
  const [reason, setReason] = useState("")
  const [confirming, setConfirming] = useState(false)
  const list = useAdminFrozenWallets(enabled)
  const action = useAdminFreezeAction()

  const wallets = list.data ?? []

  const freeze = () => {
    const id = userId.trim()
    if (!UUID_RE.test(id)) return
    action.mutate(
      { userId: id, freeze: true, reason: reason.trim() === "" ? undefined : reason.trim() },
      {
        onSuccess: () => {
          setConfirming(false)
          setUserId("")
          setReason("")
        },
      },
    )
  }

  return (
    <section aria-label="Frozen funds" className="border-t-2 border-foreground/80 pt-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">Frozen funds</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {wallets.length} frozen · freezing stops outbound sends only — deposits still land
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border p-4">
        <p className="text-sm font-medium text-foreground">Freeze an account</p>
        {!confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID (UUID)…"
              spellCheck={false}
              aria-label="User ID to freeze"
              className="min-w-52 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400/60"
            />
            <button
              type="button"
              disabled={!UUID_RE.test(userId.trim())}
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-300 hover:border-red-400 disabled:opacity-40"
            >
              <Snowflake className="h-3.5 w-3.5" /> Freeze…
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (audited, optional)…"
              maxLength={200}
              aria-label="Freeze reason"
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400/60"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={action.isPending}
                onClick={freeze}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
              >
                <LockKeyhole className="h-3.5 w-3.5" /> {action.isPending ? "Freezing…" : "Confirm freeze"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {list.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading frozen wallets">
          {[1, 2].map((n) => <Skeleton key={n} variant="rectangular" className="h-14" />)}
        </div>
      ) : wallets.length === 0 ? (
        <p className="mt-4 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No frozen wallets.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-dashed divide-border">
          {wallets.map((w: FrozenWallet) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 py-3 pl-3">
              <Snowflake className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-foreground">{formatAddress(w.publicKey)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {w.frozenReason ? `${w.frozenReason} · ` : ""}{w.userId.slice(0, 8)}…
                </p>
              </div>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => action.mutate({ userId: w.userId, freeze: false })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-amber-400/60 disabled:opacity-50"
              >
                <LockOpen className="h-3.5 w-3.5" /> Unfreeze
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
