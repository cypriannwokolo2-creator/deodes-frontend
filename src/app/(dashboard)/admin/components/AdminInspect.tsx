"use client"

import { useState } from "react"
import { ScanSearch, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminCircleInspect } from "@/hooks/use-admin"

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function AdminInspect({ enabled }: { enabled: boolean }) {
  const [input, setInput] = useState("")
  const [target, setTarget] = useState<string | null>(null)
  const detail = useAdminCircleInspect(target, enabled && target !== null)

  const d = detail.data
  const members = (d?.members as unknown as { userId?: string; user_id?: string; status?: string; role?: string }[] | undefined) ?? []

  return (
    <section aria-label="Circle inspection" className="border-t-2 border-foreground/80 pt-4">
      <div className="h-1 w-24 bg-gradient-to-r from-aurora-violet via-amber-400 to-emerald-400" aria-hidden="true" />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Circle inspect</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Read-only · every lookup is audited server-side
          </p>
        </div>
        <div className="flex items-center gap-2 border-l-4 border-l-aurora-violet pl-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Circle ID (UUID)…"
            spellCheck={false}
            aria-label="Circle ID to inspect"
            className="w-56 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <button
            type="button"
            disabled={!UUID_RE.test(input.trim())}
            onClick={() => setTarget(input.trim())}
            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 font-heading text-xs text-foreground hover:border-amber-400/60 disabled:opacity-40"
          >
            <ScanSearch className="h-3.5 w-3.5" /> Inspect
          </button>
        </div>
      </div>

      {target === null ? (
        <p className="mt-4 border border-dotted border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Paste a circle ID above to inspect its state.
        </p>
      ) : detail.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading inspection">
          {[1, 2].map((n) => <Skeleton key={n} variant="rectangular" className="h-16" />)}
        </div>
      ) : detail.isError || !d ? (
        <div className="mt-4 flex items-center justify-between gap-3 border border-red-500/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Circle not found or failed to load.</p>
          <button type="button" onClick={() => setTarget(null)} aria-label="Clear inspection" className="p-1.5 text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="border-l-4 border-l-emerald-400 pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Circle</p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground">
              {(d.circle.name as string | undefined) ?? d.circle.id}
            </p>
            <p className="font-mono text-6xl font-black tabular-nums text-foreground">
              {d.memberCount}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              members · round {String(d.currentRound ?? (d.circle.currentRound as number | undefined) ?? "—")} · {d.status}
            </p>
          </div>
          <div className="border-l-4 border-l-amber-400 pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Members</p>
            {members.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No members returned.</p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {members.slice(0, 30).map((m, i) => (
                  <li key={`${m.userId ?? m.user_id ?? i}`} className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="truncate text-foreground">{String(m.userId ?? m.user_id ?? `member-${i}`).slice(0, 12)}…</span>
                    <span className="text-muted-foreground">{m.status ?? m.role ?? ""}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setTarget(null)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
