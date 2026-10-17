"use client"

import { XCircle, Snowflake, LockOpen } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAddress } from "@/lib/formatters"
import { cn } from "@/lib/cn"
import {
  useAdminUserDetail,
  useAdminFreezeAction,
  type AdminUserDetail as Detail,
} from "@/hooks/use-admin"
import { AdminUserActivity } from "./AdminUserActivity"
import { AdminUserProfile } from "./AdminUserProfile"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
      <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

export function AdminUserDetail({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const detail = useAdminUserDetail(userId, userId !== null)
  const freeze = useAdminFreezeAction()
  const d = detail.data as Detail | null

  if (userId === null) return null

  return (
    <section aria-label="User detail" className="rounded-xl border border-amber-400/40 bg-amber-400/5 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-foreground">User detail</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close user detail"
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>

      {detail.isLoading ? (
        <div className="mt-3 space-y-2" aria-label="Loading user detail">
          {[1, 2, 3].map((n) => <Skeleton key={n} variant="rectangular" className="h-10" />)}
        </div>
      ) : detail.isError || !d ? (
        <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t load this user.</p>
      ) : (
        <div className="mt-2 divide-y divide-dashed divide-border">
          <AdminUserProfile user={d.user} />
          <Row label="Wallets">
            {(d.wallets ?? []).length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <ul className="space-y-1">
                {(d.wallets ?? []).map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="text-foreground">{formatAddress(w.publicKey)}</span>
                    <span className="text-muted-foreground">{w.walletType}</span>
                    {w.isFrozen && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 font-bold uppercase tracking-wider text-sky-300">
                        <Snowflake className="h-3 w-3" /> frozen{w.frozenReason ? ` · ${w.frozenReason}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <Row label="Circles">
            {(d.circles ?? []).length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <ul className="space-y-1">
                {(d.circles ?? []).map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="text-foreground">{c.name ?? c.id.slice(0, 8)}</span>{" "}
                    <span className={cn("font-mono text-xs", c.status === "active" ? "text-emerald-400" : c.status === "paused" || c.status === "banned" ? "text-red-400" : "text-muted-foreground")}>
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <Row label="Communities">
            {(d.communities ?? []).length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <ul className="space-y-1">
                {(d.communities ?? []).map((c) => (
                  <li key={c.id} className="text-sm text-foreground">
                    {c.name ?? c.slug ?? c.id.slice(0, 8)}
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <Row label="Recent sends">
            {(d.recentSends ?? []).length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <ul className="space-y-1">
                {(d.recentSends ?? []).map((s, i) => (
                  <li key={`${s.txHash ?? "nohash"}-${i}`} className="font-mono text-xs">
                    <span className={s.status === "completed" ? "text-emerald-400" : "text-red-400"}>{s.status}</span>{" "}
                    <span className="text-foreground">{s.amount} {s.asset}</span>{" "}
                    <span className="text-muted-foreground">→ {formatAddress(s.destination)}</span>
                    {s.failureReason ? <span className="text-red-400"> · {s.failureReason}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <div className="flex flex-wrap gap-2 pt-3">
            <button
              type="button"
              disabled={freeze.isPending}
              onClick={() => freeze.mutate({ userId, freeze: true, reason: "admin review" })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-400 disabled:opacity-50"
            >
              <Snowflake className="h-3.5 w-3.5" /> Freeze funds
            </button>
            <button
              type="button"
              disabled={freeze.isPending}
              onClick={() => freeze.mutate({ userId, freeze: false })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-amber-400/60 disabled:opacity-50"
            >
              <LockOpen className="h-3.5 w-3.5" /> Unfreeze
            </button>
          </div>
          <AdminUserActivity userId={userId} enabled />
        </div>
      )}
    </section>
  )
}
