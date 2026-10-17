"use client"

import { useState } from "react"
import { Pause, Play, Ban, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import {
  useAdminCircles,
  useAdminCircleAction,
  type AdminCircle,
} from "@/hooks/use-admin"

const PAGE_LIMIT = 20

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "paused"
        ? "bg-amber-400/15 text-amber-400"
        : status === "banned"
          ? "bg-red-500/15 text-red-400"
          : "border border-border text-muted-foreground"
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider", styles)}>
      {status}
    </span>
  )
}

export function AdminCircles({ enabled }: { enabled: boolean }) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [confirming, setConfirming] = useState<{ id: string; action: "pause" | "resume" | "ban"; reason: string } | null>(null)
  const list = useAdminCircles({ search, page, limit: PAGE_LIMIT }, enabled)
  const action = useAdminCircleAction()

  const circles = list.data?.circles ?? []
  const total = list.data?.meta.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  const fire = (id: string, act: "pause" | "resume" | "ban", reason: string) => {
    action.mutate(
      { id, action: act, reason: reason.trim() === "" ? undefined : reason.trim() },
      { onSuccess: () => setConfirming(null) },
    )
  }

  return (
    <section aria-label="Circle moderation" className="border-t-2 border-foreground/80 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Circles</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {total.toLocaleString()} total · page {page} of {totalPages} · pausing halts activity, banning is terminal
          </p>
        </div>
        <label className="flex items-center gap-2 border-b-2 border-amber-400/60 pb-1 focus-within:border-amber-400">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search circles</span>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search circles…"
            className="w-52 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </label>
      </div>

      {list.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading circles">
          {[1, 2, 3].map((n) => <Skeleton key={n} variant="rectangular" className="h-14" />)}
        </div>
      ) : circles.length === 0 ? (
        <p className="mt-6 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No circles found.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-dashed divide-border">
          {circles.map((c: AdminCircle) => (
            <li key={c.id} className="space-y-2 py-3 pl-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.name ?? c.id}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {typeof c.memberCount === "number" ? `${c.memberCount} members · ` : ""}{c.id.slice(0, 8)}…
                  </p>
                </div>
                <StatusPill status={c.status} />
                {c.status === "active" && (
                  <>
                    <ActionButton title="Pause circle" onClick={() => setConfirming({ id: c.id, action: "pause", reason: "" })}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </ActionButton>
                    <DangerButton title="Ban circle (terminal)" onClick={() => setConfirming({ id: c.id, action: "ban", reason: "" })}>
                      <Ban className="h-3.5 w-3.5" /> Ban
                    </DangerButton>
                  </>
                )}
                {c.status === "paused" && (
                  <>
                    <ActionButton title="Resume circle" onClick={() => fire(c.id, "resume", "")}>
                      <Play className="h-3.5 w-3.5" /> Resume
                    </ActionButton>
                    <DangerButton title="Ban circle (terminal)" onClick={() => setConfirming({ id: c.id, action: "ban", reason: "" })}>
                      <Ban className="h-3.5 w-3.5" /> Ban
                    </DangerButton>
                  </>
                )}
              </div>
              {confirming?.id === c.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {confirming.action === "ban" ? "Ban permanently — reason (optional):" : "Pause — reason (optional):"}
                  </span>
                  <input
                    type="text"
                    value={confirming.reason}
                    onChange={(e) => setConfirming({ ...confirming, reason: e.target.value })}
                    placeholder="Reason for the audit trail…"
                    maxLength={200}
                    className="min-w-40 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={action.isPending}
                    onClick={() => fire(c.id, confirming.action, confirming.reason)}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {action.isPending ? "Working…" : `Confirm ${confirming.action}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label="Previous page"
          className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Next page"
          className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}

function ActionButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-amber-400/60"
    >
      {children}
    </button>
  )
}

function DangerButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-400"
    >
      {children}
    </button>
  )
}
