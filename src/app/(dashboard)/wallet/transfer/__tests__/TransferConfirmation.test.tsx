import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TransferConfirmation } from "../components/TransferConfirmation"

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/constants", () => ({
  ARC_NETWORK: "testnet",
  ARC_RPC_URL: "https://rpc.testnet.arc.io",
}))

vi.mock("@/lib/explorer", () => ({
  getArcExplorerTxUrl: (_hash: string) =>
    `https://explorer.testnet.arc.io/tx/${_hash}`,
}))

vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/formatters", () => ({
  formatAddress: (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`,
}))

vi.mock("@/lib/api-client", () => ({
  post: vi.fn().mockResolvedValue({ notified: true }),
}))

// Mock fetch for the Arc eth_getTransactionReceipt polling in useTransferPoll
const mockFetch = vi.fn()
function pendingReceipt() {
  return {
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result: null }),
  }
}

// ── Test helpers ─────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  txnHash: "0xabc1234567890def1234567890abcdef12345678",
  amount: "50",
  currency: "USDC" as const,
  recipient: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  networkFee: 0.01,
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("TransferConfirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    // Default: transaction not yet mined (pending)
    mockFetch.mockResolvedValue(pendingReceipt())
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("renders in pending state initially", async () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    // Confirmation container is present
    expect(screen.getByTestId("transfer-confirmation")).toBeDefined()

    // Amount and currency visible
    expect(screen.getByText("50")).toBeDefined()
    expect(screen.getByText("USDC")).toBeDefined()

    // Shows pending label
    expect(screen.getByText(/Confirming on Arc/i)).toBeDefined()
  })

  it("shows destination address in the detail rows", () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)
    expect(screen.getByText("Destination")).toBeDefined()
    // formatAddress mock returns first6…last4
    expect(screen.getByText(/0x742d/)).toBeDefined()
  })

  it("shows network fee", () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)
    expect(screen.getByText("Network Fee")).toBeDefined()
    expect(screen.getByText("0.01 USDC")).toBeDefined()
  })

  it("shows truncated tx hash with copy button and explorer link", () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    // Copy button
    const copyBtn = screen.getByRole("button", { name: /copy transaction hash/i })
    expect(copyBtn).toBeDefined()

    // Explorer anchor
    const explorerLink = screen.getByRole("link", {
      name: /view transaction on arc explorer/i,
    }) as HTMLAnchorElement
    expect(explorerLink.href).toContain(DEFAULT_PROPS.txnHash)
    expect(explorerLink.target).toBe("_blank")
  })

  it("renders the network badge with correct label", () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)
    expect(screen.getByText("Arc Testnet")).toBeDefined()
  })

  it("transitions to finalized state when receipt status is 0x1", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { status: "0x1" } }),
    })

    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    // Advance past the initial delay (async flush so the mocked RPC resolves)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(screen.getByText("Transfer Confirmed")).toBeDefined()

    // Finalized state should show the detail link to the tx page
    expect(
      screen.getByRole("link", { name: /view full transaction details/i }),
    ).toBeDefined()
  })

  it("transitions to failed state when receipt status is 0x0", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { status: "0x0" } }),
    })

    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(screen.getByText("Transaction Failed")).toBeDefined()
  })

  it("reports a finalized outcome once for in-app notifications", async () => {
    const { post } = await import("@/lib/api-client")
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { status: "0x1" } }),
    })

    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith(
      `/wallets/transfers/${DEFAULT_PROPS.txnHash}/outcome`,
      { status: "finalized" },
    )
  })

  it("reports a failed outcome, and nothing while pending", async () => {    const { post } = await import("@/lib/api-client")

    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    // Still pending after the first poll — no report yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(post).not.toHaveBeenCalled()

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { status: "0x0" } }),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith(
      `/wallets/transfers/${DEFAULT_PROPS.txnHash}/outcome`,
      { status: "failed" },
    )
  })

  it("shows the actual network fee from the receipt instead of the estimate", async () => {
    // 31753 gas * 21 Gwei = 0.0006668… USDC
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: {
          status: "0x1",
          gasUsed: "0x7c09",
          effectiveGasPrice: "0x4e3b29200",
        },
      }),
    })

    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(screen.getByText("0.0007 USDC")).toBeDefined()
  })

  it("copies tx hash to clipboard when copy button is clicked", async () => {
    const { copyToClipboard } = await import("@/lib/clipboard")

    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    const copyBtn = screen.getByRole("button", { name: /copy transaction hash/i })
    // fireEvent rather than userEvent: user-event 14 deadlocks under vitest's
    // fake timers in this repo (its internal wait never resolves).
    await act(async () => {
      fireEvent.click(copyBtn)
      await Promise.resolve()
    })

    expect(copyToClipboard).toHaveBeenCalledWith(DEFAULT_PROPS.txnHash)
  })

  it("shows progress bar with aria attributes while pending", () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)

    const progressBar = screen.getByRole("progressbar")
    expect(progressBar).toBeDefined()
    expect(progressBar.getAttribute("aria-valuemin")).toBe("1")
    expect(progressBar.getAttribute("aria-valuemax")).toBe("20")
  })

  it("has aria-live polite region for screen reader status updates", () => {
    render(<TransferConfirmation {...DEFAULT_PROPS} />)
    const region = screen.getByTestId("transfer-confirmation")
    expect(region.getAttribute("aria-live")).toBe("polite")
  })
})
