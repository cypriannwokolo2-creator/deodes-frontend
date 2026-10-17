"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { get, getErrorMessage, patch, post, del } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import { useUIStore } from "@/stores/ui-store"
import type { ApiResponse, PaginationMeta } from "@/types"

/** Backend role value that unlocks the admin section and /admin/* routes. */
export const ADMIN_ROLE = "admin" as const

/** Single source of truth for the admin gate: missing/unknown roles are denied. */
export function isAdminRole(role: unknown): boolean {
  return role === ADMIN_ROLE
}

export interface AdminUser {
  id: string
  walletAddress: string
  email?: string | null
  phone?: string | null
  username?: string | null
  displayName?: string | null
  role?: string
  moiScore?: number
  countryCode?: string | null
  preferredLanguage?: string | null
  totpEnabled?: boolean
  emailVerified?: boolean
  sessionTtlMinutes?: number
  createdAt?: string
}

export interface AdminMetrics {
  totalUsers: number
  totalCircles: number
  activeCircles: number
  totalContributions: number
  totalPayouts: number
  activeUsers: number
  newUsers30d: number
  contributionVolume: number
  payoutVolume: number
  totalVolumeUSD: number
  volumeUSD30d: number
}

export interface AdminUsersResult {
  users: AdminUser[]
  meta: PaginationMeta
  /** True when the backend answered 403 — the cached role is stale or revoked. */
  forbidden: boolean
}

function isForbidden(error: unknown): boolean {
  return (
    error instanceof AxiosError &&
    (error.response?.status === 403 ||
      (error as { status?: number }).status === 403)
  )
}

const EMPTY_META: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 0 }

/**
 * Platform-wide aggregates for the admin overview (GET /admin/metrics).
 * Disabled unless the caller is an admin, so non-admins never fire it.
 */
