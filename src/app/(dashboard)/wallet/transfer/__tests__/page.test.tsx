import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { AxiosError } from "axios"
import { post } from "@/lib/api-client"
import WalletTransferPage from "../page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "recipient" ? "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" : null),
  }),
}))

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return {
    ...actual,
    post: vi.fn().mockResolvedValue({ txnHash: "tx_mock_123456789" }),
    get: vi.fn().mockResolvedValue({ data: {} }),
  }
})

describe("WalletTransferPage", () => {
  it("renders transfer page with initial recipient from query params", () => {
    render(<WalletTransferPage />)
    expect(screen.getByTestId("wallet-transfer-page")).toBeDefined()
    const recipientInput = screen.getByTestId("recipient-input") as HTMLInputElement
    expect(recipientInput.value).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
  })

  it("validates empty amount and displays alert", () => {
    render(<WalletTransferPage />)
    const reviewBtn = screen.getByTestId("review-transfer-button")
    fireEvent.click(reviewBtn)

    expect(screen.getByRole("alert")).toBeDefined()
    expect(screen.getByText(/Please enter a valid transfer amount/i)).toBeDefined()
  })

  it("advances to confirmation step upon valid inputs", () => {
    render(<WalletTransferPage />)
    const amountInput = screen.getByTestId("amount-input")
    fireEvent.change(amountInput, { target: { value: "50" } })

    const reviewBtn = screen.getByTestId("review-transfer-button")
    fireEvent.click(reviewBtn)

    expect(screen.getByTestId("confirm-transfer-step")).toBeDefined()
    expect(screen.getByText("Confirm Transfer")).toBeDefined()
  })

  it("surfaces the server error message when confirmation fails", async () => {
    vi.mocked(post).mockRejectedValueOnce(
      new AxiosError(
        "Request failed with status code 400",
        "400",
        undefined,
        undefined,
        {
          status: 400,
          data: {
            message:
              "transfer failed: insufficient wallet balance 0.20 USDC for 50.00 USDC send",
          },
          headers: {},
        } as never,
      ),
    )
    render(<WalletTransferPage />)
    fireEvent.change(screen.getByTestId("amount-input"), { target: { value: "50" } })
    fireEvent.click(screen.getByTestId("review-transfer-button"))
    fireEvent.click(screen.getByText("Confirm & Send"))

    expect(await screen.findByText(/insufficient wallet balance 0\.20/i)).toBeDefined()
  })

  it("reuses the same idempotency key across Confirm retries", async () => {
    vi.mocked(post).mockClear()
    vi.mocked(post).mockRejectedValue(new Error("timeout of 0ms exceeded"))
    render(<WalletTransferPage />)
    fireEvent.change(screen.getByTestId("amount-input"), { target: { value: "50" } })
    fireEvent.click(screen.getByTestId("review-transfer-button"))
    fireEvent.click(screen.getByText("Confirm & Send"))
    await screen.findByText(/timeout/i)
    fireEvent.click(screen.getByText("Confirm & Send"))
    await waitFor(() => expect(vi.mocked(post)).toHaveBeenCalledTimes(2))

    const keys = vi.mocked(post).mock.calls.map(
      (call) => (call[2] as { headers?: Record<string, string> } | undefined)?.headers?.["Idempotency-Key"],
    )
    expect(keys[0]).toMatch(/^[0-9a-f-]{10,}$/)
    expect(keys[1]).toBe(keys[0])
  })
})
