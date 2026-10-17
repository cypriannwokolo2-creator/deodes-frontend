"use client"

import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { ApiResponse, MoiScore } from "@/types"

interface TierResponse {
  score?: number
  breakdown?: { streaks?: number; completions?: number; volume?: number; recency?: number }
}

// GET /users/:id/reputation never existed. The backend serves reputation by
// wallet address at /reputation/tier/:address — this hook resolves that shape
// into MoiScore. History has no backend yet, so it comes back empty (the
// component renders its empty state) rather than faked.
export function useReputation(address: string) {
  return useQuery({
    queryKey: queryKeys.reputation.detail(address),
    queryFn: async () => {
      const response = await get<ApiResponse<TierResponse>>(
        `/reputation/tier/${encodeURIComponent(address)}`,
      )
      const data = response.data ?? (response as unknown as TierResponse)
      if (typeof data?.score !== "number") return null
      const b = data.breakdown ?? {}
      const reputation: MoiScore = {
        score: data.score,
        breakdown: {
          streaks: b.streaks ?? 0,
          completions: b.completions ?? 0,
          volume: b.volume ?? 0,
          recency: b.recency ?? 0,
        },
        history: [],
      }
      return reputation
    },
    enabled: !!address,
    // Keep reputation data fresh for 60 seconds after it's fetched.
    // Without a staleTime the query is treated as immediately stale, which
    // causes a background refetch on every mount — including after a page
    // refresh — so the tier card briefly receives `undefined` and renders a
    // 0 % progress bar before the refetch resolves (issue #394).
    staleTime: 60_000,
    // Return the last successfully fetched value while a background refetch
    // is in flight so the progress bar never snaps to 0.
    placeholderData: (previousData) => previousData ?? undefined,
  })
}
