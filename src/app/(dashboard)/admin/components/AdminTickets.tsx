"use client"

import { useState } from "react"
import { Inbox, CheckCheck, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import {
  useAdminTickets,
  useAdminTicketAction,
  type SupportTicket,
} from "@/hooks/use-admin"

const PAGE_LIMIT = 20

export function AdminTickets({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<string>("open")
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const list = useAdminTickets({ status, page, limit: PAGE_LIMIT }, enabled)
  const action = useAdminTicketAction()

  const tickets = list.data?.tickets ?? []
  const total = list.data?.meta.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <section aria-label="Support inbox" className="border-t-2 border-foreground/80 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Support inbox</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {total.toLocaleString()} {status} · page {page} of {totalPages}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border p-1" role="tablist" aria-label="Ticket status filter">
          {(["open", "resolved"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={cn(
                "rounded-lg px-3 py-1.5 font-heading text-xs capitalize",
                status === s ? "bg-amber-400/15 text-amber-400" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading tickets">
          {[1, 2, 3].map((n) => <Skeleton key={n} variant="rectangular" className="h-14" />)}
        </div>
      ) : tickets.length === 0 ? (
        <p className="mt-6 flex items-center justify-center gap-2 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          <Inbox className="h-4 w-4" /> No {status} tickets.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-dashed divide-border">
          {tickets.map((t: SupportTicket) => (
            <li key={t.id} className="py-3 pl-3">
              <button
                type="button"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                aria-expanded={expanded === t.id}
                className="flex w-full flex-wrap items-center gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{t.email}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString()} · {t.id.slice(0, 8)}…
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider",
                    t.status === "open" ? "bg-amber-400/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400",
                  )}
                >
                  {t.status}
                </span>
              </button>
              {expanded === t.id && (
                <div className="mt-2 space-y-3 rounded-xl bg-white/[0.02] p-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{t.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {t.status === "open" ? (
                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: t.id, status: "resolved" })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:border-emerald-400 disabled:opacity-50"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Mark resolved
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: t.id, status: "open" })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-amber-400/60 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </button>
                    )}
                  </div>
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