export function useAdminMetrics(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.metrics(),
    queryFn: async (): Promise<AdminMetrics | null> => {
      const response = await get<ApiResponse<AdminMetrics>>("/admin/metrics")
      return response.data ?? null
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * Paginated user directory for admins (GET /admin/users).
 * A 403 resolves to `{ users: [], forbidden: true }` instead of throwing,
 * so the page can render the access-denied state inline.
 */
export function useAdminUsers(
  filters: { search?: string; page?: number; limit?: number },
  enabled: boolean,
) {
  const { search = "", page = 1, limit = 20 } = filters
  return useQuery({
    queryKey: queryKeys.admin.users({ search, page, limit }),
    queryFn: async (): Promise<AdminUsersResult> => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      params.set("page", String(page))
      params.set("limit", String(limit))
      try {
        const response = await get<
          ApiResponse<{ users: AdminUser[] }>
        >(`/admin/users?${params.toString()}`)
        return {
          users: response.data?.users ?? [],
          meta: response.meta ?? { ...EMPTY_META, page, limit },
          forbidden: false,
        }
      } catch (error) {
        if (isForbidden(error)) {
          return { users: [], meta: { ...EMPTY_META, page, limit }, forbidden: true }
        }
        throw error
      }
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}

export interface AdminCircle {
  id: string
  name?: string
  status: string
  memberCount?: number
  contributionAmount?: number
}

export interface AdminCommunity {
  id: string
  name?: string
  slug?: string
  memberCount?: number
  suspendedAt?: string | null
  suspendedReason?: string | null
}

export interface FrozenWallet {
  id: string
  userId: string
  publicKey: string
  frozenReason?: string | null
}

function listParams(filters: { search?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams()
  if (filters.search) params.set("search", filters.search)
  params.set("page", String(filters.page ?? 1))
  params.set("limit", String(filters.limit ?? 20))
  return params.toString()
}

/** Admin circle directory, suspended/banned included (GET /admin/circles). */
export function useAdminCircles(
  filters: { search?: string; page?: number; limit?: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.circles(filters),
    queryFn: async (): Promise<{ circles: AdminCircle[]; meta: PaginationMeta }> => {
      try {
        const response = await get<ApiResponse<{ circles: AdminCircle[] }>>(
          `/admin/circles?${listParams(filters)}`,
        )
        return {
          circles: response.data?.circles ?? [],
          meta: response.meta ?? { ...EMPTY_META, page: filters.page ?? 1, limit: filters.limit ?? 20 },
        }
      } catch (error) {
        if (isForbidden(error)) {
          return { circles: [], meta: { ...EMPTY_META, page: 1, limit: 20 } }
        }
        throw error
      }
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}

/** Admin community directory, suspended included (GET /admin/communities). */
export function useAdminCommunities(
  filters: { search?: string; page?: number; limit?: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.communities(filters),
    queryFn: async (): Promise<{ communities: AdminCommunity[]; meta: PaginationMeta }> => {
      try {
        const response = await get<ApiResponse<{ communities: AdminCommunity[] }>>(
          `/admin/communities?${listParams(filters)}`,
        )
        return {
          communities: response.data?.communities ?? [],
          meta: response.meta ?? { ...EMPTY_META, page: filters.page ?? 1, limit: filters.limit ?? 20 },
        }
      } catch (error) {
        if (isForbidden(error)) {
          return { communities: [], meta: { ...EMPTY_META, page: 1, limit: 20 } }
        }
        throw error
      }
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}

/** Frozen hosted wallets (GET /admin/frozen-wallets). */
export function useAdminFrozenWallets(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.frozen(),
    queryFn: async (): Promise<FrozenWallet[]> => {
      try {
        const response = await get<ApiResponse<{ wallets: FrozenWallet[] }>>("/admin/frozen-wallets")
        return response.data?.wallets ?? []
      } catch (error) {
        if (isForbidden(error)) return []
        throw error
      }
    },
    enabled,
    staleTime: 15_000,
    retry: false,
  })
}

function useAdminToast() {
  return useUIStore((s) => s.addToast)
}

/** Pause / resume / ban a circle (POST /admin/circles/:id/:action). */
export function useAdminCircleAction() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "pause" | "resume" | "ban"; reason?: string }) =>
      post(`/admin/circles/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "circles"] })
      addToast({ type: "success", title: `Circle ${vars.action}d` })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Moderation failed", description: getErrorMessage(err) })
    },
  })
}

/** Suspend / unsuspend / ban a community (POST /admin/communities/:id/:action). */
export function useAdminCommunityAction() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "suspend" | "unsuspend" | "ban"; reason?: string }) =>
      post(`/admin/communities/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (_data, vars) => {
      const label =
        vars.action === "suspend" ? "suspended" : vars.action === "unsuspend" ? "unsuspended" : "banned"
      void queryClient.invalidateQueries({ queryKey: ["admin", "communities"] })
      addToast({ type: "success", title: `Community ${label}` })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Moderation failed", description: getErrorMessage(err) })
    },
  })
}

/** Freeze / unfreeze a user's funds (POST /admin/users/:id/freeze|unfreeze). */
export function useAdminFreezeAction() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: ({ userId, freeze, reason }: { userId: string; freeze: boolean; reason?: string }) =>
      post(`/admin/users/${userId}/${freeze ? "freeze" : "unfreeze"}`, reason ? { reason } : {}),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.frozen() })
      addToast({
        type: "success",
        title: vars.freeze ? "Funds frozen" : "Funds unfrozen",
        description: vars.freeze ? "Outbound sends from this account now reject." : undefined,
      })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Freeze action failed", description: getErrorMessage(err) })
    },
  })
}

export interface SupportTicket {
  id: string
  userId?: string | null
  email: string
  message: string
  status: "open" | "resolved"
  createdAt: string
  resolvedAt?: string | null
}

export interface AdminUserDetail {
  user: AdminUser
  wallets?: { id: string; publicKey: string; walletType: string; isFrozen?: boolean; frozenReason?: string | null }[]
  circles?: { id: string; name?: string; status: string }[]
  communities?: { id: string; name?: string; slug?: string }[]
  recentSends?: { amount: number; destination: string; asset: string; status: string; txHash?: string | null; failureReason?: string | null; createdAt: string }[]
}

/** Admin support inbox (GET /admin/support-tickets). */
export function useAdminTickets(
  filters: { status?: string; page?: number; limit?: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.admin.tickets(filters),
    queryFn: async (): Promise<{ tickets: SupportTicket[]; meta: PaginationMeta }> => {
      try {
        const params = new URLSearchParams()
        if (filters.status) params.set("status", filters.status)
        params.set("page", String(filters.page ?? 1))
        params.set("limit", String(filters.limit ?? 20))
        const response = await get<ApiResponse<{ tickets: SupportTicket[] }>>(
          `/admin/support-tickets?${params.toString()}`,
        )
        return {
          tickets: response.data?.tickets ?? [],
          meta: response.meta ?? { ...EMPTY_META, page: filters.page ?? 1, limit: filters.limit ?? 20 },
        }
      } catch (error) {
        if (isForbidden(error)) {
          return { tickets: [], meta: { ...EMPTY_META, page: 1, limit: 20 } }
        }
        throw error
      }
    },
    enabled,
    staleTime: 15_000,
    retry: false,
  })
}

