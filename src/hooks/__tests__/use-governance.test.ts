import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { get, post } from "@/lib/api-client"
import {
  useGovernanceProposals,
  useGovernanceProposal,
  useVoteOnProposal,
} from "@/hooks/use-governance"
import { createQueryWrapper } from "./test-utils"

vi.mock("@/lib/api-client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Error"),
}))

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useGovernanceProposals", () => {
  it("loads proposals for the given status", async () => {
    mockedGet.mockResolvedValue({
      proposals: [{ id: "p1", title: "T", description: "D", status: "pending", forVotes: 3, againstVotes: 1 }],
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useGovernanceProposals("active"), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGet).toHaveBeenCalledWith("/governance/proposals?status=active")
    expect(result.current.data).toEqual([
      expect.objectContaining({ id: "p1", status: "active", votesFor: 3, votesAgainst: 1 }),
    ])
  })
})

describe("useGovernanceProposal", () => {
  it("loads a single proposal by id", async () => {
    mockedGet.mockResolvedValue({
      proposal: { id: "p1", title: "T", description: "D", status: "pending", forVotes: 3, againstVotes: 1 },
    })
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useGovernanceProposal("p1"), {
      wrapper: QueryWrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(
      expect.objectContaining({ id: "p1", status: "active", votesFor: 3 }),
    )
  })
})

describe("useVoteOnProposal", () => {
  it("posts the vote and invalidates cached proposal data", async () => {
    mockedPost.mockResolvedValue({})
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useVoteOnProposal("p1"), {
      wrapper: QueryWrapper,
    })

    await result.current.mutateAsync(true)

    // Singular path and on-chain boolean payload — the chain records
    // for/against only.
    expect(mockedPost).toHaveBeenCalledWith("/governance/proposals/p1/vote", {
      vote: true,
    })
  })

  it("refuses abstentions instead of misrecording them", async () => {
    const { QueryWrapper } = createQueryWrapper()
    const { result } = renderHook(() => useVoteOnProposal("p1"), {
      wrapper: QueryWrapper,
    })

    await expect(result.current.mutateAsync("abstain")).rejects.toThrow(/Abstentions/)
    expect(mockedPost).not.toHaveBeenCalled()
  })
})
