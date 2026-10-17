"use client"

import { History } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminAuditLog } from "@/hooks/use-admin"

/** Operator-visible activity for one user: audit entries where they acted.
 * Timeline styling mirrors AdminAuditLog at compact density; the resource
 * column is omitted here because the actor is fixed. */
export function AdminUserActivity({ userId, enabled }: { userId: string | null; enabled: boolean }) {
  const log = useAdminAuditLog({ actor_id: userId ?? undefined, page: 1, limit: 10 }, enabled && userId !== null)

  if (userId === null) return null

  const entries = log.data?.entries ?? []
  const total = log.data?.meta.total ?? 0

  return (
    <section aria-label="User activity" className="mt-4 border-t border-dotted border-border pt-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-heading text-sm font-bold text-foreground">
          Activity{total > 0 ? ` (${total.toLocaleString()})` : ""}
        </h3>
      </div>

      {log.isLoading ? (
        <div className="mt-3 space-y-2" aria-label="Loading user activity">
          {[1, 2].map((n) => <Skeleton key={n} variant="rectangular" className="h-10" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No audited actions by this account yet.</p>
      ) : (
        <ol className="relative mt-3 space-y-3 border-l-2 border-border pl-4">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[22px] top-1 h-2 w-2 rounded-full bg-aurora-violet" aria-hidden="true" />
              <p className="font-mono text-xs text-foreground">{e.action}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {e.resourceType} · {new Date(e.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
