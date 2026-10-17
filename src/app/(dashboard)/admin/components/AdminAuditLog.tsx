"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminAuditLog, type AdminAuditEntry } from "@/hooks/use-admin"

const PAGE_LIMIT = 20

function resourceOf(e: AdminAuditEntry): string {
  if (typeof e.resourceId === "string") return e.resourceId
  return e.resourceId?.String ?? ""
}

export function AdminAuditLog({ enabled }: { enabled: boolean }) {
  const [action, setAction] = useState("")
  const [resourceType, setResourceType] = useState("")
  const [page, setPage] = useState(1)
  const list = useAdminAuditLog({ action: action || undefined, resource_type: resourceType || undefined, page, limit: PAGE_LIMIT }, enabled)

  const entries = list.data?.entries ?? []
  const total = list.data?.meta.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <section aria-label="Audit log" className="border-t-2 border-foreground/80 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Audit log</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {total.toLocaleString()} entries · page {page} of {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
            placeholder="Filter action…"
            aria-label="Filter by action"
            className="w-36 border-b-2 border-amber-400/60 bg-transparent pb-1 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400 focus:outline-none"
          />
          <input
            type="text"
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); setPage(1) }}
            placeholder="Resource type…"
            aria-label="Filter by resource type"
            className="w-36 border-b-2 border-amber-400/60 bg-transparent pb-1 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-3 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" aria-hidden="true" />

      {list.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading audit log">
          {[1, 2, 3].map((n) => <Skeleton key={n} variant="rectangular" className="h-12" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-4 flex items-center justify-center gap-2 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          <ScrollText className="h-4 w-4" /> No audit entries.
        </p>
      ) : (
        <ol className="relative mt-4 space-y-4 border-l-2 border-border pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                  {e.action}
                </span>
                <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {e.resourceType}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                actor {e.actorId.slice(0, 8)}…{resourceOf(e) ? ` · ${resourceOf(e).slice(0, 12)}…` : ""}
              </p>
            </li>
          ))}
        </ol>
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
