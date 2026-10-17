import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminTickets } from "../AdminTickets"
import { AdminUserDetail } from "../AdminUserDetail"

const mutate = vi.fn()

vi.mock("@/hooks/use-admin", () => ({
  useAdminTickets: () => ({
    data: {
      tickets: [
        { id: "t-1", email: "user@example.com", message: "my funds never arrived", status: "open", createdAt: "2026-10-16T10:00:00Z" },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    isLoading: false,
  }),
  useAdminTicketAction: () => ({ mutate, isPending: false }),
  useAdminUserDetail: () => ({
    data: {
      user: { id: "u-1", walletAddress: "0x81e877e2d21ec187994ed4ae1fafb36d529bacb1", displayName: "Ada", role: "user", moiScore: 42 },
      wallets: [{ id: "w-1", publicKey: "0x81e877e2d21ec187994ed4ae1fafb36d529bacb1", walletType: "hosted", isFrozen: true, frozenReason: "review" }],
      circles: [{ id: "c-1", name: "Savers", status: "active" }],
      communities: [{ id: "m-1", name: "Lagos", slug: "lagos" }],
      recentSends: [{ amount: 0.19, destination: "0x51b4", asset: "USDC", status: "completed", txHash: "0xabc", createdAt: "2026-10-16T11:00:00Z" }],
    },
    isLoading: false,
    isError: false,
  }),
  useAdminFreezeAction: () => ({ mutate, isPending: false }),
}))

describe("Admin support inbox + user detail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("expands a ticket and resolves it", () => {
    render(<AdminTickets enabled />)
    fireEvent.click(screen.getByText("user@example.com"))
    expect(screen.getByText("my funds never arrived")).toBeDefined()
    fireEvent.click(screen.getByText("Mark resolved"))
    expect(mutate).toHaveBeenCalledWith({ id: "t-1", status: "resolved" })
  })

  it("shows wallets, circles, communities and recent sends", () => {
    render(<AdminUserDetail userId="u-1" onClose={() => {}} />)
    expect(screen.getByText("Ada")).toBeDefined()
    expect(screen.getByText("Savers")).toBeDefined()
    expect(screen.getByText("Lagos")).toBeDefined()
    expect(screen.getByText(/0\.19 USDC/)).toBeDefined()
    expect(screen.getByText(/frozen.*review/)).toBeDefined()
  })

  it("freezes and unfreezes from the detail panel", () => {
    render(<AdminUserDetail userId="u-1" onClose={() => {}} />)
    fireEvent.click(screen.getByText("Freeze funds"))
    expect(mutate).toHaveBeenCalledWith({ userId: "u-1", freeze: true, reason: "admin review" })
    fireEvent.click(screen.getByText("Unfreeze"))
    expect(mutate).toHaveBeenCalledWith({ userId: "u-1", freeze: false })
  })

  it("renders nothing without a selected user", () => {
    const { container } = render(<AdminUserDetail userId={null} onClose={() => {}} />)
    expect(container.textContent).toBe("")
  })
})
