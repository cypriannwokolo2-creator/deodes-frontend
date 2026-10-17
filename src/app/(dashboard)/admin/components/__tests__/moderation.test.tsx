import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminCircles } from "../AdminCircles"
import { AdminCommunities } from "../AdminCommunities"
import { AdminFrozen } from "../AdminFrozen"

const mutate = vi.fn()

vi.mock("@/hooks/use-admin", () => ({
  useAdminCircles: () => ({
    data: {
      circles: [
        { id: "c-active", name: "Savers", status: "active", memberCount: 5 },
        { id: "c-paused", name: "Frozen", status: "paused", memberCount: 3 },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    },
    isLoading: false,
  }),
  useAdminCircleAction: () => ({ mutate, isPending: false }),
  useAdminCommunities: () => ({
    data: {
      communities: [{ id: "m-1", name: "Lagos", slug: "lagos", memberCount: 9, suspendedAt: null }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    isLoading: false,
  }),
  useAdminCommunityAction: () => ({ mutate, isPending: false }),
  useAdminFrozenWallets: () => ({
    data: [{ id: "w-1", userId: "u-1", publicKey: "0x81e877e2d21ec187994ed4ae1fafb36d529bacb1", frozenReason: "spam" }],
    isLoading: false,
  }),
  useAdminFreezeAction: () => ({ mutate, isPending: false }),
}))

describe("Admin moderation sections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("pauses an active circle directly", () => {
    render(<AdminCircles enabled />)
    fireEvent.click(screen.getAllByTitle("Pause circle")[0])
    expect(mutate).toHaveBeenCalledTimes(0)
    fireEvent.click(screen.getByText("Confirm pause"))
    expect(mutate).toHaveBeenCalledWith({ id: "c-active", action: "pause", reason: undefined }, expect.anything())
  })

  it("bans with an audit reason", async () => {
    render(<AdminCircles enabled />)
    fireEvent.click(screen.getAllByTitle("Ban circle (terminal)")[0])
    fireEvent.change(screen.getByPlaceholderText(/Reason for the audit trail/i), {
      target: { value: "fraud ring" },
    })
    fireEvent.click(screen.getByText("Confirm ban"))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ id: "c-active", action: "ban", reason: "fraud ring" }, expect.anything()),
    )
  })

  it("resumes a paused circle", () => {
    render(<AdminCircles enabled />)
    fireEvent.click(screen.getByTitle("Resume circle"))
    expect(mutate).toHaveBeenCalledWith({ id: "c-paused", action: "resume", reason: undefined }, expect.anything())
  })

  it("suspends a community with reason", () => {
    render(<AdminCommunities enabled />)
    fireEvent.click(screen.getByText("Suspend"))
    fireEvent.change(screen.getByPlaceholderText(/Reason for the audit trail/i), {
      target: { value: "spam" },
    })
    fireEvent.click(screen.getByText("Confirm suspend"))
    expect(mutate).toHaveBeenCalledWith({ id: "m-1", action: "suspend", reason: "spam" }, expect.anything())
  })

  it("freezes by user id only with a valid UUID", () => {
    render(<AdminFrozen enabled />)
    const input = screen.getByLabelText("User ID to freeze")
    fireEvent.change(input, { target: { value: "not-a-uuid" } })
    expect(screen.getByText("Freeze…")).toBeDisabled()
    fireEvent.change(input, { target: { value: "11111111-1111-1111-1111-111111111111" } })
    fireEvent.click(screen.getByText("Freeze…"))
    fireEvent.change(screen.getByLabelText("Freeze reason"), { target: { value: "suspicious" } })
    fireEvent.click(screen.getByText("Confirm freeze"))
    expect(mutate).toHaveBeenCalledWith({
      userId: "11111111-1111-1111-1111-111111111111",
      freeze: true,
      reason: "suspicious",
    }, expect.anything())
  })

  it("unfreezes from the frozen list", () => {
    render(<AdminFrozen enabled />)
    fireEvent.click(screen.getByText("Unfreeze"))
    expect(mutate).toHaveBeenCalledWith({ userId: "u-1", freeze: false })
  })
})
