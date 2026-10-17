/**
 * Centralized TanStack Query key factories.
 *
 * Every domain's query keys live here so invalidation and prefetch call
 * sites can share one source of truth instead of scattering string-array
 * literals (["circle", id], ["circles", filters], ...) across hooks and
 * pages. Add a factory here before introducing a new `useQuery` call.
 */

// ListFilter shapes are intentionally loose (not imported from the hooks that
// own them) so this module never has to import back from `src/hooks` —
// each factory only needs to know which filter fields affect the cache key.

export const queryKeys = {
  circles: {
    all: ["circles"] as const,
    list: (filters?: unknown) => ["circles", filters] as const,
    detail: (id: string) => ["circle", id] as const,
    members: (id: string) => ["circle-members", id] as const,
    rounds: (id: string) => ["circle-rounds", id] as const,
    /**
     * Command-palette circle index. Separate from `list` so the palette's
     * unfiltered, limit-50 fetch never invalidates (or is invalidated by) the
     * paginated circles-browser queries.
     */
    palette: () => ["circles", "palette"] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
    mine: () => ["subscriptions", "mine"] as const,
    one: (circleId: string) => ["subscription", circleId] as const,
  },
  payouts: {
    all: ["payouts"] as const,
    list: (filters?: {
      page?: number
      limit?: number
      sortBy?: string
      sortDir?: string
      circleId?: string
      payoutType?: string
      dateFrom?: string
      dateTo?: string
    }) =>
      [
        "payouts",
        filters?.page,
        filters?.limit,
        filters?.sortBy,
        filters?.sortDir,
        filters?.circleId,
        filters?.payoutType,
        filters?.dateFrom,
        filters?.dateTo,
      ] as const,
    forCircle: (circleId: string, filters?: { page?: number; limit?: number }) =>
      ["circle-payouts", circleId, filters?.page, filters?.limit] as const,
  },
  reputation: {
    detail: (userId: string) => ["reputation", userId] as const,
  },
  communities: {
    all: ["communities"] as const,
    detail: (id: string) => ["community", id] as const,
    membership: (id: string) => ["community-membership", id] as const,
  },
  governance: {
    all: ["governance-proposals"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["governance-proposals", filters] as const,
    detail: (id: string) => ["governance-proposal", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    archive: ["notifications", "archive"] as const,
  },
  admin: {
    metrics: () => ["admin", "metrics"] as const,
    users: (filters?: { search?: string; page?: number; limit?: number }) =>
      ["admin", "users", filters?.search, filters?.page, filters?.limit] as const,
    circles: (filters?: { search?: string; page?: number; limit?: number }) =>
      ["admin", "circles", filters?.search, filters?.page, filters?.limit] as const,
    communities: (filters?: { search?: string; page?: number; limit?: number }) =>
      ["admin", "communities", filters?.search, filters?.page, filters?.limit] as const,
    frozen: () => ["admin", "frozen-wallets"] as const,
    tickets: (filters?: { status?: string; page?: number; limit?: number }) =>
      ["admin", "tickets", filters?.status, filters?.page, filters?.limit] as const,
    userDetail: (id: string) => ["admin", "user", id] as const,
    deleted: (filters?: { search?: string; page?: number; limit?: number }) =>
      ["admin", "deleted-users", filters?.search, filters?.page, filters?.limit] as const,
    inspect: (id: string) => ["admin", "circle-inspect", id] as const,
    audit: (filters?: { resource_type?: string; action?: string; actor_id?: string; from?: string; to?: string; page?: number; limit?: number }) =>
      ["admin", "audit", filters?.resource_type, filters?.action, filters?.actor_id, filters?.from, filters?.to, filters?.page, filters?.limit] as const,
    flags: () => ["admin", "feature-flags"] as const,
    jobs: () => ["admin", "dead-letter-jobs"] as const,
  },
  savings: {
    all: ["savings-goals"] as const,
    list: () => ["savings-goals", "list"] as const,
    active: () => ["savings-goals", "active"] as const,
    summary: () => ["savings-goals", "summary"] as const,
    obligations: () => ["savings-goals", "obligations"] as const,
    detail: (id: string) => ["savings-goal", id] as const,
  },
} as const