/** Resolve / reopen a ticket (PATCH /admin/support-tickets/:id). */
export function useAdminTicketAction() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "open" | "resolved" }) =>
      patch(`/admin/support-tickets/${id}`, { status }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] })
      addToast({
        type: "success",
        title: vars.status === "resolved" ? "Ticket resolved" : "Ticket reopened",
      })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Ticket update failed", description: getErrorMessage(err) })
    },
  })
}

/** Recompute DeoScores (POST /admin/reputation/recalculate). No target =
 * whole user base; pass userId for one account (also used after manual
 * review). Refreshes the aggregates the overview reads. */
export function useAdminRecalculateScores() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: async ({ userId }: { userId?: string }): Promise<{ updated: number; failed: number; score?: number }> => {
      const suffix = userId ? `?user_id=${encodeURIComponent(userId)}` : ""
      const response = await post<ApiResponse<{ updated: number; failed: number; score?: number }>>(
        `/admin/reputation/recalculate${suffix}`,
        {},
      )
      return {
        updated: response.data?.updated ?? 0,
        failed: response.data?.failed ?? 0,
        score: response.data?.score,
      }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.metrics() })
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      addToast({
        type: result.failed > 0 ? "error" : "success",
        title: result.failed > 0 ? `Updated ${result.updated}, ${result.failed} failed` : `Scores updated (${result.updated})`,
      })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Recalculation failed", description: getErrorMessage(err) })
    },
  })
}

