"use client"

import { useState } from "react"
import { Flag, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import { useAdminFeatureFlags, useAdminFlagAction } from "@/hooks/use-admin"

export function AdminFlags({ enabled }: { enabled: boolean }) {
  const [tab, setTab] = useState<"all" | "enabled" | "disabled">("all")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const list = useAdminFeatureFlags(enabled)
  const { set, remove } = useAdminFlagAction()

  const all = list.data ?? []
  const flags = all.filter((f) => (tab === "all" ? true : tab === "enabled" ? f.enabled : !f.enabled))

  const save = (flag: string, value: boolean) => {
    set.mutate({ flag, value, description: description.trim() || undefined })
  }

  return (
    <section aria-label="Feature flags" className="relative overflow-hidden border-t-2 border-foreground/80 pt-4">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-aurora-violet/10" aria-hidden="true" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Feature flags</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {all.length} flags · changes apply immediately, audited server-side
          </p>
        </div>
        <div className="flex gap-1 border-b-2 border-border" role="tablist" aria-label="Flag state filter">
          {(["all", "enabled", "disabled"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 font-heading text-xs capitalize",
                tab === t ? "border-b-2 border-amber-400 text-amber-400" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New flag name…"
          aria-label="New flag name"
          className="min-w-40 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 focus:outline-none"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)…"
          aria-label="Flag description"
          maxLength={200}
          className="min-w-40 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={name.trim() === "" || set.isPending}
          onClick={() => { save(name.trim(), true); setName(""); setDescription("") }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-300 hover:border-emerald-400 disabled:opacity-40"
        >
          <Flag className="h-3.5 w-3.5" /> Create on
        </button>
      </div>

      {list.isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Loading flags">
          {[1, 2, 3].map((n) => <Skeleton key={n} variant="rectangular" className="h-12" />)}
        </div>
      ) : flags.length === 0 ? (
        <p className="mt-4 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No flags in this view.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-dotted divide-border">
          {flags.map((f) => (
            <li key={f.flag} className="flex flex-wrap items-center gap-3 py-3 pl-1">
              <button
                type="button"
                role="switch"
                aria-checked={f.enabled}
                aria-label={`Toggle ${f.flag}`}
                onClick={() => save(f.flag, !f.enabled)}
                disabled={set.isPending}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  f.enabled ? "bg-emerald-500/70" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                    f.enabled ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-foreground">{f.flag}</p>
                {f.description ? <p className="truncate text-xs text-muted-foreground">{f.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => remove.mutate({ flag: f.flag })}
                disabled={remove.isPending}
                aria-label={`Delete ${f.flag}`}
                className="rounded-lg p-2 text-muted-foreground hover:text-red-400 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
