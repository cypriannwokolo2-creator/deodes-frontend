"use client"

import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAddress } from "@/lib/formatters"
import { cn } from "@/lib/cn"
import type { AdminUser } from "@/hooks/use-admin"

interface AdminUsersProps {
  users: AdminUser[]
  total: number
  loading: boolean
  search: string
  onSearch: (value: string) => void
  page: number
  onPage: (page: number) => void
  limit: number
  selectedId?: string | null
  onSelect?: (id: string) => void
}

function RolePill({ role }: { role: string | undefined }) {
  const isAdmin = role === "admin"
  return (
    <span
      className={
        isAdmin
          ? "rounded-full bg-amber-400/15 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400"
          : "rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
      }
    >
      {role || "user"}
    </span>
  )
}

export function AdminUsers({ users, total, loading, search, onSearch, page, onPage, limit, selectedId, onSelect }: AdminUsersProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <section aria-label="User directory" className="border-t-2 border-foreground/80 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Users</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {total.toLocaleString()} total · page {page} of {totalPages}
          </p>
        </div>
        <label className="flex items-center gap-2 border-b-2 border-amber-400/60 pb-1 focus-within:border-amber-400">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search users by wallet or email</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search wallet or email…"
            className="w-52 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </label>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-label="Loading users">
          {[1, 2, 3, 4, 5].map((n) => <Skeleton key={n} variant="rectangular" className="h-14" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="mt-6 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {search ? `No users match "${search}".` : "No users yet."}
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-dashed divide-border">
            {users.map((u) => (
              <li key={u.id}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(u.id)}
                    aria-expanded={selectedId === u.id}
                    aria-label={`Inspect ${u.displayName ?? u.walletAddress}`}
                    className={cn(
                      "flex w-full items-center gap-3 border-l-2 py-3 pl-3 text-left transition-colors hover:border-l-amber-400 hover:bg-white/[0.02]",
                      selectedId === u.id ? "border-l-amber-400 bg-amber-400/5" : "border-l-transparent",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 font-mono text-xs font-bold text-foreground">
                      {(u.displayName?.charAt(0) ?? u.walletAddress.slice(0, 2)).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.displayName ?? formatAddress(u.walletAddress)}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {formatAddress(u.walletAddress)}
                        {u.moiScore !== undefined ? ` · DeoScore ${u.moiScore}` : ""}
                      </p>
                    </div>
                    <RolePill role={u.role} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 border-l-2 border-l-transparent py-3 pl-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 font-mono text-xs font-bold text-foreground">
                      {(u.displayName?.charAt(0) ?? u.walletAddress.slice(0, 2)).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.displayName ?? formatAddress(u.walletAddress)}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {formatAddress(u.walletAddress)}
                        {u.moiScore !== undefined ? ` · DeoScore ${u.moiScore}` : ""}
                      </p>
                    </div>
                    <RolePill role={u.role} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className="inline-flex items-center gap-1 border border-border px-3 py-1.5 font-heading text-xs text-foreground disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
              className="inline-flex items-center gap-1 border border-border px-3 py-1.5 font-heading text-xs text-foreground disabled:opacity-40"
              aria-label="Next page"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </section>
  )
}
