"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { del, get, patch, post, getErrorMessage } from "@/lib/api-client"
import { useUIStore } from "@/stores/ui-store"

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

export interface Member {
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

export interface Announcement {
  id: string
  content: string
  authorId: string
  isPinned: boolean
  likeCount: number
  createdAt: string
}

export interface ActivityEvent {
  id: string
  eventType: string
  actorId?: string
  metadata: Record<string, string>
  createdAt: string
}

function unwrap<T>(response: unknown, key: string, fallback: T): T {
  const raw = response as Record<string, unknown>
  const data = (raw.data ?? raw) as Record<string, unknown>
  return (data[key] ?? fallback) as T
}

export const communityKeys = {
  all: ["community"] as const,
  detail: (id: string) => ["community", id] as const,
  members: (id: string) => ["community", id, "members"] as const,
  announcements: (id: string) => ["community", id, "announcements"] as const,
  activity: (id: string) => ["community", id, "activity"] as const,
  circles: (id: string) => ["community", id, "circles"] as const,
  membership: (id: string) => ["community", id, "membership"] as const,
}

export function useCommunity(id: string, enabled = true) {
  const query = useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: async () => unwrap<Community | null>(await get(`/communities/${id}`), "community", null),
    enabled: enabled && !!id,
  })
  return query
}

export function useCommunityMembers(id: string, enabled = true, search?: string) {
  const q = (search ?? "").trim()
  return useQuery({
    queryKey: [...communityKeys.members(id), q],
    queryFn: async () => {
      const path = q
        ? `/communities/${id}/members?search=${encodeURIComponent(q)}`
        : `/communities/${id}/members`
      return unwrap<Member[]>(await get(path), "members", [])
    },
    enabled: enabled && !!id,
  })
}

export function useCommunityAnnouncements(id: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.announcements(id),
    queryFn: async () => unwrap<Announcement[]>(await get(`/communities/${id}/announcements`), "announcements", []),
    enabled: enabled && !!id,
  })
}

export function useCommunityActivity(id: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.activity(id),
    queryFn: async () => unwrap<ActivityEvent[]>(await get(`/communities/${id}/activity`), "events", []),
    enabled: enabled && !!id,
  })
}

export function useCommunityCircles(id: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.circles(id),
    queryFn: async () => unwrap<CommunityCircle[]>(await get(`/circles?communityId=${encodeURIComponent(id)}`), "circles", []),
    enabled: enabled && !!id,
  })
}

export function useCommunityMembership(id: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.membership(id),
    queryFn: async () => Boolean(unwrap<boolean>(await get(`/communities/${id}/membership`), "isMember", false)),
    enabled: enabled && !!id,
  })
}

export function useCommunityMutation(id: string) {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  const fail = (title: string) => (err: unknown) =>
    addToast({ type: "error", title, description: getErrorMessage(err) })
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: communityKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: communityKeys.members(id) }),
      queryClient.invalidateQueries({ queryKey: communityKeys.announcements(id) }),
      queryClient.invalidateQueries({ queryKey: communityKeys.activity(id) }),
      queryClient.invalidateQueries({ queryKey: communityKeys.membership(id) }),
    ])
  }

  const join = useMutation({
    mutationFn: () => post(`/communities/${id}/join`),
    onSuccess: invalidate,
    onError: fail("Failed to join community"),
  })
  const leave = useMutation({
    mutationFn: () => post(`/communities/${id}/leave`),
    onSuccess: invalidate,
    onError: fail("Failed to leave community"),
  })
  const togglePin = useMutation({
    mutationFn: ({ announcementId, pinned }: { announcementId: string; pinned: boolean }) =>
      patch(`/communities/${id}/announcements/${announcementId}/pin`, { pinned }),
    onSuccess: invalidate,
    onError: fail("Failed to update pin"),
  })
  const deleteAnnouncement = useMutation({
    mutationFn: (announcementId: string) => del(`/communities/${id}/announcements/${announcementId}`),
    onSuccess: invalidate,
    onError: fail("Failed to delete announcement"),
  })
  const removeMember = useMutation({
    mutationFn: (memberId: string) => del(`/communities/${id}/members/${memberId}`),
    onSuccess: invalidate,
    onError: fail("Failed to remove member"),
  })
  const transferOwnership = useMutation({
    mutationFn: (newOwnerId: string) => post(`/communities/${id}/transfer-ownership`, { newOwnerId }),
    onSuccess: invalidate,
    onError: fail("Failed to transfer ownership"),
  })
  const createAnnouncement = useMutation({
    mutationFn: (content: string) => post(`/communities/${id}/announcements`, { content }),
    onSuccess: invalidate,
    onError: fail("Failed to post announcement"),
  })
  const likeAnnouncement = useMutation({
    mutationFn: (announcementId: string) =>
      post(`/communities/${id}/announcements/${announcementId}/like`, {}),
    onSuccess: invalidate,
    onError: fail("Failed to like announcement"),
  })

  return { join, leave, togglePin, deleteAnnouncement, removeMember, transferOwnership, createAnnouncement, likeAnnouncement }
}
