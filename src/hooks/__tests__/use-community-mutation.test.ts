import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { post } from "@/lib/api-client"
import { useCommunityMutation } from "@/hooks/use-community"
import { createQueryWrapper } from "./test-utils"

vi.mock("@/lib/api-client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Error"),
}))

const mockedPost = vi.mocked(post)

describe("useCommunityMutation like/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("posts a like to the announcement endpoint", async () => {
    mockedPost.mockResolvedValue({ success: true })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useCommunityMutation("c1"), {
      wrapper: QueryWrapper,
    })

    await result.current.likeAnnouncement.mutateAsync("a1")

    expect(mockedPost).toHaveBeenCalledWith("/communities/c1/announcements/a1/like", {})
  })

  it("posts a leave to the community endpoint", async () => {
    mockedPost.mockResolvedValue({ success: true })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useCommunityMutation("c1"), {
      wrapper: QueryWrapper,
    })

    await result.current.leave.mutateAsync()

    expect(mockedPost).toHaveBeenCalledWith("/communities/c1/leave")
  })
})
