import React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CirclePayoutTrigger } from "./circle-payout-trigger"
import { get, post } from "@/lib/api-client"
import { createQueryWrapper } from "@/hooks/__tests__/test-utils"
import type { Circle, CircleMember } from "@/types"

vi.mock("@/lib/api-client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  getErrorMessage: (err: unknown) =>
    (err as { message?: string })?.message ?? "Request failed",
}))

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)

const TXN_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
const ARC_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"

const circle = {
  id: "circle-1",
  name: "Test Circle",
  status: "active",
  currency: "USDC",
  contributionAmount: 100,
  currentRound: 2,
  payoutType: "fixed",
  maxMembers: 5,
} as unknown as Circle

const randomCircle = { ...circle, payoutType: "random" } as Circle

function mockCirclePayouts(payouts: unknown[]) {
  mockedGet.mockResolvedValue({
    success: true,
    data: { payouts },
    meta: { page: 1, limit: 100, total: payouts.length, totalPages: 1 },
  })
}

const paidPayout = {
  id: "payout-1",
  circleId: "circle-1",
  recipientId: "user-1",
  roundNumber: 1,
  amount: 200,
  payoutType: "random",
  createdAt: "2026-07-25T00:00:00Z",
}

const members = [
  { userId: "user-1", circleId: "circle-1", status: "active", userName: "Alice", userAddress: ARC_ADDRESS },
  { userId: "user-2", circleId: "circle-1", status: "active", userName: "Bob", userAddress: ARC_ADDRESS },
] as unknown as CircleMember[]

const preview = {
  circleId: "circle-1",
  roundNumber: 2,
  currency: "USDC",
  totalGrossAmount: 200,
  totalNetAmount: 199,
  protocolFee: 1,
  arcFeeEstimate: 0.001,
  recipients: [{ recipientId: "user-1", grossAmount: 200, feeAmount: 1, netAmount: 199 }],
  dryRun: true,
  isDue: true,
}

function renderTrigger(overrides: Partial<React.ComponentProps<typeof CirclePayoutTrigger>> = {}) {
  const { QueryWrapper } = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CirclePayoutTrigger circle={circle} members={members} isOrganizer {...overrides} />
    </QueryWrapper>,
  )
}

