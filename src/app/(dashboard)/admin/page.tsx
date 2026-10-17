"use client"

import { useState } from "react"
import Link from "next/link"
import { LockKeyhole, RotateCcw, TriangleAlert } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { isAdminRole, useAdminMetrics, useAdminUsers } from "@/hooks/use-admin"
import { Routes } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminStats } from "./components/AdminStats"
import { AdminUsers } from "./components/AdminUsers"
import { AdminUserDetail } from "./components/AdminUserDetail"
import { AdminCircles } from "./components/AdminCircles"
import { AdminCommunities } from "./components/AdminCommunities"
import { AdminFrozen } from "./components/AdminFrozen"
import { AdminTickets } from "./components/AdminTickets"
import { AdminDeleted } from "./components/AdminDeleted"
import { AdminInspect } from "./components/AdminInspect"
import { AdminAuditLog } from "./components/AdminAuditLog"
import { AdminFlags } from "./components/AdminFlags"
import { AdminJobs } from "./components/AdminJobs"

const PAGE_LIMIT = 20

function AccessDeniedPanel() {
  return (
    <section aria-label="Access denied" className="relative overflow-hidden border border-red-500/25 bg-card px-6 py-12 sm:px-10">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-red-500/10" aria-hidden="true" />
      <div className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-amber-400/10" aria-hidden="true" />
      <div className="border-l-4 border-l-red-400 pl-5">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-red-400">
          <LockKeyhole className="h-4 w-4" /> 403 — operators only
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-foreground">Admin access required.</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Your account does not have the admin role. If you were just promoted, log out and
          back in so your session picks up the new role.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={Routes.ACCESS_DENIED} className="border border-red-500/40 px-4 py-2 font-heading text-sm text-foreground hover:border-red-400">
            Why am I seeing this?
          </Link>
          <Link href={Routes.DASHBOARD} className="border border-border px-4 py-2 font-heading text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function AdminPage() {
  const { user, isLoading } = useAuth()
  const isAdmin = isAdminRole(user?.role)

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const metricsQuery = useAdminMetrics(isAdmin)
  const usersQuery = useAdminUsers({ search, page, limit: PAGE_LIMIT }, isAdmin)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSelectUser = (id: string) => {
    setSelectedUserId((prev) => (prev === id ? null : id))
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-label="Loading admin section">
        <Skeleton variant="card" className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((n) => <Skeleton key={n} variant="card" className="h-28 rounded-xl" />)}
        </div>
        <Skeleton variant="card" className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!isAdmin || usersQuery.data?.forbidden) {
    return (
      <div className="mx-auto max-w-4xl">
        <AccessDeniedPanel />
      </div>
    )
  }

  const loadError = metricsQuery.isError || usersQuery.isError
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="relative overflow-hidden border-b-2 border-amber-400/60 pb-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{ backgroundImage: "radial-gradient(circle, rgb(var(--muted-foreground) / 0.18) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        />
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">Operators</p>
        <h1 className="mt-2 font-heading text-5xl font-black tracking-tight text-foreground">
          Admin<span className="text-amber-400">.</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Platform totals and the user directory. Everything here calls the admin-only API —
          actions are audited server-side.
        </p>
      </header>

      {loadError ? (
        <section aria-label="Admin data failed to load" className="border border-dashed border-amber-400/50 bg-card px-6 py-10 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-400" />
          <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">Couldn&apos;t load admin data.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The API didn&apos;t answer. Your role is fine — this looks like a connectivity or
            server problem, not a permission one.
          </p>
          <button
            type="button"
            onClick={() => { void metricsQuery.refetch(); void usersQuery.refetch() }}
            className="mt-5 inline-flex items-center gap-2 border border-border px-4 py-2 font-heading text-sm text-foreground hover:border-amber-400/60"
          >
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
        </section>
      ) : (
        <>
          <AdminStats metrics={metricsQuery.data} loading={metricsQuery.isLoading} showRecalculate />
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" aria-hidden="true" />
          <AdminUsers
            users={usersQuery.data?.users ?? []}
            total={usersQuery.data?.meta.total ?? 0}
            loading={usersQuery.isLoading}
            search={search}
            onSearch={handleSearch}
            page={page}
            onPage={setPage}
            limit={PAGE_LIMIT}
            selectedId={selectedUserId}
            onSelect={handleSelectUser}
          />
          <AdminUserDetail userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
          <AdminCircles enabled={isAdmin} />
          <AdminCommunities enabled={isAdmin} />
          <AdminFrozen enabled={isAdmin} />
          <AdminTickets enabled={isAdmin} />
          <AdminDeleted enabled={isAdmin} />
          <AdminInspect enabled={isAdmin} />
          <AdminAuditLog enabled={isAdmin} />
          <AdminFlags enabled={isAdmin} />
          <AdminJobs enabled={isAdmin} />
        </>
      )}
    </div>
  )
}
