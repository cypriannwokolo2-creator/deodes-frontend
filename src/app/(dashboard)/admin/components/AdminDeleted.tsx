"use client"

import { useState } from "react"
import { Search, ChevronLeft, ChevronRight, Undo2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAddress } from "@/lib/formatters"
import {
  useAdminDeletedUsers,
  useAdminRestoreUser,
  type AdminUser,
} from "@/hooks/use-admin"

const PAGE_LIMIT = 20

export function AdminDeleted({ enabled }: { enabled: boolean }) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const list = useAdminDeletedUsers({ search, page, limit: PAGE_LIMIT }, enabled)
  const restore = useAdminRestoreUser()

  const users = list.data?.users ?? []
  const total = list.data?.meta.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <section aria-label="Deleted users" className="border-t-2 border-foreground/80 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Deleted users</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {total.toLocaleString()} soft-deleted · restore returns them to the active set
          </p>
        </div>
        <label className="flex items-center gap-2 border-b-2 border-red-400/60 pb-1 focus-within:border-red-400">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search deleted users</span>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search wallet or email…"
            className="w-52 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-3 bg-red-500/10 px-4 py-2" aria-hidden="true">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-400">
          01 find → 02 verify → 03 restore — every restore is written to the audit log
        </p>
      </div>

      {list.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading deleted users">
          {[1, 2, 3].map((n) => <Skeleton key={n} variant="rectangular" className="h-14" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="mt-4 border border-dotted border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No deleted users.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-dashed divide-border">
          {users.map((u: AdminUser) => (
            <li key={u.id} className="flex items-center gap-3 border-l-4 border-l-red-400/60 py-3 pl-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 font-mono text-xs font-bold text-red-300">
                {(u.displayName?.charAt(0) ?? u.walletAddress.slice(0, 2)).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {u.displayName ?? formatAddress(u.walletAddress)}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {formatAddress(u.walletAddress)} · {u.id.slice(0, 8)}…
                </p>
              </div>
              <button
                type="button"
                disabled={restore.isPending}
                onClick={() => restore.mutate({ userId: u.id })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:border-emerald-400 disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" /> Restore
              </button>
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
