"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { del, get, patch, post, getErrorMessage } from "@/lib/api-client"
import { useUIStore } from "@/stores/ui-store"
import { queryKeys } from "@/lib/query-keys"

export interface Community {
  id: string
  name: string
  slug: string
  description: string
  category: string
  tags: string[]
  avatarUrl?: string
  bannerUrl?: string
  ownerId: string
  memberCount: number
  totalSaved: number
  isFeatured: boolean
  createdAt: string
}

export interface CommunityMember {
  userId: string
  role: string
  joinedAt: string
  displayName?: string
  walletAddress?: string
  moiScore?: number
}

export interface CommunityCircle {
  id: string
  name: string
  status: string
  circleType: string
  contributionAmount: number
  currency: string
  frequency: string
  maxMembers: number
  currentRound: number
  memberCount?: number
  requiresInvite?: boolean
}

export interface CommunityAnnouncement {
  id: string
  content: string
  authorId: string
  isPinned: boolean
  likeCount: number
  createdAt: string
}

export interface CommunityActivityEvent {
  id: string
  eventType: string
  actorId?: string
  metadata: Record<string, string>
  createdAt: string
}

export interface CommunityDetail {
  community: Community | null
  members: CommunityMember[]
  announcements: CommunityAnnouncement[]
  activity: CommunityActivityEvent[]
  circles: CommunityCircle[]
}

function unwrap<T>(res: unknown, key: string): T | undefined {
  const raw = res as Record<string, unknown>
  const data = (raw?.data ?? raw) as Record<string, unknown>
  return data?.[key] as T | undefined
}

/**
 * Fetches everything the community detail page needs in one query.
 *
 * The five endpoints are fetched with allSettled (matching the previous
 * manual-fetch behavior): one failing sub-resource degrades gracefully
 * instead of failing the whole page.
 */
export function useCommunity(communityId: string) {
  return useQuery({
    queryKey: queryKeys.communities.detail(communityId),
    queryFn: async (): Promise<CommunityDetail> => {
      const [comRes, memRes, annRes, actRes, cirRes] = await Promise.allSettled([
        get<unknown>(`/communities/${communityId}`),
        get<unknown>(`/communities/${communityId}/members`),
        get<unknown>(`/communities/${communityId}/announcements`),
        get<unknown>(`/communities/${communityId}/activity`),
        get<unknown>(`/circles?communityId=${communityId}`),
      ])

      return {
        community:
          comRes.status === "fulfilled"
            ? (unwrap<Community>(comRes.value, "community") ?? null)
            : null,
        members:
          memRes.status === "fulfilled" ? (unwrap<CommunityMember[]>(memRes.value, "members") ?? []) : [],
        announcements:
          annRes.status === "fulfilled"
            ? (unwrap<CommunityAnnouncement[]>(annRes.value, "announcements") ?? [])
            : [],
        activity:
          actRes.status === "fulfilled"
            ? (unwrap<CommunityActivityEvent[]>(actRes.value, "events") ?? [])
            : [],
        circles:
          cirRes.status === "fulfilled" ? (unwrap<CommunityCircle[]>(cirRes.value, "circles") ?? []) : [],
      }
    },
    enabled: !!communityId,
    staleTime: 30_000,
  })
}

export function useCommunityMembership(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.communities.membership(communityId),
    queryFn: async () => {
      const res = await get<unknown>(`/communities/${communityId}/membership`)
      return !!unwrap<boolean>(res, "isMember")
    },
    enabled: enabled && !!communityId,
    staleTime: 30_000,
  })
}

export function useJoinCommunity(communityId: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  return useMutation({
    mutationFn: () => post(`/communities/${communityId}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.membership(communityId) })
    },
    onError: (err) => {
      addToast({ type: "error", title: "Failed to join community", description: getErrorMessage(err) })
    },
  })
}

export function useTogglePinAnnouncement(communityId: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      patch(`/communities/${communityId}/announcements/${id}/pin`, { pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) })
    },
    onError: (err) => {
      addToast({ type: "error", title: "Failed to update pin", description: getErrorMessage(err) })
    },
  })
}

export function useDeleteAnnouncement(communityId: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  return useMutation({
    mutationFn: (id: string) => del(`/communities/${communityId}/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) })
    },
    onError: (err) => {
      addToast({ type: "error", title: "Failed to delete announcement", description: getErrorMessage(err) })
    },
  })
}

export function useCreateAnnouncement(communityId: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  return useMutation({
    mutationFn: (content: string) => post(`/communities/${communityId}/announcements`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) })
    },
    onError: (err) => {
      addToast({ type: "error", title: "Failed to post announcement", description: getErrorMessage(err) })
    },
  })
}

export function useRemoveCommunityMember(communityId: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  return useMutation({
    mutationFn: (targetId: string) => del(`/communities/${communityId}/members/${targetId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) })
    },
    onError: (err) => {
      addToast({ type: "error", title: "Failed to remove member", description: getErrorMessage(err) })
    },
  })
}

export function useTransferCommunityOwnership(communityId: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  return useMutation({
    mutationFn: (newOwnerId: string) =>
      post(`/communities/${communityId}/transfer-ownership`, { newOwnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.detail(communityId) })
    },
    onError: (err) => {
      addToast({ type: "error", title: "Failed to transfer ownership", description: getErrorMessage(err) })
    },
  })
}
