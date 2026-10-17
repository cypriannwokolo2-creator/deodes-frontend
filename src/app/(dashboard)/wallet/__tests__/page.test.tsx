import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import WalletPage from "../page"

const HOSTED_ADDRESS = `0x${"a".repeat(40)}`
const LINKED_ADDRESS = `0x${"c".repeat(40)}`
const TX_HASH = `0x${"b".repeat(64)}`

const apiFixtures = {
  balance: { data: { balance: { usdc: "1250.50" } } },
  wallets: { data: { wallets: [{ publicKey: HOSTED_ADDRESS, walletType: "hosted" }] } },
  contributions: {
    data: {
      contributions: [
        { id: "1", amount: 50, createdAt: "2026-01-05T00:00:00Z", circleId: "c1", txnHash: TX_HASH },
      ],
    },
  },
  payouts: {
    data: {
      payouts: [{ id: "9", amount: 100, createdAt: "2026-02-05T00:00:00Z", circleId: "c1" }],
    },
  },
}

vi.mock("@/lib/api-client", () => ({
  get: (url: string) => {
    if (url === "/wallets/balance") return Promise.resolve(apiFixtures.balance)
    if (url === "/wallets") return Promise.resolve(apiFixtures.wallets)
    if (url.startsWith("/contributions")) return Promise.resolve(apiFixtures.contributions)
    if (url.startsWith("/payouts")) return Promise.resolve(apiFixtures.payouts)
    return Promise.resolve({})
  },
}))

const authState = { isAuthenticated: true, isLoading: false }

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}))

vi.mock("@/stores/ui-store", () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: vi.fn() }),
}))

vi.mock("@/lib/locale/context", () => ({
  useTranslate: () => ({ t: (key: string) => key, locale: "en-US" }),
}))

function hostedOnly() {
  apiFixtures.wallets = { data: { wallets: [{ publicKey: HOSTED_ADDRESS, walletType: "hosted" }] } }
  authState.isAuthenticated = true
  authState.isLoading = false
}

beforeEach(() => {
  vi.clearAllMocks()
  hostedOnly()
})

describe("WalletPage fintech layout", () => {
  it("renders a single USDC-on-Arc row and never mentions XLM", async () => {
    render(<WalletPage />)

    expect(await screen.findByText("Total balance")).toBeInTheDocument()
    expect(screen.getByText("USDC on Arc")).toBeInTheDocument()
    // Total + the single asset row share the one USDC balance.
    expect(screen.getByTestId("portfolio-total").textContent).toContain("1,250.50")
    expect(screen.getByTestId("portfolio-usdc-row").textContent).toContain("1,250.50")
    expect(screen.queryByText(/xlm/i)).toBeNull()
    expect(screen.queryByText(/stellar/i)).toBeNull()
  })

  it("shows Hosted Deodes wallet badge with Arc explorer link when only hosted", async () => {
    render(<WalletPage />)

    expect(await screen.findByText("Hosted Deodes wallet")).toBeInTheDocument()
    const explorerLink = screen.getByRole("link", { name: "View wallet address in Arc explorer" })
    expect(explorerLink.getAttribute("href")).toContain(`/address/${HOSTED_ADDRESS}`)
  })

  it("ignores non-hosted wallets and always shows the hosted address", async () => {
    apiFixtures.wallets = {
      data: {
        wallets: [
          { publicKey: LINKED_ADDRESS, walletType: "linked" },
          { publicKey: HOSTED_ADDRESS, walletType: "hosted" },
        ],
      },
    }
    render(<WalletPage />)

    expect(await screen.findByText("Hosted Deodes wallet")).toBeInTheDocument()
    expect(screen.queryByText(/Connected/i)).toBeNull()
    const explorerLink = screen.getByRole("link", { name: "View wallet address in Arc explorer" })
    expect(explorerLink.getAttribute("href")).toContain(`/address/${HOSTED_ADDRESS}`)
  })

  it("links Send/Deposit/Withdraw to the right routes and opens Receive modal", async () => {
    render(<WalletPage />)

    expect(await screen.findByTestId("wallet-action-send")).toBeInTheDocument()
    expect(screen.getByTestId("wallet-action-send").getAttribute("href")).toBe("/wallet/transfer")
    expect(screen.getByTestId("wallet-action-deposit").getAttribute("href")).toBe("/wallet/deposit")
    expect(screen.getByTestId("wallet-action-withdraw").getAttribute("href")).toBe("/wallet/withdraw")

    fireEvent.click(screen.getByTestId("wallet-action-receive"))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(HOSTED_ADDRESS)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /close receive dialog/i }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("lists recent activity from contributions and payouts in USDC", async () => {
    render(<WalletPage />)

    expect(await screen.findByText("Recent Activity")).toBeInTheDocument()
    expect(screen.getByText("Contribution")).toBeInTheDocument()
    expect(screen.getByText("Payout")).toBeInTheDocument()
    expect(screen.getByText(/-50\.00 USDC/)).toBeInTheDocument()
    expect(screen.getByText(/\+100\.00 USDC/)).toBeInTheDocument()
  })

  it("shows a setup CTA linking to deposit when signed in with no wallet", async () => {
    apiFixtures.wallets = { data: { wallets: [] } }
    render(<WalletPage />)

    expect(await screen.findByTestId("wallet-empty-state")).toBeInTheDocument()
    const cta = screen.getByTestId("wallet-setup-cta")
    expect(cta.getAttribute("href")).toBe("/wallet/deposit")
  })

  it("shows a sign-in CTA when not signed in", async () => {
    authState.isAuthenticated = false
    render(<WalletPage />)

    expect(await screen.findByTestId("wallet-empty-state")).toBeInTheDocument()
    const signIn = screen.getByTestId("wallet-sign-in-cta")
    expect(signIn.getAttribute("href")).toBe("/login")
    expect(screen.queryByText("Total balance")).toBeNull()
  })
})