describe("CirclePayoutTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing for non-organizers or inactive circles", () => {
    const { QueryWrapper } = createQueryWrapper()
    const { container } = render(
      <QueryWrapper>
        <CirclePayoutTrigger circle={circle} members={members} isOrganizer={false} />
      </QueryWrapper>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("disables distribution for non-USDC circles (Arc USDC only)", () => {
    renderTrigger({ circle: { ...circle, currency: "EUR" as never } as Circle })
    expect(screen.getByText(/Arc USDC only/)).toBeDefined()
    expect(screen.queryByLabelText(/Recipient/)).toBeNull()
  })

  it("previews the distribution via the real preview endpoint", async () => {
    mockedPost.mockResolvedValueOnce({ success: true, data: { preview } })
    renderTrigger()

    fireEvent.change(screen.getByLabelText(/Recipient/), { target: { value: "user-1" } })
    fireEvent.click(screen.getByRole("button", { name: /Preview distribution/ }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/circles/circle-1/payout/preview", {
        recipientId: "user-1",
        roundNumber: 2,
      }),
    )
    expect(screen.getByTestId("payout-preview")).toBeDefined()
    expect(screen.getByText(/due now/)).toBeDefined()
  })

  it("requires a recipient before previewing", async () => {
    renderTrigger()
    fireEvent.click(screen.getByRole("button", { name: /Preview distribution/ }))
    expect(await screen.findByRole("alert")).toBeDefined()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it("rejects non-0x transaction hashes on trigger", async () => {
    mockedPost.mockResolvedValueOnce({ success: true, data: { preview } })
    renderTrigger()

    fireEvent.change(screen.getByLabelText(/Recipient/), { target: { value: "user-1" } })
    fireEvent.click(screen.getByRole("button", { name: /Preview distribution/ }))
    await screen.findByTestId("payout-preview")

    fireEvent.change(screen.getByLabelText(/Arc distribution receipt/), {
      target: { value: "not-a-hash" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Sign & distribute/ }))

    expect(await screen.findByRole("alert")).toBeDefined()
    expect(mockedPost).toHaveBeenCalledTimes(1)
  })

  it("triggers distribution via the real payout endpoint with auth client", async () => {
    mockedPost
      .mockResolvedValueOnce({ success: true, data: { preview } })
      .mockResolvedValueOnce({
        success: true,
        data: {
          payout: {
            id: "payout-9",
            circleId: "circle-1",
            recipientId: "user-1",
            roundNumber: 2,
            amount: 200,
            feeAmount: 1,
            txnHash: { String: TXN_HASH, Valid: true },
            payoutType: "fixed",
            createdAt: "2026-07-25T00:00:00Z",
          },
        },
      })
    renderTrigger()

    fireEvent.change(screen.getByLabelText(/Recipient/), { target: { value: "user-1" } })
    fireEvent.click(screen.getByRole("button", { name: /Preview distribution/ }))
    await screen.findByTestId("payout-preview")

    fireEvent.change(screen.getByLabelText(/Arc distribution receipt/), {
      target: { value: TXN_HASH },
    })
    fireEvent.click(screen.getByRole("button", { name: /Sign & distribute/ }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/circles/circle-1/payout", {
        recipientId: "user-1",
        roundNumber: 2,
        amount: 200,
        feeAmount: 1,
        txnHash: TXN_HASH,
        payoutType: "fixed",
      }),
    )
  })
})

describe("CirclePayoutTrigger rotation (random circles)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderRandomTrigger() {
    const { QueryWrapper } = createQueryWrapper()
    return render(
      <QueryWrapper>
        <CirclePayoutTrigger circle={randomCircle} members={members} isOrganizer />
      </QueryWrapper>,
    )
  }

  it("lists only remaining recipients and marks the paid member", async () => {
    mockCirclePayouts([paidPayout])
    renderRandomTrigger()

    expect(await screen.findByText(/Rotation: 1 of 2 paid/)).toBeDefined()
    const options = screen.getAllByRole("option")
    // Placeholder + one remaining member + one disabled paid member.
    expect(options).toHaveLength(3)
    const paidOption = screen.getByRole("option", { name: /already paid/ })
    expect((paidOption as HTMLOptionElement).disabled).toBe(true)
    expect(screen.getByRole("option", { name: /Bob/ })).toBeDefined()
  })

  it("blocks previewing an already-paid member client-side", async () => {
    mockCirclePayouts([paidPayout])
    renderRandomTrigger()
    await screen.findByText(/Rotation: 1 of 2 paid/)

    fireEvent.change(screen.getByLabelText(/Recipient/), { target: { value: "user-1" } })
    fireEvent.click(screen.getByRole("button", { name: /Preview distribution/ }))

    expect(await screen.findByText(/already been paid in this rotation/)).toBeDefined()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it("announces rotation completion and disables distribution", async () => {
    mockCirclePayouts([
      paidPayout,
      { ...paidPayout, id: "payout-2", recipientId: "user-2", roundNumber: 2 },
    ])
    renderRandomTrigger()

    expect(await screen.findByText(/Rotation complete/)).toBeDefined()
    expect(screen.getByRole("button", { name: /Preview distribution/ })).toHaveProperty("disabled", true)
  })

  it("shows the full member list for non-random circles", async () => {
    mockCirclePayouts([paidPayout])
    renderTrigger()

    // Fixed circles keep organizer-directed selection: no rotation copy.
    expect(screen.queryByText(/Rotation:/)).toBeNull()
    expect(screen.queryByText(/Rotation complete/)).toBeNull()
    expect(screen.getAllByRole("option")).toHaveLength(3)
  })
})
