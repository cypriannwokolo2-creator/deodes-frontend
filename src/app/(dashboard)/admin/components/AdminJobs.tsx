"use client"

import { RotateCcw, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminDeadLetterJobs, useAdminRetryJob, type DeadLetterJob } from "@/hooks/use-admin"

function queueOf(j: DeadLetterJob): string {
  return j.queue_name ?? j.queueName ?? "unknown"
}

function errorOf(j: DeadLetterJob): string {
  if (typeof j.last_error === "string") return j.last_error
  return j.last_error?.String ?? ""
}

function timeOf(j: DeadLetterJob): string {
  const raw = j.created_at ?? j.createdAt ?? j.updated_at ?? ""
  if (!raw) return "—"
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString()
}

export function AdminJobs({ enabled }: { enabled: boolean }) {
  const list = useAdminDeadLetterJobs(enabled)
  const retry = useAdminRetryJob()

  const jobs = list.data ?? []

  return (
    <section aria-label="Dead-letter jobs" className="border-t-2 border-foreground/80 pt-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">Dead-letter jobs</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {jobs.length} failed · retry returns a job to pending
        </p>
      </div>

      {list.isLoading ? (
        <div className="mt-4 columns-1 gap-3 space-y-3 sm:columns-2" aria-label="Loading dead-letter jobs">
          {[1, 2].map((n) => <Skeleton key={n} variant="rectangular" className="h-24" />)}
        </div>
      ) : jobs.length === 0 ? (
        <p className="mt-4 border border-dotted border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Queue is clean — no dead-letter jobs.
        </p>
      ) : (
        <ul className="mt-4 columns-1 gap-3 space-y-3 sm:columns-2">
          {jobs.map((j) => (
            <li key={j.id} className="relative break-inside-avoid border border-border p-4">
              <span className="absolute left-0 top-0 h-full w-1 bg-red-400/70" aria-hidden="true" />
              <div className="flex items-start gap-2 pl-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-foreground">{j.id.slice(0, 12)}…</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {queueOf(j)} · {timeOf(j)}
                  </p>
                  {errorOf(j) ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{errorOf(j)}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 border-t border-dotted border-border pl-2 pt-3">
                <button
                  type="button"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate({ jobId: j.id })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-amber-400/60 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
