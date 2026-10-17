"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { del, get, getErrorMessage, patch, post } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import { logger } from "@/lib/logger"
import { useUIStore } from "@/stores/ui-store"

/**
 * Personal savings goals (vaults), backed by the real Go API:
 *   GET  /savings/goals             — all goals for the signed-in user
 *   GET  /savings/goals/active      — active goals only
 *   GET  /savings/goals/summary     — totals + streak
 *   GET  /savings/goals/obligations — auto-reserve goals due soon
 *   GET  /savings/goals/:id         — single goal
 *   POST /savings/goals             — create
 *   PATCH /savings/goals/:id        — update
 *   DELETE /savings/goals/:id       — delete
 *   POST /savings/goals/:id/complete — mark completed
 *
 * Amounts are Arc USDC. The backend model has no frequency field — cadence
 * lives on circles — so this hook (and the form) only deals with an optional
 * deadline (`targetDate`, YYYY-MM-DD), an optional linked circle, and the
 * auto-reserve flag.
 */

export type SavingsGoalStatus = "active" | "completed" | "cancelled"

export interface SavingsGoal {
  id: string
  userId: string
  name: string
  description: string
  targetAmount: number
  currentAmount: number
  targetDate?: string | null
  circleId?: string | null
  autoReserve: boolean
  autoAmount?: number
  autoFrequency?: string
  lastAutoAt?: string | null
  status: SavingsGoalStatus
  createdAt: string
  updatedAt: string
}

export interface SavingsSummary {
  totalGoals: number
  activeGoals: number
  completedGoals: number
  totalTarget: number
  totalSaved: number
  overallPercent: number
  savingsStreak: number
}

export interface CreateGoalInput {
  name: string
  description?: string
  targetAmount: number
  targetDate?: string | null
  circleId?: string | null
  autoReserve?: boolean
  autoAmount?: number
  autoFrequency?: string
}

export type UpdateGoalInput = Partial<{
  name: string
  description: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  circleId: string | null
  autoReserve: boolean
  autoAmount?: number
  autoFrequency?: string
  status: SavingsGoalStatus
}>

function unwrap<T>(response: unknown, key: string, fallback: T): T {
  const raw = response as Record<string, unknown>
  const data = (raw?.data ?? raw) as Record<string, unknown>
  return (data?.[key] ?? fallback) as T
}

export function useSavingsGoals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savings.list(),
    queryFn: async () =>
      unwrap<SavingsGoal[]>(await get("/savings/goals"), "goals", []),
    enabled,
  })
}

export function useActiveSavingsGoals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savings.active(),
    queryFn: async () =>
      unwrap<SavingsGoal[]>(await get("/savings/goals/active"), "goals", []),
    enabled,
  })
}

export function useSavingsSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savings.summary(),
    queryFn: async () =>
      unwrap<SavingsSummary | null>(
        await get("/savings/goals/summary"),
        "summary",
        null
      ),
    enabled,
  })
}

export function useSavingsObligations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savings.obligations(),
    queryFn: async () =>
      unwrap<SavingsGoal[]>(
        await get("/savings/goals/obligations"),
        "goals",
        []
      ),
    enabled,
  })
}

export function useSavingsGoal(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.savings.detail(id ?? "none"),
    queryFn: async () =>
      unwrap<SavingsGoal | null>(
        await get(`/savings/goals/${id}`),
        "goal",
        null
      ),
    enabled: enabled && !!id,
  })
}

export function useSavingsMutations() {
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.savings.summary(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.savings.obligations(),
      }),
    ])

  const fail = (title: string) => (err: unknown) => {
    logger.error(`[savings] ${title}:`, err)
    addToast({ type: "error", title, description: getErrorMessage(err) })
  }

  const createGoal = useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      const res = await post("/savings/goals", input)
      return unwrap<SavingsGoal>(res, "goal", null as unknown as SavingsGoal)
    },
    onSuccess: async (goal) => {
      await invalidate()
      addToast({
        type: "success",
        title: "Vault created",
        description: goal?.name
          ? `Saving USDC on Arc towards “${goal.name}”.`
          : "Your USDC vault is ready.",
      })
    },
    onError: fail("Could not create vault"),
  })

  const updateGoal = useMutation({
    mutationFn: async ({
      id,
      patch: body,
    }: {
      id: string
      patch: UpdateGoalInput
    }) => {
      const res = await patch(`/savings/goals/${id}`, body)
      return unwrap<SavingsGoal>(res, "goal", null as unknown as SavingsGoal)
    },
    onSuccess: async () => {
      await invalidate()
      addToast({ type: "success", title: "Vault updated" })
    },
    onError: fail("Could not update vault"),
  })

  const deleteGoal = useMutation({
    mutationFn: (id: string) => del(`/savings/goals/${id}`),
    onSuccess: async () => {
      await invalidate()
      addToast({ type: "success", title: "Vault deleted" })
    },
    onError: fail("Could not delete vault"),
  })

  const completeGoal = useMutation({
    mutationFn: async (id: string) => {
      const res = await post(`/savings/goals/${id}/complete`)
      return unwrap<SavingsGoal>(res, "goal", null as unknown as SavingsGoal)
    },
    onSuccess: async () => {
      await invalidate()
      addToast({
        type: "success",
        title: "Goal completed",
        description: "Target reached — nicely saved.",
      })
    },
    onError: fail("Could not complete goal"),
  })

  return { createGoal, updateGoal, deleteGoal, completeGoal }
}
