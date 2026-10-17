"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { Circle } from "@/types";
import { getDynamicMockCircles } from "@/lib/circles/mock-circles";
import { getJoinBlockReason } from "@/lib/circles/joinability";
import { ARC_NETWORK } from "@/lib/constants";

export type ExploreSource = "live" | "mock";

interface CirclesListEnvelope {
  success?: boolean;
  data?: { circles?: Circle[] } | Circle[];
}

/**
 * Public circle discovery for /explore. No auth token is attached — the list
 * endpoint answers unauthenticated.
 *
 * Source resolution (`NEXT_PUBLIC_EXPLORE_SOURCE`, default `auto`):
 * - auto: live circles when the API returns any, otherwise the clearly
 *   labeled mock showcase. Real circles automatically take over the moment
 *   the first one is created.
 * - live: API only (empty state when none exist).
 * - mock: showcase pinned (useful for demos/screenshots; ignored on mainnet).
 *
 * Mainnet correctness: when ARC_NETWORK === "mainnet" the mock showcase is
 * always off — source is forced to "live" so no sample data is ever presented
 * as real on production.
 */
export function useExploreCircles(search = "", type = "all") {
  const forced = (process.env.NEXT_PUBLIC_EXPLORE_SOURCE ?? "auto").toLowerCase();
  // Testnet-only showcase: never show mock circles on Arc mainnet.
  const isMainnet = ARC_NETWORK === "mainnet";
  const q = search.trim();

  const query = useQuery({
    queryKey: [...queryKeys.circles.all, "explore", q, type],
    queryFn: async (): Promise<Circle[]> => {
      if (forced === "mock" && !isMainnet) return [];
      const params: Record<string, string> = { limit: "50" };
      if (q) params.search = q;
      if (type !== "all") params.type = type;
      const res = await get<CirclesListEnvelope>("/circles", { params });
      const data = res?.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.circles)) return data.circles;
      return [];
    },
    staleTime: 60_000,
    retry: 1,
  });

  const live = query.data ?? [];
  const useMock =
    !isMainnet && (forced === "mock" || (forced !== "live" && live.length === 0 && !q));
  const source: ExploreSource = useMock ? "mock" : "live";
  // Mock showcase stays dynamic (rounds advance, order rotates) so the page
  // never looks frozen while no real circles exist yet.
  const base = useMock ? getDynamicMockCircles() : live;

  const circles = base
    .filter((c) => {
      if (type !== "all" && c.circleType !== type) return false;
      if (!q || !useMock) return true;
      // Server already filtered live results; only filter mock data locally.
      const lq = q.toLowerCase();
      return (
        c.name.toLowerCase().includes(lq) ||
        (c.description ?? "").toLowerCase().includes(lq) ||
        (c.organizerName ?? "").toLowerCase().includes(lq)
      );
    })
    // Joinable circles first so newcomers see what they can actually join;
    // invite-only/full/ended rows stay visible below with their badges.
    .sort((a, b) => {
      const ra = getJoinBlockReason(a);
      const rb = getJoinBlockReason(b);
      const sa = ra === null ? 0 : ra === "invite-only" ? 1 : 2;
      const sb = rb === null ? 0 : rb === "invite-only" ? 1 : 2;
      return sa - sb;
    });

  return { circles, source, isLoading: query.isLoading, isError: query.isError };
}

export function resolveExploreSource(
  liveCount: number,
  forced: string,
  network: "testnet" | "mainnet" = ARC_NETWORK,
): ExploreSource {
  // Mainnet never shows the mock showcase, regardless of the forced flag.
  if (network === "mainnet") return "live";
  if (forced === "mock") return "mock";
  if (forced === "live") return "live";
  return liveCount > 0 ? "live" : "mock";
}