/** Full moderation view of one user (GET /admin/users/:id). */
export function useAdminUserDetail(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.userDetail(id ?? ""),
    queryFn: async (): Promise<AdminUserDetail | null> => {
      if (!id) return null
      const response = await get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`)
      const data = response.data as unknown as AdminUserDetail & { user?: AdminUser }
      if (!data?.user) return null
      return {
        user: data.user,
        wallets: data.wallets ?? [],
        circles: data.circles ?? [],
        communities: data.communities ?? [],
        recentSends: data.recentSends ?? [],
      }
    },
    enabled: enabled && id !== null,
    staleTime: 15_000,
    retry: false,
  })
}

export interface AdminDeletedUsersResult {
  users: AdminUser[]
  meta: PaginationMeta
}

/** Soft-deleted user directory (GET /admin/users/deleted). */
export function useAdminDeletedUsers(
  filters: { search?: string; page?: number; limit?: number },
  enabled: boolean,
) {
  const { search = "", page = 1, limit = 20 } = filters
  return useQuery({
    queryKey: queryKeys.admin.deleted({ search, page, limit }),
    queryFn: async (): Promise<AdminDeletedUsersResult> => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      params.set("page", String(page))
      params.set("limit", String(limit))
      const response = await get<ApiResponse<{ users: AdminUser[] }>>(
        `/admin/users/deleted?${params.toString()}`,
      )
      return {
        users: response.data?.users ?? [],
        meta: response.meta ?? { ...EMPTY_META, page, limit },
      }
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}

/** Restore a soft-deleted user (POST /admin/users/:id/restore). */
export function useAdminRestoreUser() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      post(`/admin/users/${userId}/restore`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "deleted-users"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      addToast({ type: "success", title: "User restored" })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Restore failed", description: getErrorMessage(err) })
    },
  })
}

export interface CircleInspectResult {
  circle: { id: string; name?: string; status: string; currentRound?: number } & Record<string, unknown>
  members: { userId?: string; user_id?: string; status?: string; role?: string }[] & Record<string, unknown>
  memberCount: number
  currentRound?: number
  status: string
}

/** Read-only circle inspection (GET /admin/circles/:id/inspect). Audited server-side. */
export function useAdminCircleInspect(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.inspect(id ?? ""),
    queryFn: async (): Promise<CircleInspectResult | null> => {
      if (!id) return null
      const response = await get<ApiResponse<CircleInspectResult>>(`/admin/circles/${id}/inspect`)
      if (!response.data?.circle) return null
      return response.data
    },
    enabled: enabled && id !== null,
    staleTime: 15_000,
    retry: false,
  })
}

export interface AdminAuditEntry {
  id: string
  actorId: string
  action: string
  resourceType: string
  resourceId?: { String?: string; Valid?: boolean } | string | null
  details?: unknown
  ipAddress?: { String?: string; Valid?: boolean } | string | null
  createdAt: string
}

export interface AdminAuditFilters {
  resource_type?: string
  action?: string
  actor_id?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

/** Paginated audit trail (GET /admin/audit-log). */
export function useAdminAuditLog(filters: AdminAuditFilters, enabled: boolean) {
  const { page = 1, limit = 20 } = filters
  return useQuery({
    queryKey: queryKeys.admin.audit(filters),
    queryFn: async (): Promise<{ entries: AdminAuditEntry[]; meta: PaginationMeta }> => {
      const params = new URLSearchParams()
      for (const k of ["resource_type", "action", "actor_id", "from", "to"] as const) {
        if (filters[k]) params.set(k, String(filters[k]))
      }
      params.set("page", String(page))
      params.set("limit", String(limit))
      const response = await get<ApiResponse<{ entries: AdminAuditEntry[] }>>(
        `/admin/audit-log?${params.toString()}`,
      )
      return {
        entries: response.data?.entries ?? [],
        meta: response.meta ?? { ...EMPTY_META, page, limit },
      }
    },
    enabled,
    staleTime: 15_000,
    retry: false,
  })
}

export interface FeatureFlag {
  id?: number
  flag: string
  enabled: boolean
  value?: boolean
  description?: string
  updatedAt?: string
}

/** Feature flag directory (GET /admin/feature-flags). */
export function useAdminFeatureFlags(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.flags(),
    queryFn: async (): Promise<FeatureFlag[]> => {
      const response = await get<ApiResponse<{ flags: FeatureFlag[] }>>("/admin/feature-flags")
      const raw = response.data?.flags ?? []
      return raw.map((f) => ({ ...f, enabled: f.enabled ?? f.value ?? false }))
    },
    enabled,
    staleTime: 15_000,
    retry: false,
  })
}

/** Create/update or delete a feature flag (POST / DELETE /admin/feature-flags). */
export function useAdminFlagAction() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  const set = useMutation({
    mutationFn: ({ flag, value, description }: { flag: string; value: boolean; description?: string }) =>
      post(`/admin/feature-flags`, { flag, value, description }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.flags() })
      addToast({ type: "success", title: "Flag saved" })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Flag save failed", description: getErrorMessage(err) })
    },
  })
  const remove = useMutation({
    mutationFn: ({ flag }: { flag: string }) =>
      del(`/admin/feature-flags/${encodeURIComponent(flag)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.flags() })
      addToast({ type: "success", title: "Flag deleted" })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Flag delete failed", description: getErrorMessage(err) })
    },
  })
  return { set, remove }
}

export interface DeadLetterJob {
  id: string
  queue_name?: string
  queueName?: string
  status?: string
  retries_count?: number
  retriesCount?: number
  max_retries?: number
  last_error?: { String?: string; Valid?: boolean } | string | null
  created_at?: string
  createdAt?: string
  updated_at?: string
}

/** Dead-letter queue (GET /admin/jobs/dead-letter). */
export function useAdminDeadLetterJobs(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.jobs(),
    queryFn: async (): Promise<DeadLetterJob[]> => {
      const response = await get<ApiResponse<{ dead_letter_jobs: DeadLetterJob[] }>>(
        "/admin/jobs/dead-letter",
      )
      return response.data?.dead_letter_jobs ?? []
    },
    enabled,
    staleTime: 15_000,
    retry: false,
  })
}

/** Requeue a dead-letter job (POST /admin/jobs/dead-letter/:id/retry). */
export function useAdminRetryJob() {
  const queryClient = useQueryClient()
  const addToast = useAdminToast()
  return useMutation({
    mutationFn: ({ jobId }: { jobId: string }) =>
      post(`/admin/jobs/dead-letter/${encodeURIComponent(jobId)}/retry`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.jobs() })
      addToast({ type: "success", title: "Job requeued" })
    },
    onError: (err: unknown) => {
      addToast({ type: "error", title: "Retry failed", description: getErrorMessage(err) })
    },
  })
}
