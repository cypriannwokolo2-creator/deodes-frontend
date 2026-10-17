import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { AxiosError } from "axios"
import { get, post } from "@/lib/api-client"
import {
  isAdminRole,
  useAdminMetrics,
  useAdminUsers,
  useAdminDeletedUsers,
  useAdminCircleInspect,
  useAdminAuditLog,
  useAdminFeatureFlags,
  useAdminDeadLetterJobs,
  useAdminRecalculateScores,
} from "@/hooks/use-admin"
import { createQueryWrapper } from "./test-utils"

vi.mock("@/lib/api-client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

const mockedGet = vi.mocked(get)

beforeEach(() => {
  mockedGet.mockReset()
})

describe("isAdminRole", () => {
  it("grants only the exact admin role", () => {
    expect(isAdminRole("admin")).toBe(true)
    expect(isAdminRole("user")).toBe(false)
    expect(isAdminRole("Admin")).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole("")).toBe(false)
  })
})

describe("useAdminMetrics", () => {
  it("returns platform aggregates from /admin/metrics", async () => {
    mockedGet.mockResolvedValue({
      data: { totalUsers: 42, totalCircles: 7, activeCircles: 3 },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminMetrics(true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/metrics")
    expect(result.current.data?.totalUsers).toBe(42)
    expect(result.current.data?.totalCircles).toBe(7)
  })

  it("stays idle for non-admins", () => {
    mockedGet.mockClear()
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminMetrics(false), {
      wrapper: QueryWrapper,
    })

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it("resolves null when the envelope has no data", async () => {
    mockedGet.mockResolvedValue({ data: undefined })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminMetrics(true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe("useAdminUsers", () => {
  it("fetches the user directory with search and pagination", async () => {
    mockedGet.mockResolvedValue({
      data: { users: [{ id: "u1", walletAddress: "0x1", role: "user" }] },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(
      () => useAdminUsers({ search: "0x1", page: 1, limit: 20 }, true),
      { wrapper: QueryWrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/users?search=0x1&page=1&limit=20")
    expect(result.current.data?.users).toHaveLength(1)
    expect(result.current.data?.forbidden).toBe(false)
  })

  it("omits the search param when no search is given", async () => {
    mockedGet.mockResolvedValue({ data: { users: [] } })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminUsers({}, true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/users?page=1&limit=20")
  })

  it("surfaces a 403 as forbidden instead of throwing", async () => {
    mockedGet.mockRejectedValue(
      new AxiosError("forbidden", "ERR", undefined, null, {
        status: 403,
      } as never),
    )
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminUsers({}, true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.users).toEqual([])
    expect(result.current.data?.forbidden).toBe(true)
  })

  it("rethrows non-403 failures", async () => {
    mockedGet.mockRejectedValue(new Error("network down"))
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminUsers({}, true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ message: "network down" })
  })

  it("stays idle for non-admins", () => {
    mockedGet.mockClear()
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminUsers({}, false), {
      wrapper: QueryWrapper,
    })

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockedGet).not.toHaveBeenCalled()
  })
})

describe("useAdminDeletedUsers", () => {
  it("fetches soft-deleted users", async () => {
    mockedGet.mockResolvedValue({
      data: { users: [{ id: "u9", walletAddress: "0x9", role: "user" }] },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminDeletedUsers({}, true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/users/deleted?page=1&limit=20")
    expect(result.current.data?.users).toHaveLength(1)
  })

  it("stays idle for non-admins", () => {
    mockedGet.mockClear()
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminDeletedUsers({}, false), {
      wrapper: QueryWrapper,
    })

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockedGet).not.toHaveBeenCalled()
  })
})

describe("useAdminRecalculateScores", () => {
  it("posts to the recalculate endpoint for the whole base", async () => {
    const mockedPost = vi.mocked(post)
    mockedPost.mockResolvedValue({ data: { updated: 12, failed: 1 } })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminRecalculateScores(), {
      wrapper: QueryWrapper,
    })

    let out: unknown
    await result.current.mutateAsync({}).then((r) => { out = r })
    expect(mockedPost).toHaveBeenCalledWith("/admin/reputation/recalculate", {})
    expect(out).toMatchObject({ updated: 12, failed: 1 })
  })

  it("targets one user with a query param", async () => {
    const mockedPost = vi.mocked(post)
    mockedPost.mockResolvedValue({ data: { updated: 1, failed: 0, score: 420 } })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminRecalculateScores(), {
      wrapper: QueryWrapper,
    })

    let out: unknown
    await result.current.mutateAsync({ userId: "u-1" }).then((r) => { out = r })
    expect(mockedPost).toHaveBeenCalledWith("/admin/reputation/recalculate?user_id=u-1", {})
    expect(out).toMatchObject({ updated: 1, score: 420 })
  })
})

describe("useAdminCircleInspect", () => {
  it("returns null without an id", async () => {
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminCircleInspect(null, true), {
      wrapper: QueryWrapper,
    })

    expect(result.current.fetchStatus).toBe("idle")
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it("fetches circle state by id", async () => {
    mockedGet.mockResolvedValue({
      data: { circle: { id: "c1", status: "active" }, members: [], memberCount: 0, status: "active" },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminCircleInspect("c1", true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/circles/c1/inspect")
    expect(result.current.data?.circle.id).toBe("c1")
  })
})

describe("useAdminAuditLog", () => {
  it("fetches entries with filters", async () => {
    mockedGet.mockResolvedValue({
      data: { entries: [{ id: "a1", actorId: "u1", action: "user.restored", resourceType: "user", createdAt: new Date().toISOString() }] },
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(
      () => useAdminAuditLog({ action: "user.restored", page: 1, limit: 20 }, true),
      { wrapper: QueryWrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/audit-log?action=user.restored&page=1&limit=20")
    expect(result.current.data?.entries).toHaveLength(1)
  })
})

describe("useAdminFeatureFlags", () => {
  it("normalizes value fallback to enabled", async () => {
    mockedGet.mockResolvedValue({
      data: { flags: [{ flag: "x", value: true }, { flag: "y", enabled: false }] },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminFeatureFlags(true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/feature-flags")
    expect(result.current.data?.[0].enabled).toBe(true)
    expect(result.current.data?.[1].enabled).toBe(false)
  })
})

describe("useAdminDeadLetterJobs", () => {
  it("returns snake_case dead_letter_jobs", async () => {
    mockedGet.mockResolvedValue({
      data: { dead_letter_jobs: [{ id: "j1", queue_name: "sends", status: "dead_letter" }] },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminDeadLetterJobs(true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/admin/jobs/dead-letter")
    expect(result.current.data).toHaveLength(1)
  })

  it("returns empty list when envelope is missing", async () => {
    mockedGet.mockResolvedValue({ data: undefined })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useAdminDeadLetterJobs(true), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
